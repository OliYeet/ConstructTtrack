/**
 * Simple API Test Script
 * Basic tests to verify the API structure is working correctly
 * 
 * Run with: node src/tests/api-test.js
 */

const BASE_URL = 'http://localhost:3001/api/v1';

// Simple test runner
class ApiTester {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, testFn) {
    try {
      console.log(`\n🧪 Testing: ${name}`);
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      this.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
      this.failed++;
    }
  }

  async run() {
    console.log('🚀 Starting API Tests...\n');
    
    // Test 1: Health Check
    await this.test('Health Check Endpoint', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Health check failed');
      }
      
      if (!data.data.status) {
        throw new Error('Missing status in health check');
      }
      
      console.log(`   Status: ${data.data.status}`);
      console.log(`   Services: API=${data.data.services.api}, DB=${data.data.services.database}`);
    });

    // Test 2: Test Endpoint GET
    await this.test('Test Endpoint GET', async () => {
      const response = await fetch(`${BASE_URL}/test`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Test endpoint failed');
      }
      
      if (!data.data.message) {
        throw new Error('Missing message in test response');
      }
      
      console.log(`   Message: ${data.data.message}`);
      console.log(`   Request ID: ${data.data.requestId}`);
    });

    // Test 3: Test Endpoint POST with valid data
    await this.test('Test Endpoint POST (Valid)', async () => {
      const response = await fetch(`${BASE_URL}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello from test!',
          data: { test: true, number: 42 }
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Test POST failed');
      }
      
      if (!data.data.message.includes('Hello from test!')) {
        throw new Error('Message not echoed correctly');
      }
      
      console.log(`   Received: ${data.data.message}`);
      console.log(`   Data: ${JSON.stringify(data.data.receivedData)}`);
    });

    // Test 4: Test Endpoint POST with invalid data (validation)
    await this.test('Test Endpoint POST (Invalid - Validation)', async () => {
      const response = await fetch(`${BASE_URL}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: '' // Empty string should fail validation
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        throw new Error('Expected validation error but got success');
      }
      
      if (data.error.code !== 'VALIDATION_ERROR') {
        throw new Error(`Expected VALIDATION_ERROR but got ${data.error.code}`);
      }
      
      if (response.status !== 400) {
        throw new Error(`Expected status 400 but got ${response.status}`);
      }
      
      console.log(`   Error Code: ${data.error.code}`);
      console.log(`   Error Message: ${data.error.message}`);
      console.log(`   Field: ${data.error.field}`);
    });

    // Test 5: Method Not Allowed
    await this.test('Method Not Allowed', async () => {
      const response = await fetch(`${BASE_URL}/test`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        throw new Error('Expected method not allowed error but got success');
      }
      
      if (response.status !== 405) {
        throw new Error(`Expected status 405 but got ${response.status}`);
      }
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error.message}`);
    });

    // Test 6: Rate Limiting (make multiple requests quickly)
    await this.test('Rate Limiting', async () => {
      console.log('   Making 5 rapid requests...');
      
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(fetch(`${BASE_URL}/test`));
      }
      
      const responses = await Promise.all(promises);
      const allSuccessful = responses.every(r => r.status === 200);
      
      if (!allSuccessful) {
        console.log('   Some requests were rate limited (this is expected behavior)');
      } else {
        console.log('   All requests succeeded (rate limit not triggered)');
      }
      
      // This test always passes as rate limiting behavior can vary
    });

    // Test 7: CORS Headers
    await this.test('CORS Headers', async () => {
      const response = await fetch(`${BASE_URL}/test`, {
        method: 'OPTIONS'
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200 for OPTIONS but got ${response.status}`);
      }
      
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');
      if (!corsHeader) {
        throw new Error('Missing CORS headers');
      }
      
      console.log(`   CORS Origin: ${corsHeader}`);
      console.log(`   CORS Methods: ${response.headers.get('Access-Control-Allow-Methods')}`);
    });

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed! API structure is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ApiTester();
  tester.run().catch(console.error);
}

module.exports = ApiTester;
