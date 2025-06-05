/**
 * API Contract Testing Framework
 * Comprehensive contract testing for API endpoints against OpenAPI specifications
 */

// Contract testing framework for API validation
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { getLogger } from '@/lib/logging';

// Contract testing configuration
export interface ContractTestConfig {
  specPath?: string;
  baseUrl?: string;
  timeout?: number;
  validateRequest?: boolean;
  validateResponse?: boolean;
  strictMode?: boolean;
  generateExamples?: boolean;
}

// Test result types
export interface ContractTestResult {
  endpoint: string;
  method: string;
  status: 'passed' | 'failed' | 'skipped';
  errors: string[];
  warnings: string[];
  duration: number;
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body?: any;
  };
  validationResults?: {
    requestValid: boolean;
    responseValid: boolean;
    schemaErrors: string[];
  };
}

export interface ContractTestSuite {
  name: string;
  results: ContractTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

// Schema validation
export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      validateFormats: true,
    });
    try {
      addFormats(this.ajv as any);
    } catch {
      // Handle AJV version compatibility issues
      // Failed to add formats to AJV - version compatibility issue
    }
  }

  validateSchema(data: any, schema: any): { valid: boolean; errors: string[] } {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    const errors =
      validate.errors?.map(error => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      }) || [];

    return { valid, errors };
  }

  validateRequestBody(
    body: any,
    operationSpec: any
  ): { valid: boolean; errors: string[] } {
    const requestBodySpec = operationSpec.requestBody;
    if (!requestBodySpec) {
      return { valid: true, errors: [] };
    }

    const contentType = 'application/json'; // Assume JSON for now
    const schema = requestBodySpec.content?.[contentType]?.schema;

    if (!schema) {
      return { valid: true, errors: [] };
    }

    return this.validateSchema(body, schema);
  }

  validateResponseBody(
    body: any,
    operationSpec: any,
    statusCode: number
  ): { valid: boolean; errors: string[] } {
    const responseSpec =
      operationSpec.responses?.[statusCode] || operationSpec.responses?.default;
    if (!responseSpec) {
      return {
        valid: false,
        errors: [`No response specification for status ${statusCode}`],
      };
    }

    const contentType = 'application/json'; // Assume JSON for now
    const schema = responseSpec.content?.[contentType]?.schema;

    if (!schema) {
      return { valid: true, errors: [] };
    }

    return this.validateSchema(body, schema);
  }
}

// Contract test runner
export class ContractTestRunner {
  private config: ContractTestConfig;
  private validator: SchemaValidator;
  private logger: any;

  constructor(config: ContractTestConfig = {}) {
    this.config = {
      timeout: 30000,
      validateRequest: true,
      validateResponse: true,
      strictMode: false,
      generateExamples: false,
      ...config,
    };
    this.validator = new SchemaValidator();
    this.logger = getLogger();
  }

  async runContractTests(
    spec: any,
    endpoints?: string[]
  ): Promise<ContractTestSuite> {
    const startTime = Date.now();
    const results: ContractTestResult[] = [];

    this.logger.info('Starting contract tests', {
      endpoints: endpoints?.length || Object.keys(spec.paths || {}).length,
      config: this.config,
    });

    const pathsToTest = endpoints || Object.keys(spec.paths || {});

    for (const pathTemplate of pathsToTest) {
      const pathSpec = spec.paths[pathTemplate];
      if (!pathSpec) continue;

      const methods = Object.keys(pathSpec).filter(method =>
        ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(
          method.toLowerCase()
        )
      );

      for (const method of methods) {
        const result = await this.testEndpoint(
          pathTemplate,
          method.toLowerCase(),
          pathSpec[method],
          spec
        );
        results.push(result);
      }
    }

    const duration = Date.now() - startTime;
    const summary = this.calculateSummary(results, duration);

    return {
      name: 'API Contract Tests',
      results,
      summary,
    };
  }

  private async testEndpoint(
    pathTemplate: string,
    method: string,
    operationSpec: any,
    spec: any
  ): Promise<ContractTestResult> {
    const startTime = Date.now();
    const result: ContractTestResult = {
      endpoint: pathTemplate,
      method: method.toUpperCase(),
      status: 'failed',
      errors: [],
      warnings: [],
      duration: 0,
    };

    try {
      // Skip if operation is marked as deprecated and not in strict mode
      if (operationSpec.deprecated && !this.config.strictMode) {
        result.status = 'skipped';
        result.warnings.push('Endpoint is deprecated');
        return result;
      }

      // Prepare test request
      const { url, requestOptions, testData } = this.prepareTestRequest(
        pathTemplate,
        method,
        operationSpec,
        spec
      );

      result.request = {
        url,
        method: method.toUpperCase(),
        headers: this.normalizeHeaders(requestOptions.headers || {}),
        body: testData,
      };

      // Validate request if enabled
      if (this.config.validateRequest && testData) {
        const requestValidation = this.validator.validateRequestBody(
          testData,
          operationSpec
        );
        if (!requestValidation.valid) {
          result.errors.push(
            ...requestValidation.errors.map(e => `Request validation: ${e}`)
          );
        }
      }

      // Make the actual request
      if (this.config.baseUrl) {
        const response = await this.makeRequest(url, requestOptions);

        result.response = {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: await this.parseResponseBody(response),
        };

        // Validate response if enabled
        if (this.config.validateResponse) {
          const responseValidation = this.validator.validateResponseBody(
            result.response.body,
            operationSpec,
            response.status
          );

          if (!responseValidation.valid) {
            result.errors.push(
              ...responseValidation.errors.map(e => `Response validation: ${e}`)
            );
          }

          result.validationResults = {
            requestValid: this.config.validateRequest
              ? this.validator.validateRequestBody(testData, operationSpec)
                  .valid
              : true,
            responseValid: responseValidation.valid,
            schemaErrors: responseValidation.errors,
          };
        }

        // Check expected status codes
        const expectedStatuses = Object.keys(operationSpec.responses || {});
        if (
          expectedStatuses.length > 0 &&
          !expectedStatuses.includes(response.status.toString())
        ) {
          result.warnings.push(
            `Unexpected status code: ${response.status}. Expected: ${expectedStatuses.join(', ')}`
          );
        }
      }

      // Determine final status
      result.status = result.errors.length === 0 ? 'passed' : 'failed';
    } catch (error) {
      result.errors.push(
        `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      result.status = 'failed';
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  private prepareTestRequest(
    pathTemplate: string,
    method: string,
    operationSpec: any,
    _spec: any
  ): { url: string; requestOptions: RequestInit; testData?: any } {
    // Replace path parameters with example values
    let url = pathTemplate;
    const pathParams =
      operationSpec.parameters?.filter((p: any) => p.in === 'path') || [];

    for (const param of pathParams) {
      const exampleValue = param.example || param.schema?.example || 'test-id';
      url = url.replace(`{${param.name}}`, exampleValue);
    }

    // Add base URL if configured
    if (this.config.baseUrl) {
      url = `${this.config.baseUrl}${url}`;
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Add query parameters
    const queryParams =
      operationSpec.parameters?.filter((p: any) => p.in === 'query') || [];
    if (queryParams.length > 0) {
      const searchParams = new URLSearchParams();
      for (const param of queryParams) {
        const exampleValue =
          param.example || param.schema?.example || 'test-value';
        searchParams.append(param.name, exampleValue);
      }
      url += `?${searchParams.toString()}`;
    }

    // Prepare request body for POST/PUT/PATCH
    let testData: any;
    if (
      ['post', 'put', 'patch'].includes(method) &&
      operationSpec.requestBody
    ) {
      testData = this.generateTestData(operationSpec.requestBody);
    }

    const requestOptions: RequestInit = {
      method: method.toUpperCase(),
      headers,
      body: testData ? JSON.stringify(testData) : undefined,
    };

    return { url, requestOptions, testData };
  }

  private generateTestData(requestBodySpec: any): any {
    const contentType = 'application/json';
    const schema = requestBodySpec.content?.[contentType]?.schema;

    if (!schema) return {};

    // Generate test data based on schema
    return this.generateDataFromSchema(schema);
  }

  private generateDataFromSchema(schema: any): any {
    if (schema.example) return schema.example;
    if (schema.examples) return Object.values(schema.examples)[0];

    switch (schema.type) {
      case 'object': {
        const obj: any = {};
        if (schema.properties) {
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            obj[key] = this.generateDataFromSchema(propSchema);
          }
        }
        return obj;
      }

      case 'array':
        return schema.items ? [this.generateDataFromSchema(schema.items)] : [];

      case 'string':
        if (schema.format === 'email') return 'test@example.com';
        if (schema.format === 'date-time') return new Date().toISOString();
        if (schema.format === 'uuid')
          return '123e4567-e89b-12d3-a456-426614174000';
        return schema.default || 'test-string';

      case 'number':
      case 'integer':
        return schema.default || 42;

      case 'boolean':
        return schema.default || true;

      default:
        return null;
    }
  }

  private async makeRequest(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseResponseBody(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }

    return await response.text();
  }

  private normalizeHeaders(headers: HeadersInit): Record<string, string> {
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    return headers as Record<string, string>;
  }

  private calculateSummary(results: ContractTestResult[], duration: number) {
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      duration,
    };
  }
}

// Contract testing utilities
export const contractTestUtils = {
  // Generate test report
  generateReport(suite: ContractTestSuite): string {
    const { summary, results } = suite;

    let report = `# API Contract Test Report\n\n`;
    report += `**Test Suite:** ${suite.name}\n`;
    report += `**Duration:** ${summary.duration}ms\n\n`;

    report += `## Summary\n\n`;
    report += `- **Total:** ${summary.total}\n`;
    report += `- **Passed:** ${summary.passed} ✅\n`;
    report += `- **Failed:** ${summary.failed} ❌\n`;
    report += `- **Skipped:** ${summary.skipped} ⏭️\n\n`;

    if (summary.failed > 0) {
      report += `## Failed Tests\n\n`;
      results
        .filter(r => r.status === 'failed')
        .forEach(result => {
          report += `### ${result.method} ${result.endpoint}\n\n`;
          report += `**Duration:** ${result.duration}ms\n\n`;
          report += `**Errors:**\n`;
          result.errors.forEach(error => {
            report += `- ${error}\n`;
          });
          report += `\n`;
        });
    }

    return report;
  },

  // Export results as JSON
  exportResults(suite: ContractTestSuite): string {
    return JSON.stringify(suite, null, 2);
  },

  // Filter results by status
  filterResults(
    suite: ContractTestSuite,
    status: 'passed' | 'failed' | 'skipped'
  ): ContractTestResult[] {
    return suite.results.filter(r => r.status === status);
  },
};
