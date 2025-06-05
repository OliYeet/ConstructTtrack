/**
 * API Contract Testing Tests
 * Tests the contract testing framework functionality
 */

import {
  SchemaValidator,
  ContractTestRunner,
  contractTestUtils,
  ContractTestConfig,
} from '../contract-testing';

// Mock fetch for testing
global.fetch = jest.fn();

describe('API Contract Testing', () => {
  let validator: SchemaValidator;
  // let runner: ContractTestRunner;

  beforeEach(() => {
    validator = new SchemaValidator();
    runner = new ContractTestRunner();
    jest.clearAllMocks();
  });

  describe('SchemaValidator', () => {
    it('should validate simple object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      const validData = { name: 'John', age: 30 };
      const invalidData = { age: 30 }; // missing required name

      const validResult = validator.validateSchema(validData, schema);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidResult = validator.validateSchema(invalidData, schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should validate array schema', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            value: { type: 'number' },
          },
          required: ['id'],
        },
      };

      const validData = [
        { id: '1', value: 10 },
        { id: '2', value: 20 },
      ];

      const invalidData = [
        { id: '1', value: 10 },
        { value: 20 }, // missing required id
      ];

      const validResult = validator.validateSchema(validData, schema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateSchema(invalidData, schema);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate request body against operation spec', () => {
      const operationSpec = {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['title'],
              },
            },
          },
        },
      };

      const validBody = { title: 'Test Task', description: 'Test description' };
      const invalidBody = { description: 'Test description' }; // missing title

      const validResult = validator.validateRequestBody(
        validBody,
        operationSpec
      );
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateRequestBody(
        invalidBody,
        operationSpec
      );
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate response body against operation spec', () => {
      const operationSpec = {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                  },
                  required: ['success'],
                },
              },
            },
          },
        },
      };

      const validBody = { success: true, data: { id: 1 } };
      const invalidBody = { data: { id: 1 } }; // missing success

      const validResult = validator.validateResponseBody(
        validBody,
        operationSpec,
        200
      );
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateResponseBody(
        invalidBody,
        operationSpec,
        200
      );
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('ContractTestRunner', () => {
    it('should create runner with default config', () => {
      const defaultRunner = new ContractTestRunner();
      expect(defaultRunner).toBeDefined();
    });

    it('should create runner with custom config', () => {
      const config: ContractTestConfig = {
        timeout: 5000,
        validateRequest: false,
        validateResponse: true,
        strictMode: true,
      };

      const customRunner = new ContractTestRunner(config);
      expect(customRunner).toBeDefined();
    });

    it('should generate test data from schema', () => {
      const runner = new ContractTestRunner();

      // Access private method for testing
      const generateDataFromSchema = (
        runner as any
      ).generateDataFromSchema.bind(runner);

      const stringSchema = { type: 'string' };
      const stringResult = generateDataFromSchema(stringSchema);
      expect(typeof stringResult).toBe('string');

      const numberSchema = { type: 'number' };
      const numberResult = generateDataFromSchema(numberSchema);
      expect(typeof numberResult).toBe('number');

      const objectSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };
      const objectResult = generateDataFromSchema(objectSchema);
      expect(typeof objectResult).toBe('object');
      expect(objectResult).toHaveProperty('name');
      expect(objectResult).toHaveProperty('age');
    });

    it('should handle email format in schema', () => {
      const runner = new ContractTestRunner();
      const generateDataFromSchema = (
        runner as any
      ).generateDataFromSchema.bind(runner);

      const emailSchema = { type: 'string', format: 'email' };
      const result = generateDataFromSchema(emailSchema);
      expect(result).toBe('test@example.com');
    });

    it('should handle UUID format in schema', () => {
      const runner = new ContractTestRunner();
      const generateDataFromSchema = (
        runner as any
      ).generateDataFromSchema.bind(runner);

      const uuidSchema = { type: 'string', format: 'uuid' };
      const result = generateDataFromSchema(uuidSchema);
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle date-time format in schema', () => {
      const runner = new ContractTestRunner();
      const generateDataFromSchema = (
        runner as any
      ).generateDataFromSchema.bind(runner);

      const dateSchema = { type: 'string', format: 'date-time' };
      const result = generateDataFromSchema(dateSchema);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should prepare test request correctly', () => {
      const runner = new ContractTestRunner({
        baseUrl: 'http://localhost:3000',
      });
      const prepareTestRequest = (runner as any).prepareTestRequest.bind(
        runner
      );

      const pathTemplate = '/api/v1/projects/{id}';
      const method = 'get';
      const operationSpec = {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'test-project-id',
          },
          {
            name: 'include',
            in: 'query',
            schema: { type: 'string' },
            example: 'tasks',
          },
        ],
      };

      const result = prepareTestRequest(
        pathTemplate,
        method,
        operationSpec,
        {}
      );

      expect(result.url).toBe(
        'http://localhost:3000/api/v1/projects/test-project-id?include=tasks'
      );
      expect(result.requestOptions.method).toBe('GET');
      expect(result.requestOptions.headers).toHaveProperty(
        'Accept',
        'application/json'
      );
    });

    it('should run contract tests on mock spec', async () => {
      const mockSpec = {
        paths: {
          '/api/v1/test': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'test' }),
      });

      const config: ContractTestConfig = {
        baseUrl: 'http://localhost:3000',
        validateResponse: true,
      };

      const runner = new ContractTestRunner(config);
      const suite = await runner.runContractTests(mockSpec);

      expect(suite.results).toHaveLength(1);
      expect(suite.results[0].status).toBe('passed');
      expect(suite.summary.total).toBe(1);
      expect(suite.summary.passed).toBe(1);
      expect(suite.summary.failed).toBe(0);
    });

    it('should handle deprecated endpoints', async () => {
      const mockSpec = {
        paths: {
          '/api/v1/deprecated': {
            get: {
              deprecated: true,
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const runner = new ContractTestRunner({ strictMode: false });
      const suite = await runner.runContractTests(mockSpec);

      expect(suite.results).toHaveLength(1);
      expect(suite.results[0].status).toBe('skipped');
      expect(suite.results[0].warnings).toContain('Endpoint is deprecated');
    });
  });

  describe('contractTestUtils', () => {
    it('should generate test report', () => {
      const mockSuite = {
        name: 'Test Suite',
        results: [
          {
            endpoint: '/api/test',
            method: 'GET',
            status: 'passed' as const,
            errors: [],
            warnings: [],
            duration: 100,
          },
          {
            endpoint: '/api/fail',
            method: 'POST',
            status: 'failed' as const,
            errors: ['Validation failed'],
            warnings: [],
            duration: 200,
          },
        ],
        summary: {
          total: 2,
          passed: 1,
          failed: 1,
          skipped: 0,
          duration: 300,
        },
      };

      const report = contractTestUtils.generateReport(mockSuite);

      expect(report).toContain('# API Contract Test Report');
      expect(report).toContain('Test Suite');
      expect(report).toContain('Total:** 2');
      expect(report).toContain('Passed:** 1');
      expect(report).toContain('Failed:** 1');
      expect(report).toContain('## Failed Tests');
      expect(report).toContain('POST /api/fail');
    });

    it('should export results as JSON', () => {
      const mockSuite = {
        name: 'Test Suite',
        results: [],
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
        },
      };

      const json = contractTestUtils.exportResults(mockSuite);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('Test Suite');
      expect(parsed.results).toEqual([]);
      expect(parsed.summary.total).toBe(0);
    });

    it('should filter results by status', () => {
      const mockSuite = {
        name: 'Test Suite',
        results: [
          {
            status: 'passed' as const,
            endpoint: '/test1',
            method: 'GET',
            errors: [],
            warnings: [],
            duration: 100,
          },
          {
            status: 'failed' as const,
            endpoint: '/test2',
            method: 'POST',
            errors: [],
            warnings: [],
            duration: 200,
          },
          {
            status: 'skipped' as const,
            endpoint: '/test3',
            method: 'PUT',
            errors: [],
            warnings: [],
            duration: 0,
          },
        ],
        summary: { total: 3, passed: 1, failed: 1, skipped: 1, duration: 300 },
      };

      const passedResults = contractTestUtils.filterResults(
        mockSuite,
        'passed'
      );
      expect(passedResults).toHaveLength(1);
      expect(passedResults[0].endpoint).toBe('/test1');

      const failedResults = contractTestUtils.filterResults(
        mockSuite,
        'failed'
      );
      expect(failedResults).toHaveLength(1);
      expect(failedResults[0].endpoint).toBe('/test2');

      const skippedResults = contractTestUtils.filterResults(
        mockSuite,
        'skipped'
      );
      expect(skippedResults).toHaveLength(1);
      expect(skippedResults[0].endpoint).toBe('/test3');
    });
  });
});
