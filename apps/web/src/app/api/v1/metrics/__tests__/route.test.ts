/**
 * Tests for the metrics API route
 */

import { POST } from '../route';
import { createMockRequest } from '../../../../../tests/setup';

// Mock the realtime monitoring integration
jest.mock('../../../../../lib/monitoring/realtime-integration', () => ({
  realtimeMonitoringIntegration: {
    recordMetric: jest.fn(),
  },
}));

describe('POST /api/v1/metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should record a valid metric', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/metrics',
      body: {
        name: 'test.metric',
        value: 42,
        unit: 'count',
        tags: { environment: 'test' },
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toBe('Metric recorded successfully');
    expect(data.data.metric.name).toBe('test.metric');
    expect(data.data.metric.value).toBe(42);
    expect(data.data.metric.unit).toBe('count');
  });

  it('should reject metric with missing required fields', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/metrics',
      body: {
        name: 'test.metric',
        // missing value and unit
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Missing required fields');
  });

  it('should reject metric with invalid name format', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/metrics',
      body: {
        name: 'invalid-metric-name!',
        value: 42,
        unit: 'count',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Invalid metric name format');
  });

  it('should reject metric with non-finite value', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/v1/metrics',
      body: {
        name: 'test.metric',
        value: Infinity,
        unit: 'count',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain(
      'Metric value must be a finite number'
    );
  });
});
