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
  describe('verifyToken', () => {
    it('should verify valid JWT token', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iss: 'constructtrack',
        aud: 'ws-gateway',
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only');
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
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      const token = jwt.sign(payload, 'test-secret-key-for-testing-only');
      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    it('should reject token with wrong secret', () => {
      const payload = {
        sub: 'user123',
        roles: ['field_worker'],
        projects: ['project456'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, 'wrong-secret');
      const result = verifyToken(token);

      expect(result).toBeNull();
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
