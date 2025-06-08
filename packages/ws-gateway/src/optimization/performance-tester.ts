/**
 * Performance Testing Framework
 *
 * Comprehensive load testing and performance validation
 * for WebSocket Gateway optimizations
 *
 * Part of LUM-584 Performance Optimization Phase 3
 */

import { WebSocket } from 'ws';

import { logger } from '../utils/logger';

export interface LoadTestConfig {
  concurrentConnections: number;
  messagesPerConnection: number;
  messageInterval: number;
  testDuration: number;
  rampUpTime: number;
  messageSize: number;
}

export interface PerformanceMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  connectionTime: number;
  testDuration: number;
}

export interface ConnectionResult {
  connectionId: string;
  connected: boolean;
  connectionTime: number;
  messagesSent: number;
  messagesReceived: number;
  latencies: number[];
  errors: string[];
  pendingMessages: Map<string, number>;
}

export class PerformanceTester {
  private connections: WebSocket[] = [];
  private results: ConnectionResult[] = [];
  private resultMap: Map<string, ConnectionResult> = new Map();
  private isRunning = false;

  constructor(
    private readonly gatewayUrl: string,
    private readonly authToken: string
  ) {}

  /**
   * Run comprehensive load test
   */
  async runLoadTest(config: LoadTestConfig): Promise<PerformanceMetrics> {
    if (this.isRunning) {
      throw new Error('Load test already running');
    }

    this.isRunning = true;
    this.connections = [];
    this.results = [];

    logger.info('Starting load test', config);

    const startTime = Date.now();

    try {
      // Phase 1: Ramp up connections
      await this.rampUpConnections(config);

      // Phase 2: Send messages
      await this.sendMessages(config);

      // Phase 3: Wait for test duration
      await this.waitForTestCompletion(config);

      // Phase 4: Cleanup
      await this.cleanup();

      const endTime = Date.now();
      const metrics = this.calculateMetrics(startTime, endTime);

      logger.info('Load test completed', metrics);
      return metrics;
    } catch (error) {
      logger.error('Load test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.cleanup();
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run latency benchmark test
   */
  async runLatencyTest(samples: number = 100): Promise<{
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    minLatency: number;
    maxLatency: number;
  }> {
    const latencies: number[] = [];

    logger.info('Starting latency test', { samples });

    for (let i = 0; i < samples; i++) {
      const latency = await this.measureSingleLatency();
      latencies.push(latency);

      // Small delay between samples
      await new Promise(resolve => globalThis.setTimeout(resolve, 100));
    }

    latencies.sort((a, b) => a - b);

    const averageLatency =
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const result = {
      averageLatency,
      p95Latency: latencies[p95Index],
      p99Latency: latencies[p99Index],
      minLatency: latencies[0],
      maxLatency: latencies[latencies.length - 1],
    };

    logger.info('Latency test completed', result);
    return result;
  }

  /**
   * Test connection stability under load
   */
  async runStabilityTest(duration: number = 300000): Promise<{
    totalConnections: number;
    stableConnections: number;
    droppedConnections: number;
    reconnections: number;
    stabilityRate: number;
  }> {
    const connections = 50; // Moderate load for stability test
    const results = {
      totalConnections: connections,
      stableConnections: 0,
      droppedConnections: 0,
      reconnections: 0,
      stabilityRate: 0,
    };

    logger.info('Starting stability test', { connections, duration });

    const connectionPromises = Array.from({ length: connections }, (_, i) =>
      this.createStabilityConnection(i, duration)
    );

    const connectionResults = await Promise.allSettled(connectionPromises);

    connectionResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const connResult = result.value;
        if (connResult.stable) {
          results.stableConnections++;
        } else {
          results.droppedConnections++;
        }
        results.reconnections += connResult.reconnections;
      } else {
        results.droppedConnections++;
        logger.warn('Stability connection failed', {
          index,
          error: result.reason,
        });
      }
    });

    results.stabilityRate =
      results.stableConnections / results.totalConnections;

    logger.info('Stability test completed', results);
    return results;
  }

  /**
   * Ramp up connections gradually
   */
  private async rampUpConnections(config: LoadTestConfig): Promise<void> {
    // Guard against zero rampUpTime to avoid division by zero
    const ramp = Math.max(config.rampUpTime, 1); // at least 1 ms
    const connectionsPerSecond = config.concurrentConnections / (ramp / 1000);
    const interval = 1000 / connectionsPerSecond;

    for (let i = 0; i < config.concurrentConnections; i++) {
      const connectionPromise = this.createTestConnection(i, config);
      connectionPromise.catch(error => {
        logger.warn('Connection failed during ramp up', {
          connectionIndex: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      if (i < config.concurrentConnections - 1) {
        await new Promise(resolve => globalThis.setTimeout(resolve, interval));
      }
    }

    // Wait for all connections to be established
    await new Promise(resolve => globalThis.setTimeout(resolve, 2000));
  }

  /**
   * Send messages from all connections
   */
  private async sendMessages(config: LoadTestConfig): Promise<void> {
    const messagePromises = this.connections.map((ws, index) =>
      this.sendMessagesFromConnection(ws, index, config)
    );

    await Promise.allSettled(messagePromises);
  }

  /**
   * Create a test connection
   */
  private async createTestConnection(
    index: number,
    _config: LoadTestConfig
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionId = `test_${index}`;
      const startTime = Date.now();

      const ws = new WebSocket(`${this.gatewayUrl}?token=${this.authToken}`);

      const result: ConnectionResult = {
        connectionId,
        connected: false,
        connectionTime: 0,
        messagesSent: 0,
        messagesReceived: 0,
        latencies: [],
        errors: [],
        pendingMessages: new Map<string, number>(),
      };

      ws.on('open', () => {
        result.connected = true;
        result.connectionTime = Date.now() - startTime;
        this.connections.push(ws);
        resolve();
      });

      ws.on('message', data => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === 'pong' && response.data?.messageId) {
            const messageId = response.data.messageId;
            const sentTime = result.pendingMessages.get(messageId);
            if (sentTime) {
              const latency = Date.now() - sentTime;
              result.latencies.push(latency);
              result.messagesReceived++;
              result.pendingMessages.delete(messageId);
            }
          }
        } catch {
          // Ignore parsing errors for non-JSON responses
        }
      });

      ws.on('error', error => {
        result.errors.push(error.message);
        reject(error);
      });

      // Record result immediately when connection is established
      this.results.push(result);
      this.resultMap.set(connectionId, result);

      ws.on('close', () => {
        // Connection metrics are already tracked in real-time
        // No need to update here as result is already in arrays
      });

      // Timeout after 10 seconds
      globalThis.setTimeout(() => {
        if (!result.connected) {
          result.errors.push('Connection timeout');
          ws.terminate();
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Send messages from a single connection
   */
  private async sendMessagesFromConnection(
    ws: WebSocket,
    connectionIndex: number,
    _config: LoadTestConfig
  ): Promise<void> {
    // Use O(1) map lookup instead of O(N) array find
    const connectionId = `test_${connectionIndex}`;
    const result = this.resultMap.get(connectionId);
    if (!result) return;

    for (let i = 0; i < _config.messagesPerConnection; i++) {
      if (ws.readyState !== WebSocket.OPEN) {
        result.errors.push('Connection closed during message sending');
        break;
      }

      const messageStart = Date.now();
      const messageId = `${connectionIndex}_${i}_${messageStart}`;
      const message = {
        action: 'ping',
        data: {
          messageId,
          index: i,
          payload: 'x'.repeat(_config.messageSize),
          timestamp: messageStart,
        },
      };

      try {
        // Track message for latency measurement
        result.pendingMessages.set(messageId, messageStart);
        ws.send(JSON.stringify(message));
        result.messagesSent++;
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      if (i < _config.messagesPerConnection - 1) {
        await new Promise(resolve =>
          globalThis.setTimeout(resolve, _config.messageInterval)
        );
      }
    }

    // Wait for remaining responses with timeout
    const maxWaitTime = 5000; // 5 seconds
    const waitStart = Date.now();
    while (
      result.pendingMessages.size > 0 &&
      Date.now() - waitStart < maxWaitTime
    ) {
      await new Promise(resolve => globalThis.setTimeout(resolve, 100));
    }

    // Mark remaining messages as timed out
    if (result.pendingMessages.size > 0) {
      result.errors.push(`${result.pendingMessages.size} messages timed out`);
      result.pendingMessages.clear();
    }
  }

  /**
   * Measure single round-trip latency
   */
  private async measureSingleLatency(): Promise<number> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.gatewayUrl}?token=${this.authToken}`);

      ws.on('open', () => {
        const pingStart = Date.now();
        ws.send(
          JSON.stringify({ action: 'ping', data: { timestamp: pingStart } })
        );

        ws.on('message', () => {
          const latency = Date.now() - pingStart;
          ws.close();
          resolve(latency);
        });
      });

      ws.on('error', reject);

      // Timeout after 5 seconds
      globalThis.setTimeout(() => {
        ws.terminate();
        reject(new Error('Latency test timeout'));
      }, 5000);
    });
  }

  /**
   * Create stability test connection
   */
  private async createStabilityConnection(
    index: number,
    duration: number
  ): Promise<{ stable: boolean; reconnections: number }> {
    return new Promise(resolve => {
      let reconnections = 0;
      let stable = true;
      const endTime = Date.now() + duration;

      const connect = () => {
        const ws = new WebSocket(`${this.gatewayUrl}?token=${this.authToken}`);

        ws.on('open', () => {
          // Send periodic pings to keep connection alive
          const pingInterval = globalThis.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN && Date.now() < endTime) {
              ws.send(JSON.stringify({ action: 'ping', data: {} }));
            } else {
              globalThis.clearInterval(pingInterval);
              if (Date.now() >= endTime) {
                ws.close();
                resolve({ stable, reconnections });
              }
            }
          }, 5000);
        });

        ws.on('close', () => {
          if (Date.now() < endTime) {
            stable = false;
            reconnections++;
            // Attempt to reconnect
            globalThis.setTimeout(connect, 1000);
          }
        });

        ws.on('error', () => {
          stable = false;
        });
      };

      connect();
    });
  }

  /**
   * Wait for test completion
   */
  private async waitForTestCompletion(config: LoadTestConfig): Promise<void> {
    await new Promise(resolve =>
      globalThis.setTimeout(resolve, config.testDuration)
    );
  }

  /**
   * Cleanup all connections
   */
  private async cleanup(): Promise<void> {
    const closePromises = this.connections.map(ws => {
      return new Promise<void>(resolve => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        ws.on('close', () => resolve());
        ws.on('error', () => resolve());
        // Force close after 1 second
        globalThis.setTimeout(() => {
          ws.terminate();
          resolve();
        }, 1000);
      });
    });

    await Promise.allSettled(closePromises);
    this.connections = [];
    this.resultMap.clear();
  }

  /**
   * Calculate performance metrics from results
   */
  private calculateMetrics(
    startTime: number,
    endTime: number
  ): PerformanceMetrics {
    const totalConnections = this.results.length;
    const successfulConnections = this.results.filter(r => r.connected).length;
    const failedConnections = totalConnections - successfulConnections;

    const totalMessages = this.results.reduce(
      (sum, r) => sum + r.messagesSent,
      0
    );
    const successfulMessages = this.results.reduce(
      (sum, r) => sum + r.messagesReceived,
      0
    );
    const failedMessages = totalMessages - successfulMessages;

    const allLatencies = this.results
      .flatMap(r => r.latencies)
      .sort((a, b) => a - b);
    const averageLatency =
      allLatencies.length > 0
        ? allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length
        : 0;

    const p95Index = Math.floor(allLatencies.length * 0.95);
    const p99Index = Math.floor(allLatencies.length * 0.99);

    const testDuration = endTime - startTime;
    // Prevent division by zero and ensure realistic throughput calculation
    const throughput =
      testDuration > 0 ? successfulMessages / (testDuration / 1000) : 0;

    return {
      totalConnections,
      successfulConnections,
      failedConnections,
      totalMessages,
      successfulMessages,
      failedMessages,
      averageLatency,
      p95Latency: allLatencies[p95Index] || 0,
      p99Latency: allLatencies[p99Index] || 0,
      throughput,
      errorRate:
        totalConnections > 0 ? failedConnections / totalConnections : 0,
      connectionTime:
        totalConnections > 0
          ? this.results.reduce((sum, r) => sum + r.connectionTime, 0) /
            totalConnections
          : 0,
      testDuration,
    };
  }
}
