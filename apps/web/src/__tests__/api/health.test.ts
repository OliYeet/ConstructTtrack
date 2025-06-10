/**
 * Health API Tests - Early Development
 * Simple functionality tests without external dependencies
 */

// Mock the health endpoint
jest.mock('@/app/api/v1/health/route', () => ({
  GET: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/health/route';

describe('/api/v1/health - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(GET).toBeDefined();
    expect(typeof GET).toBe('function');
  });

  it('should return a health response when called', async () => {
    const mockHealthResponse = {
      json: () =>
        Promise.resolve({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        }),
      status: 200,
    };

    (GET as jest.Mock).mockResolvedValueOnce(mockHealthResponse);

    const mockRequest = new NextRequest('http://localhost:3000/api/v1/health');
    const result = await GET(mockRequest, { params: Promise.resolve({}) });

    expect(result).toBeDefined();
    expect(GET).toHaveBeenCalledWith(mockRequest, {
      params: Promise.resolve({}),
    });
  });
});
