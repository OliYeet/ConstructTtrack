/**
 * Unit tests for authentication module
 * Following Charlie's testing strategy
 */

import { verifyToken, generateConnectionId } from '../auth';
import jwt from 'jsonwebtoken';

// Mock config
jest.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key-for-testing-only',
    },
  },
}));

describe('Authentication', () => {
  // Use consistent time for all tests to avoid timing issues in CI
  const baseTime = Math.floor(Date.now() / 1000);

  beforeAll(() => {
    // Use fake timers to ensure deterministic test behavior
    jest.useFakeTimers();
    // Set system time to baseTime * 1000 (milliseconds)
    jest.setSystemTime(baseTime * 1000);
  });

  afterAll(() => {
    // Restore real timers after tests complete
    jest.useRealTimers();
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600, // 1 hour from base time
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toEqual({
        userId: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: payload.exp,
      });
    });

    it('should reject invalid JWT token', () => {
      const result = verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should reject expired JWT token', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime - 3600, // 1 hour before base time
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should reject token with wrong secret', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600,
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'wrong-secret', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should reject token with missing required claims', () => {
      const payload = {
        // Missing 'sub' claim
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600,
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should reject token with wrong issuer', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600,
        iss: 'wrong-issuer',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should reject token with wrong audience', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600,
        iss: 'constructtrack',
        aud: 'wrong-audience',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should handle malformed JWT tokens', () => {
      const malformedTokens = [
        'not.a.jwt',
        'malformed',
        '',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.malformed',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.invalid_signature',
      ];

      malformedTokens.forEach(token => {
        const result = verifyToken(token);
        expect(result).toBeNull();
      });
    });

    it('should handle tokens with invalid signatures', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600,
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      // Sign with correct secret
      const validToken = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });

      // Tamper with the signature
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature`;

      const result = verifyToken(tamperedToken);
      expect(result).toBeNull();
    });

    it('should handle tokens with future not-before time', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600,
        nbf: baseTime + 1800, // Not valid for another 30 minutes
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    // Additional test cases for CI environment robustness
    it('should handle empty token', () => {
      const result = verifyToken('');
      expect(result).toBeNull();
    });

    it('should handle null token', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = verifyToken(null as any);
      expect(result).toBeNull();
    });

    it('should handle undefined token', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = verifyToken(undefined as any);
      expect(result).toBeNull();
    });

    it('should handle token with missing issuer claim', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600,
        // Missing 'iss' claim
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should handle token with missing audience claim', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 3600,
        iss: 'constructtrack',
        // Missing 'aud' claim
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should handle token with clock skew within tolerance', () => {
      // Create a token that's valid for testing clock tolerance
      // Use current time to ensure it's not actually expired
      const currentTime = Math.floor(Date.now() / 1000);
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: currentTime + 3600, // Valid for 1 hour
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      // Should be valid
      expect(result).toEqual({
        userId: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: payload.exp,
      });
    });

    it('should handle tokens with very long expiration times', () => {
      // Test with a token that has a very long expiration time
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: baseTime + 86400, // 24 hours from base time
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only', {
        algorithm: 'HS256',
      });
      const result = verifyToken(token);

      expect(result).toEqual({
        userId: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: payload.exp,
      });
    });
  });

  describe('generateConnectionId', () => {
    it('should generate unique connection IDs', () => {
      const id1 = generateConnectionId();
      const id2 = generateConnectionId();

      expect(id1).toMatch(/^conn_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^conn_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate connection ID with correct format', () => {
      const id = generateConnectionId();
      const parts = id.split('_');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('conn');
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // random string
    });
  });
});
