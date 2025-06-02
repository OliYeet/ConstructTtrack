#!/usr/bin/env node

/**
 * API Implementation Validation Script
 * 
 * This script validates the actual API implementation by making real HTTP requests
 * and comparing responses against the OpenAPI specification schemas.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SwaggerParser from '@apidevtools/swagger-parser';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  openApiSpecPath: path.resolve(__dirname, '../docs/api/openapi.yaml'),
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api/v1',
  timeout: 10000,
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  skipAuth: process.argv.includes('--skip-auth'),
  outputDir: path.resolve(__dirname, '../docs/api/validation'),
};

// Test results
const testResults = {
  endpoints: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  }
};

/**
 * Main validation function
 */
async function validateApiImplementation() {
  console.log(chalk.blue.bold('🧪 API Implementation Validation'));
  console.log(chalk.gray('=' .repeat(50)));
  
  try {
    // Parse OpenAPI spec
    const api = await SwaggerParser.parse(CONFIG.openApiSpecPath);
    
    // Test each endpoint
    await testEndpoints(api);
    
    // Generate report
    await generateTestReport();
    
    // Display results
    displayTestResults();
    
    // Exit with appropriate code
    process.exit(testResults.summary.failed === 0 ? 0 : 1);
    
  } catch (error) {
    console.error(chalk.red.bold('❌ Implementation validation failed:'), error.message);
    if (CONFIG.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Test all endpoints defined in the OpenAPI spec
 */
async function testEndpoints(api) {
  console.log(chalk.yellow('🔍 Testing API endpoints...'));
  
  const paths = Object.keys(api.paths || {});
  
  for (const pathTemplate of paths) {
    const pathSpec = api.paths[pathTemplate];
    const methods = Object.keys(pathSpec);
    
    for (const method of methods) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
        await testEndpoint(pathTemplate, method.toLowerCase(), pathSpec[method], api);
      }
    }
  }
}

/**
 * Test a specific endpoint
 */
async function testEndpoint(pathTemplate, method, operationSpec, api) {
  const testCase = {
    path: pathTemplate,
    method: method.toUpperCase(),
    status: 'pending',
    errors: [],
    warnings: [],
    response: null,
    duration: 0
  };
  
  testResults.endpoints.push(testCase);
  testResults.summary.total++;
  
  try {
    const startTime = Date.now();
    
    // Skip authentication-required endpoints if requested
    if (CONFIG.skipAuth && requiresAuth(operationSpec)) {
      testCase.status = 'skipped';
      testCase.warnings.push('Skipped due to authentication requirement');
      testResults.summary.skipped++;
      
      if (CONFIG.verbose) {
        console.log(chalk.yellow(`⏭️  Skipped ${method.toUpperCase()} ${pathTemplate} (auth required)`));
      }
      return;
    }
    
    // Prepare request
    const { url, options } = prepareRequest(pathTemplate, method, operationSpec, api);
    
    // Make request
    const response = await makeRequest(url, options);
    testCase.response = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    };
    
    testCase.duration = Date.now() - startTime;
    
    // Validate response
    await validateResponse(testCase, operationSpec, api);
    
    if (testCase.errors.length === 0) {
      testCase.status = 'passed';
      testResults.summary.passed++;
      
      if (CONFIG.verbose) {
        console.log(chalk.green(`✅ ${method.toUpperCase()} ${pathTemplate} (${testCase.duration}ms)`));
      }
    } else {
      testCase.status = 'failed';
      testResults.summary.failed++;
      
      console.log(chalk.red(`❌ ${method.toUpperCase()} ${pathTemplate}`));
      if (CONFIG.verbose) {
        testCase.errors.forEach(error => {
          console.log(chalk.red(`   Error: ${error}`));
        });
      }
    }
    
  } catch (error) {
    testCase.status = 'failed';
    testCase.errors.push(error.message);
    testCase.duration = Date.now() - (testCase.startTime || Date.now());
    testResults.summary.failed++;
    
    console.log(chalk.red(`❌ ${method.toUpperCase()} ${pathTemplate}: ${error.message}`));
  }
}

/**
 * Check if an operation requires authentication
 */
function requiresAuth(operationSpec) {
  // Check if security is explicitly set to empty array (no auth required)
  if (Array.isArray(operationSpec.security) && operationSpec.security.length === 0) {
    return false;
  }
  
  // Check if operation has security requirements
  if (operationSpec.security && operationSpec.security.length > 0) {
    return true;
  }
  
  // Default to requiring auth if not explicitly specified as public
  return true;
}

/**
 * Prepare HTTP request for an endpoint
 */
function prepareRequest(pathTemplate, method, operationSpec, api) {
  // Convert path template to actual URL
  let url = CONFIG.baseUrl + pathTemplate;
  
  // For now, use simple path parameter substitution
  // In a real implementation, you'd want to provide actual test values
  url = url.replace(/\{([^}]+)\}/g, (match, paramName) => {
    // Use placeholder values for path parameters
    return 'test-id';
  });
  
  const options = {
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  // Add test request body for POST/PUT/PATCH requests
  if (['post', 'put', 'patch'].includes(method) && operationSpec.requestBody) {
    options.body = JSON.stringify(generateTestRequestBody(operationSpec.requestBody, api));
  }
  
  // Add query parameters for GET requests
  if (method === 'get' && operationSpec.parameters) {
    const queryParams = new URLSearchParams();
    
    operationSpec.parameters.forEach(param => {
      if (param.in === 'query' && !param.required) {
        // Add some test query parameters
        if (param.name === 'page') queryParams.set('page', '1');
        if (param.name === 'limit') queryParams.set('limit', '10');
      }
    });
    
    if (queryParams.toString()) {
      url += '?' + queryParams.toString();
    }
  }
  
  return { url, options };
}

/**
 * Generate test request body based on schema
 */
function generateTestRequestBody(requestBodySpec, api) {
  // Simple test data generation
  // In a real implementation, you'd want more sophisticated test data generation
  
  if (requestBodySpec.content && requestBodySpec.content['application/json']) {
    const schema = requestBodySpec.content['application/json'].schema;
    
    // Generate basic test data based on common patterns
    if (schema.$ref && schema.$ref.includes('TestRequest')) {
      return {
        message: "Test message from validation script",
        data: {
          test: true,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    if (schema.$ref && schema.$ref.includes('Project')) {
      return {
        name: "Test Project",
        description: "Test project created by validation script",
        startDate: new Date().toISOString(),
        budget: 10000
      };
    }
  }
  
  // Default test body
  return {
    test: true,
    message: "Generated by API validation script"
  };
}

/**
 * Make HTTP request with timeout
 */
async function makeRequest(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${CONFIG.timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Validate response against OpenAPI spec
 */
async function validateResponse(testCase, operationSpec, api) {
  const response = testCase.response;
  
  // Check if response status is defined in spec
  const expectedStatuses = Object.keys(operationSpec.responses || {});
  const statusFound = expectedStatuses.includes(response.status.toString()) || 
                     expectedStatuses.includes('default');
  
  if (!statusFound) {
    testCase.errors.push(`Unexpected response status: ${response.status}. Expected one of: ${expectedStatuses.join(', ')}`);
    return;
  }
  
  // Validate response content type
  const contentType = response.headers['content-type'] || '';
  if (!contentType.includes('application/json') && response.body) {
    testCase.warnings.push(`Expected JSON response, got: ${contentType}`);
  }
  
  // Validate response body structure (basic validation)
  if (response.body) {
    try {
      const responseData = JSON.parse(response.body);
      
      // Check for standard API response structure
      if (typeof responseData === 'object') {
        if (!responseData.hasOwnProperty('success')) {
          testCase.warnings.push('Response missing "success" field');
        }
        
        if (!responseData.hasOwnProperty('meta')) {
          testCase.warnings.push('Response missing "meta" field');
        }
        
        if (responseData.success && !responseData.hasOwnProperty('data')) {
          testCase.warnings.push('Successful response missing "data" field');
        }
        
        if (!responseData.success && !responseData.hasOwnProperty('error')) {
          testCase.warnings.push('Error response missing "error" field');
        }
      }
      
    } catch (error) {
      testCase.errors.push(`Invalid JSON response: ${error.message}`);
    }
  }
}

/**
 * Generate test report
 */
async function generateTestReport() {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      results: testResults,
      summary: testResults.summary
    };
    
    const reportPath = path.join(CONFIG.outputDir, `implementation-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    if (CONFIG.verbose) {
      console.log(chalk.green(`📊 Test report generated: ${reportPath}`));
    }
    
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Failed to generate test report: ${error.message}`));
  }
}

/**
 * Display test results
 */
function displayTestResults() {
  console.log(chalk.blue.bold('\n🧪 Implementation Test Results'));
  console.log(chalk.gray('=' .repeat(40)));
  
  const { total, passed, failed, skipped } = testResults.summary;
  
  console.log(`${chalk.green('✅')} Passed: ${passed}/${total}`);
  console.log(`${chalk.red('❌')} Failed: ${failed}/${total}`);
  console.log(`${chalk.yellow('⏭️ ')} Skipped: ${skipped}/${total}`);
  
  const successRate = total > 0 ? ((passed / (total - skipped)) * 100).toFixed(1) : 0;
  console.log(`${chalk.blue('📊')} Success Rate: ${successRate}%`);
  
  if (failed > 0 && CONFIG.verbose) {
    console.log(chalk.red.bold('\n❌ Failed Tests:'));
    
    testResults.endpoints
      .filter(test => test.status === 'failed')
      .forEach(test => {
        console.log(chalk.red(`  ${test.method} ${test.path}`));
        test.errors.forEach(error => {
          console.log(chalk.red(`    - ${error}`));
        });
      });
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateApiImplementation().catch(error => {
    console.error(chalk.red.bold('💥 Implementation validation failed:'), error.message);
    process.exit(1);
  });
}
