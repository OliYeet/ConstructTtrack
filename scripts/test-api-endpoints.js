#!/usr/bin/env node

/**
 * API Endpoints Testing Script
 *
 * This script tests all API endpoints defined in the OpenAPI specification
 * to ensure they are working correctly and returning expected responses.
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
  publicOnly: process.argv.includes('--public-only'),
  outputDir: path.resolve(__dirname, '../docs/api/validation'),
};

// Test results
const testResults = {
  endpoints: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  },
};

/**
 * Main testing function
 */
async function testApiEndpoints() {
  console.log(chalk.blue.bold('🧪 API Endpoints Testing'));
  console.log(chalk.gray('='.repeat(40)));

  try {
    // Check if API server is running
    await checkApiServer();

    // Parse OpenAPI spec
    const api = await SwaggerParser.parse(CONFIG.openApiSpecPath);

    // Test each endpoint
    await testAllEndpoints(api);

    // Generate report
    await generateTestReport();

    // Display results
    displayResults();

    // Exit with appropriate code
    process.exit(testResults.summary.failed === 0 ? 0 : 1);
  } catch (error) {
    console.error(chalk.red.bold('❌ Endpoint testing failed:'), error.message);
    if (CONFIG.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Check if API server is running
 */
async function checkApiServer() {
  console.log(chalk.yellow('🔍 Checking API server availability...'));

  try {
    const response = await fetch(`${CONFIG.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(CONFIG.timeout),
    });

    if (response.ok) {
      console.log(chalk.green('✅ API server is running'));
    } else {
      throw new Error(`API server returned status ${response.status}`);
    }
  } catch (error) {
    throw new Error(`API server is not accessible: ${error.message}`);
  }
}

/**
 * Test all endpoints defined in the OpenAPI spec
 */
async function testAllEndpoints(api) {
  console.log(chalk.yellow('🔍 Testing API endpoints...'));

  const paths = Object.keys(api.paths || {});

  for (const pathTemplate of paths) {
    const pathSpec = api.paths[pathTemplate];
    const methods = Object.keys(pathSpec);

    for (const method of methods) {
      if (
        ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(
          method.toLowerCase()
        )
      ) {
        await testSingleEndpoint(
          pathTemplate,
          method.toLowerCase(),
          pathSpec[method],
          api
        );
      }
    }
  }
}

/**
 * Test a single endpoint
 */
async function testSingleEndpoint(pathTemplate, method, operationSpec, api) {
  const testCase = {
    path: pathTemplate,
    method: method.toUpperCase(),
    status: 'pending',
    errors: [],
    warnings: [],
    response: null,
    duration: 0,
    timestamp: new Date().toISOString(),
  };

  testResults.endpoints.push(testCase);
  testResults.summary.total++;

  try {
    // Skip authentication-required endpoints if testing public only
    if (CONFIG.publicOnly && requiresAuth(operationSpec)) {
      testCase.status = 'skipped';
      testCase.warnings.push(
        'Skipped due to authentication requirement (public-only mode)'
      );
      testResults.summary.skipped++;

      if (CONFIG.verbose) {
        console.log(
          chalk.yellow(
            `⏭️  Skipped ${method.toUpperCase()} ${pathTemplate} (auth required)`
          )
        );
      }
      return;
    }

    const startTime = Date.now();

    // Prepare and make request
    const { url, options } = prepareRequest(
      pathTemplate,
      method,
      operationSpec,
      api
    );
    const response = await makeRequest(url, options);

    testCase.duration = Date.now() - startTime;
    testCase.response = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    };

    // Validate response
    validateResponse(testCase, operationSpec);

    if (testCase.errors.length === 0) {
      testCase.status = 'passed';
      testResults.summary.passed++;

      if (CONFIG.verbose) {
        console.log(
          chalk.green(
            `✅ ${method.toUpperCase()} ${pathTemplate} (${testCase.duration}ms)`
          )
        );
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

    console.log(
      chalk.red(`❌ ${method.toUpperCase()} ${pathTemplate}: ${error.message}`)
    );
  }
}

/**
 * Check if an operation requires authentication
 */
function requiresAuth(operationSpec) {
  // Check if security is explicitly set to empty array (no auth required)
  if (
    Array.isArray(operationSpec.security) &&
    operationSpec.security.length === 0
  ) {
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
function prepareRequest(pathTemplate, method, operationSpec, _api) {
  // Convert path template to actual URL
  let url = CONFIG.baseUrl + pathTemplate;

  // Simple path parameter substitution for testing
  url = url.replace(/\{([^}]+)\}/g, (match, paramName) => {
    // Use test values for common parameters
    const testValues = {
      id: 'test-id-123',
      projectId: 'project-test-123',
      taskId: 'task-test-123',
      userId: 'user-test-123',
    };

    return testValues[paramName] || 'test-value';
  });

  const options = {
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'ConstructTrack-API-Tester/1.0',
    },
  };

  // Add test request body for POST/PUT/PATCH requests
  if (['post', 'put', 'patch'].includes(method) && operationSpec.requestBody) {
    options.body = JSON.stringify(
      generateTestRequestBody(operationSpec.requestBody, pathTemplate)
    );
  }

  // Add query parameters for GET requests
  if (method === 'get' && operationSpec.parameters) {
    const queryParams = new URLSearchParams();

    operationSpec.parameters.forEach(param => {
      if (param.in === 'query' && !param.required) {
        // Add common test query parameters
        const testQueryValues = {
          page: '1',
          limit: '10',
          sortBy: 'name',
          sortOrder: 'asc',
          status: 'active',
        };

        if (testQueryValues[param.name]) {
          queryParams.set(param.name, testQueryValues[param.name]);
        }
      }
    });

    if (queryParams.toString()) {
      url += '?' + queryParams.toString();
    }
  }

  return { url, options };
}

/**
 * Generate test request body based on endpoint
 */
function generateTestRequestBody(requestBodySpec, pathTemplate) {
  // Generate appropriate test data based on the endpoint
  if (pathTemplate.includes('/test')) {
    return {
      message: 'Test message from endpoint testing script',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
        source: 'api-endpoint-tester',
      },
    };
  }

  if (pathTemplate.includes('/projects')) {
    return {
      name: 'Test Project from API Tester',
      description:
        'This is a test project created by the API endpoint testing script',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      budget: 50000,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
    };
  }

  if (pathTemplate.includes('/tasks')) {
    return {
      title: 'Test Task from API Tester',
      description:
        'This is a test task created by the API endpoint testing script',
      priority: 2,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      estimatedHours: 8,
    };
  }

  // Default test body
  return {
    test: true,
    message: 'Generated by API endpoint testing script',
    timestamp: new Date().toISOString(),
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
      signal: controller.signal,
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
 * Validate response against expectations
 */
function validateResponse(testCase, operationSpec) {
  const response = testCase.response;

  // Check if response status is defined in spec
  const expectedStatuses = Object.keys(operationSpec.responses || {});
  const statusFound =
    expectedStatuses.includes(response.status.toString()) ||
    expectedStatuses.includes('default');

  if (!statusFound) {
    testCase.errors.push(
      `Unexpected response status: ${response.status}. Expected one of: ${expectedStatuses.join(', ')}`
    );
  }

  // Validate content type
  const contentType = response.headers['content-type'] || '';
  if (response.body && !contentType.includes('application/json')) {
    testCase.warnings.push(`Expected JSON response, got: ${contentType}`);
  }

  // Validate response body structure
  if (response.body) {
    try {
      const responseData = JSON.parse(response.body);

      // Check for standard API response structure
      if (typeof responseData === 'object') {
        if (!Object.prototype.hasOwnProperty.call(responseData, 'success')) {
          testCase.warnings.push('Response missing "success" field');
        }

        if (!Object.prototype.hasOwnProperty.call(responseData, 'meta')) {
          testCase.warnings.push('Response missing "meta" field');
        }

        if (
          responseData.success &&
          !Object.prototype.hasOwnProperty.call(responseData, 'data')
        ) {
          testCase.warnings.push('Successful response missing "data" field');
        }

        if (
          !responseData.success &&
          !Object.prototype.hasOwnProperty.call(responseData, 'error')
        ) {
          testCase.warnings.push('Error response missing "error" field');
        }

        // Validate meta structure
        if (responseData.meta) {
          const requiredMetaFields = ['timestamp', 'version', 'requestId'];
          requiredMetaFields.forEach(field => {
            if (
              !Object.prototype.hasOwnProperty.call(responseData.meta, field)
            ) {
              testCase.warnings.push(`Meta object missing "${field}" field`);
            }
          });
        }
      }
    } catch (error) {
      testCase.errors.push(`Invalid JSON response: ${error.message}`);
    }
  }

  // Check response time
  if (testCase.duration > 5000) {
    testCase.warnings.push(`Slow response time: ${testCase.duration}ms`);
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
      summary: testResults.summary,
    };

    const reportPath = path.join(
      CONFIG.outputDir,
      `endpoint-test-report-${Date.now()}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (CONFIG.verbose) {
      console.log(chalk.green(`📊 Test report generated: ${reportPath}`));
    }
  } catch (error) {
    console.warn(
      chalk.yellow(`⚠️  Failed to generate test report: ${error.message}`)
    );
  }
}

/**
 * Display test results
 */
function displayResults() {
  console.log(chalk.blue.bold('\n🧪 Endpoint Test Results'));
  console.log(chalk.gray('='.repeat(40)));

  const { total, passed, failed, skipped } = testResults.summary;

  console.log(`${chalk.green('✅')} Passed: ${passed}/${total}`);
  console.log(`${chalk.red('❌')} Failed: ${failed}/${total}`);
  console.log(`${chalk.yellow('⏭️ ')} Skipped: ${skipped}/${total}`);

  const successRate =
    total > 0 ? ((passed / (total - skipped)) * 100).toFixed(1) : 0;
  console.log(`${chalk.blue('📊')} Success Rate: ${successRate}%`);

  // Show average response time
  const responseTimes = testResults.endpoints
    .filter(test => test.status === 'passed')
    .map(test => test.duration);

  if (responseTimes.length > 0) {
    const avgResponseTime = (
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    ).toFixed(0);
    console.log(
      `${chalk.blue('⏱️ ')} Average Response Time: ${avgResponseTime}ms`
    );
  }

  if (failed > 0) {
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

  // Show warnings if verbose
  if (CONFIG.verbose) {
    const warnings = testResults.endpoints
      .filter(test => test.warnings.length > 0)
      .flatMap(test => test.warnings);

    if (warnings.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  Warnings:'));
      warnings.forEach(warning => {
        console.log(chalk.yellow(`  - ${warning}`));
      });
    }
  }
}

// Run testing if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testApiEndpoints().catch(error => {
    console.error(chalk.red.bold('💥 Endpoint testing failed:'), error.message);
    process.exit(1);
  });
}
