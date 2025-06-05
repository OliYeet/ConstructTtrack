/**
 * ConstructTrack WebSocket Gateway
 *
 * Implements Charlie's specification for LUM-591:
 * - Thin WebSocket Gateway between clients and Supabase
 * - Server-side Supabase subscriptions with client fan-out
 * - JWT authentication and room-based authorization
 * - Protocol-compliant message mapping
 */

import { createServer } from 'http';

import { WebSocketServer } from 'ws';

import { config } from './config';
import { WebSocketGateway } from './gateway';
import { logger } from './utils/logger';

async function startServer() {
  try {
    // Create HTTP server for health checks
    const server = createServer((req, res) => {
      if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '0.1.0',
          })
        );
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    // Create WebSocket server
    const wss = new WebSocketServer({
      server,
      path: '/realtime',
    });

    // Initialize WebSocket Gateway
    const gateway = new WebSocketGateway(wss);
    await gateway.initialize();

    // Start server
    const port = config.port;
    server.listen(port, () => {
      logger.info(`🚀 WebSocket Gateway started on port ${port}`);
      logger.info(
        `📡 Health check available at http://localhost:${port}/healthz`
      );
      logger.info(`🔌 WebSocket endpoint: ws://localhost:${port}/realtime`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      await gateway.shutdown();
      server.close(() => {
        logger.info('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, shutting down gracefully...');
      await gateway.shutdown();
      server.close(() => {
        logger.info('✅ Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('❌ Failed to start WebSocket Gateway:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
