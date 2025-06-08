/**
 * Connection Collector Tests
 * Unit tests for the ConnectionCollector class
 * Based on Charlie's implementation blueprint for LUM-585
 */

import {
  ConnectionCollector,
  ConnectionEvent,
} from '@/lib/monitoring/collectors/connection-collector';

// Mock the config
jest.mock('@/lib/monitoring/config/realtime-config', () => ({
  realtimeConfig: {
    collectors: {
      connection: {
        enabled: true,
        sampleRate: 1.0,
      },
    },
  },
}));

describe('ConnectionCollector', () => {
  let collector: ConnectionCollector;

  beforeEach(() => {
    collector = new ConnectionCollector();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (collector.isRunning()) {
      collector.stop();
    }
  });

  describe('Basic functionality', () => {
    it('should initialize with correct id', () => {
      expect(collector.id).toBe('connection-collector');
    });

    it('should start and stop correctly', () => {
      expect(collector.isRunning()).toBe(false);

      collector.start();
      expect(collector.isRunning()).toBe(true);

      collector.stop();
      expect(collector.isRunning()).toBe(false);
    });

    it('should emit started and stopped events', () => {
      const startedSpy = jest.fn();
      const stoppedSpy = jest.fn();

      collector.on('started', startedSpy);
      collector.on('stopped', stoppedSpy);

      collector.start();
      expect(startedSpy).toHaveBeenCalledWith('connection-collector');

      collector.stop();
      expect(stoppedSpy).toHaveBeenCalledWith('connection-collector');
    });
  });

  describe('Connection tracking', () => {
    beforeEach(() => {
      collector.start();
    });

    it('should track connection established events', () => {
      const metricSpy = jest.fn();
      collector.on('metric', metricSpy);

      const connectionEvent: ConnectionEvent = {
        type: 'connected',
        connectionId: 'conn-123',
        userId: 'user-456',
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        timestamp: new Date().toISOString(),
      };

      collector.trackConnection(connectionEvent);

      expect(metricSpy).toHaveBeenCalled();
      expect(collector.getActiveConnectionCount()).toBe(1);

      const stats = collector.getConnectionStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
    });

    it('should track connection closed events', () => {
      const metricSpy = jest.fn();
      collector.on('metric', metricSpy);

      // First establish a connection
      const connectEvent: ConnectionEvent = {
        type: 'connected',
        connectionId: 'conn-123',
        userId: 'user-456',
        timestamp: new Date().toISOString(),
      };
      collector.trackConnection(connectEvent);

      // Then close it
      const disconnectEvent: ConnectionEvent = {
        type: 'disconnected',
        connectionId: 'conn-123',
        timestamp: new Date().toISOString(),
      };
      collector.trackConnection(disconnectEvent);

      expect(collector.getActiveConnectionCount()).toBe(0);

      const stats = collector.getConnectionStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.totalDisconnections).toBe(1);
      expect(stats.activeConnections).toBe(0);
    });

    it('should track connection errors', () => {
      const metricSpy = jest.fn();
      collector.on('metric', metricSpy);

      const errorEvent: ConnectionEvent = {
        type: 'error',
        connectionId: 'conn-123',
        timestamp: new Date().toISOString(),
        metadata: { errorType: 'timeout' },
      };

      collector.trackConnection(errorEvent);

      const stats = collector.getConnectionStats();
      expect(stats.totalErrors).toBe(1);
    });

    it('should track auth failures', () => {
      const metricSpy = jest.fn();
      collector.on('metric', metricSpy);

      const authFailEvent: ConnectionEvent = {
        type: 'auth_failed',
        connectionId: 'conn-123',
        timestamp: new Date().toISOString(),
        metadata: { reason: 'invalid_token' },
      };

      collector.trackConnection(authFailEvent);

      const stats = collector.getConnectionStats();
      expect(stats.authFailures).toBe(1);
    });

    it('should track reconnect attempts', () => {
      const metricSpy = jest.fn();
      collector.on('metric', metricSpy);

      const reconnectEvent: ConnectionEvent = {
        type: 'reconnect_attempt',
        connectionId: 'conn-123',
        timestamp: new Date().toISOString(),
        metadata: { attemptNumber: 2 },
      };

      collector.trackConnection(reconnectEvent);

      const stats = collector.getConnectionStats();
      expect(stats.reconnectAttempts).toBe(1);
    });

    it('should calculate connection duration correctly', done => {
      const metricSpy = jest.fn();
      collector.on('metric', metricSpy);

      // Establish connection
      const connectEvent: ConnectionEvent = {
        type: 'connected',
        connectionId: 'conn-123',
        timestamp: new Date().toISOString(),
      };
      collector.trackConnection(connectEvent);

      // Wait a bit then disconnect
      setTimeout(() => {
        const disconnectEvent: ConnectionEvent = {
          type: 'disconnected',
          connectionId: 'conn-123',
          timestamp: new Date().toISOString(),
        };
        collector.trackConnection(disconnectEvent);

        // Check that duration metric was emitted
        const durationMetrics = metricSpy.mock.calls
          .map(call => call[0])
          .filter(metric => metric.name === 'connection_duration');

        expect(durationMetrics).toHaveLength(1);
        expect(durationMetrics[0].value).toBeGreaterThan(0);

        done();
      }, 10);
    });

    it('should track peak connections', () => {
      // Establish multiple connections
      for (let i = 0; i < 5; i++) {
        const connectEvent: ConnectionEvent = {
          type: 'connected',
          connectionId: `conn-${i}`,
          timestamp: new Date().toISOString(),
        };
        collector.trackConnection(connectEvent);
      }

      const stats = collector.getConnectionStats();
      expect(stats.peakConnections).toBe(5);
      expect(stats.activeConnections).toBe(5);

      // Close some connections
      for (let i = 0; i < 3; i++) {
        const disconnectEvent: ConnectionEvent = {
          type: 'disconnected',
          connectionId: `conn-${i}`,
          timestamp: new Date().toISOString(),
        };
        collector.trackConnection(disconnectEvent);
      }

      const updatedStats = collector.getConnectionStats();
      expect(updatedStats.peakConnections).toBe(5); // Peak should remain
      expect(updatedStats.activeConnections).toBe(2);
    });

    it('should provide active connections list', () => {
      // Establish connections
      const connectEvent1: ConnectionEvent = {
        type: 'connected',
        connectionId: 'conn-1',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      };
      const connectEvent2: ConnectionEvent = {
        type: 'connected',
        connectionId: 'conn-2',
        userId: 'user-2',
        timestamp: new Date().toISOString(),
      };

      collector.trackConnection(connectEvent1);
      collector.trackConnection(connectEvent2);

      const activeConnections = collector.getActiveConnections();
      expect(activeConnections).toHaveLength(2);
      expect(activeConnections[0].connectionId).toBe('conn-1');
      expect(activeConnections[0].userId).toBe('user-1');
      expect(activeConnections[0].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      collector.start();
    });

    it('should handle invalid connection events gracefully', () => {
      const errorSpy = jest.fn();
      collector.on('error', errorSpy);

      // This should not throw
      expect(() => {
        collector.trackConnection({} as ConnectionEvent);
      }).not.toThrow();
    });

    it('should not track events when stopped', () => {
      collector.stop();

      const metricSpy = jest.fn();
      collector.on('metric', metricSpy);

      const connectEvent: ConnectionEvent = {
        type: 'connected',
        connectionId: 'conn-123',
        timestamp: new Date().toISOString(),
      };

      collector.trackConnection(connectEvent);

      expect(metricSpy).not.toHaveBeenCalled();
      expect(collector.getActiveConnectionCount()).toBe(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      collector.start();
    });

    it('should provide accurate statistics', () => {
      const stats = collector.getStats();
      expect(stats.id).toBe('connection-collector');
      expect(stats.status).toBe('running');
      expect(stats.metricsCollected).toBe(0);
      expect(stats.errorsCount).toBe(0);
    });

    it('should update metrics collected count', () => {
      const connectEvent: ConnectionEvent = {
        type: 'connected',
        connectionId: 'conn-123',
        timestamp: new Date().toISOString(),
      };

      collector.trackConnection(connectEvent);

      const stats = collector.getStats();
      expect(stats.metricsCollected).toBeGreaterThan(0);
    });
  });
});
