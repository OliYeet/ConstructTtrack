/**
 * Configuration for WebSocket Gateway
 * Based on Charlie's deployment considerations
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  // Server configuration
  port: parseInt(process.env.WS_GATEWAY_PORT || '8080', 10),

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
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // WebSocket configuration
  websocket: {
    pingInterval: 25000, // 25 seconds as per Charlie's spec
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000', 10),
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
