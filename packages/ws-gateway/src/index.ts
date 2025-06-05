/**
 * WebSocket Gateway Entry Point
 * Real-time infrastructure for ConstructTrack
 * Following Charlie's containerized deployment strategy
 */

import { config } from './config';
import { WebSocketGateway } from './gateway';
import { SupabaseBridge } from './supabase-bridge';
import { logger } from './utils/logger';

let gateway: WebSocketGateway;
let supabaseBridge: SupabaseBridge;

async function main() {
  try {
    logger.info('Starting ConstructTrack WebSocket Gateway', {
      version: '0.1.0',
      environment: config.environment,
      port: config.server.port,
      redisEnabled: config.redis.enabled,
    });

    // Initialize WebSocket Gateway
    gateway = new WebSocketGateway();

    // Initialize Supabase Bridge for real-time events
    supabaseBridge = new SupabaseBridge(gateway);

    // Start services
    await gateway.start(config.server.port);
    await supabaseBridge.start();

    logger.info('WebSocket Gateway started successfully', {
      port: config.server.port,
      healthCheck: `http://localhost:${config.server.port}/healthz`,
    });
  } catch (error) {
    logger.error('Failed to start WebSocket Gateway:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown() {
  logger.info('Shutting down WebSocket Gateway gracefully');

  try {
    if (supabaseBridge) {
      await supabaseBridge.stop();
    }

    if (gateway) {
      await gateway.stop();
    }

    logger.info('WebSocket Gateway shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', { promise, reason });
  process.exit(1);
});

main();
