import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

import { withApiMiddleware } from '@/lib/api/middleware';
import { createMockRequest } from '@/tests/setup';

const AUTH_SECRET = process.env.AUTH_SECRET!;

// Simple handler that echoes authenticated user data
const api = withApiMiddleware(
  {
    // New style – user comes from the third-argument `requestContext`
    GET: (_request, _ctx, requestContext: { user?: unknown }) =>
      NextResponse.json({ user: requestContext.user }),
  },
  { requireAuth: true }
);

const callApi = (requestOptions: Parameters<typeof createMockRequest>[0] = {}) =>
  api(createMockRequest(requestOptions), { params: Promise.resolve({}) });

describe('withApiMiddleware – authentication flow', () => {
  it('returns 200 and attaches user when a valid JWT is provided', async () => {
    const token = jwt.sign(
      {
        sub: 'user-123',
        email: 'valid@example.com',
        role: 'admin',
        organizationId: 'org-1',
      },
      AUTH_SECRET
    );

    const response = await callApi({
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user).toMatchObject({
      id: 'user-123',
      email: 'valid@example.com',
      role: 'admin',
      organizationId: 'org-1',
    });
  });

  it('returns 401 when Authorization header is missing', async () => {
    const response = await callApi();
    expect(response.status).toBe(401);
  });

  it('returns 401 when token is malformed or invalid', async () => {
    const response = await callApi({
      headers: { authorization: 'Bearer definitely.invalid.token' },
    });
    expect(response.status).toBe(401);
  });
});
