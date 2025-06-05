/**
 * Integration test for WebSocket Gateway
 * One happy-path test as recommended by Charlie
 */

import { WebSocketGateway } from '../gateway';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

// Mock config
jest.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key-for-testing-only',
    },
    server: {
      port: 8081, // Use different port for testing
    },
  },
}));

describe('WebSocket Gateway Integration', () => {
  let gateway: WebSocketGateway;
  const testPort = 8081;

  beforeAll(async () => {
    gateway = new WebSocketGateway();
    await gateway.start(testPort);
  });

  afterAll(async () => {
    await gateway.stop();
  });

  it('should handle complete WebSocket connection flow', done => {
    // Create valid JWT token
    const payload = {
      sub: 'test-user',
      roles: ['field_worker'],
      projects: ['test-project'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = jwt.sign(payload, 'test-secret-key-for-testing-only');

    // Connect to WebSocket with token
    const ws = new WebSocket(`ws://localhost:${testPort}/ws?token=${token}`);

    let messageCount = 0;
    const expectedMessages = ['connected', 'subscribed', 'pong'];

    ws.on('open', () => {
      // Test subscription
      ws.send(
        JSON.stringify({
          action: 'subscribe',
          room: 'project:test-project',
        })
      );
    });

    ws.on('message', data => {
      const message = JSON.parse(data.toString());

      if (message.type === 'connected') {
        expect(message.data.connectionId).toMatch(/^conn_\d+_[a-z0-9]+$/);
        messageCount++;
      } else if (message.type === 'subscribed') {
        expect(message.data.room).toBe('project:test-project');
        messageCount++;

        // Test ping/pong
        ws.send(JSON.stringify({ action: 'ping' }));
      } else if (message.type === 'pong') {
        expect(message.data.timestamp).toBeGreaterThan(0);
        messageCount++;

        // All expected messages received
        if (messageCount === expectedMessages.length) {
          ws.close();
          done();
        }
      }
    });

    ws.on('error', error => {
      done(error);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      ws.close();
      done(new Error('Test timeout'));
    }, 5000);
  });

  it('should reject connection without valid token', done => {
    const ws = new WebSocket(`ws://localhost:${testPort}/ws`);

    ws.on('close', (code, _reason) => {
      expect(code).toBe(1008); // Authentication required
      done();
    });

    ws.on('open', () => {
      done(new Error('Connection should have been rejected'));
    });

    ws.on('error', () => {
      // Expected for rejected connections
    });
  });
});
