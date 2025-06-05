/**
 * Configuration for WebSocket Gateway
 * Based on Charlie's deployment considerations
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  // Server configuration
  server: {
    port: (() => {
      const port = parseInt(process.env.WS_GATEWAY_PORT || '8080', 10);
      if (isNaN(port) || port <= 0 || port > 65535) {
        throw new Error(
          `Invalid WS_GATEWAY_PORT: ${process.env.WS_GATEWAY_PORT}. Must be a number between 1-65535`
        );
      }
      return port;
    })(),
  },

  // Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || '',
    publicKey: process.env.JWT_SECRET_PUBLIC,
  },

  // Redis configuration (optional)
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: (() => {
      if (process.env.REDIS_ENABLED === 'true') {
        if (!process.env.REDIS_URL) {
          throw new Error('REDIS_URL is required when REDIS_ENABLED=true');
        }
        return process.env.REDIS_URL;
      }
      return process.env.REDIS_URL || 'redis://localhost:6379';
    })(),
  },

  // WebSocket configuration
  websocket: {
    pingInterval: 25000, // 25 seconds as per Charlie's spec
    maxConnections: (() => {
      const maxConn = parseInt(process.env.WS_MAX_CONNECTIONS || '1000', 10);
      if (isNaN(maxConn) || maxConn <= 0) {
        throw new Error(
          `Invalid WS_MAX_CONNECTIONS: ${process.env.WS_MAX_CONNECTIONS}. Must be a positive number`
        );
      }
      return maxConn;
    })(),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;

// Validate required configuration
function validateConfig() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

validateConfig();
