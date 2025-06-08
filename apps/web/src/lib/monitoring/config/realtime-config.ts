/**
 * Real-time Monitoring Configuration
 * Merged configuration from defaults and environment variables
 * Based on Charlie's implementation blueprint for LUM-585
 */

import {
  defaultRealtimeMonitoringConfig,
  developmentOverrides,
  productionOverrides,
  type RealtimeMonitoringConfig,
} from './defaults';
import { RealtimeConfigSchema, validateRealtimeEnv } from './schema';

// Get environment variables with validation
function getEnvConfig(): Partial<RealtimeMonitoringConfig> {
  // Validate environment variables first
  const env = validateRealtimeEnv(process.env);

  return {
    enabled: env.NEXT_PUBLIC_REALTIME_MONITORING_ENABLED === 'true',
    retentionDays: env.REALTIME_MONITORING_RETENTION_DAYS
      ? parseInt(env.REALTIME_MONITORING_RETENTION_DAYS, 10)
      : undefined,
    samplingRate: env.REALTIME_MONITORING_SAMPLING_RATE
      ? parseFloat(env.REALTIME_MONITORING_SAMPLING_RATE)
      : undefined,
    latency: {
      p99Critical: env.REALTIME_LATENCY_P99_CRIT
        ? parseInt(env.REALTIME_LATENCY_P99_CRIT, 10)
        : undefined,
      p99Warning: env.REALTIME_LATENCY_P99_WARN
        ? parseInt(env.REALTIME_LATENCY_P99_WARN, 10)
        : undefined,
    },
    connection: {
      maxConnections: env.REALTIME_CONNECTION_MAX
        ? parseInt(env.REALTIME_CONNECTION_MAX, 10)
        : undefined,
      heartbeatInterval: env.REALTIME_HEARTBEAT_INTERVAL
        ? parseInt(env.REALTIME_HEARTBEAT_INTERVAL, 10)
        : undefined,
      timeoutMs: env.REALTIME_TIMEOUT_MS
        ? parseInt(env.REALTIME_TIMEOUT_MS, 10)
        : undefined,
    },
    metrics: {
      bufferSize: env.REALTIME_BUFFER_SIZE
        ? parseInt(env.REALTIME_BUFFER_SIZE, 10)
        : undefined,
      flushInterval: env.REALTIME_FLUSH_INTERVAL
        ? parseInt(env.REALTIME_FLUSH_INTERVAL, 10)
        : undefined,
    },
    storage: {
      type:
        (env.REALTIME_MONITORING_STORE as 'supabase' | 'inmemory' | 'custom') ||
        undefined,
      batchSize: env.REALTIME_BATCH_SIZE
        ? parseInt(env.REALTIME_BATCH_SIZE, 10)
        : undefined,
      maxRetries: env.REALTIME_MAX_RETRIES
        ? parseInt(env.REALTIME_MAX_RETRIES, 10)
        : undefined,
    },
    alerts: {
      enabled: env.REALTIME_ALERTS_ENABLED === 'true',
      cooldownMs: env.REALTIME_ALERTS_COOLDOWN
        ? parseInt(env.REALTIME_ALERTS_COOLDOWN, 10)
        : undefined,
      channels: env.REALTIME_ALERTS_CHANNELS
        ? env.REALTIME_ALERTS_CHANNELS.split(',').map(c => c.trim())
        : undefined,
    },
  };
}

// Deep merge utility function
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue !== undefined) {
      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(sourceValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}

// Get environment-specific overrides
function getEnvironmentOverrides(): Partial<RealtimeMonitoringConfig> {
  const nodeEnv = process.env.NODE_ENV;

  switch (nodeEnv) {
    case 'development':
      return developmentOverrides;
    case 'production':
      return productionOverrides;
    case 'test':
      return {
        enabled: false,
        storage: { type: 'inmemory', batchSize: 1, maxRetries: 0 },
        alerts: { enabled: false, cooldownMs: 0, channels: [] },
      };
    default:
      return {};
  }
}

// Create the final configuration
function createRealtimeConfig(): RealtimeMonitoringConfig {
  // Start with defaults
  let config = { ...defaultRealtimeMonitoringConfig };

  // Apply environment-specific overrides
  config = deepMerge(config, getEnvironmentOverrides());

  // Apply environment variable overrides
  config = deepMerge(config, getEnvConfig());

  // Validate the final configuration
  return RealtimeConfigSchema.parse(config);
}

// Export the final configuration
export const realtimeConfig = createRealtimeConfig();

// Export configuration utilities
export { type RealtimeMonitoringConfig } from './defaults';
export { RealtimeConfigSchema, validateRealtimeConfig } from './schema';

// Configuration hot-reload support (for development)
export function reloadRealtimeConfig(): RealtimeMonitoringConfig {
  // Clear require cache for environment variables
  delete require.cache[require.resolve('./defaults')];
  delete require.cache[require.resolve('./schema')];

  return createRealtimeConfig();
}

// Configuration validation helper
export function isRealtimeMonitoringEnabled(): boolean {
  return realtimeConfig.enabled;
}

// Get collector-specific configuration
export function getCollectorConfig(
  collectorType: keyof RealtimeMonitoringConfig['collectors']
) {
  return realtimeConfig.collectors[collectorType];
}

// Get storage configuration
export function getStorageConfig() {
  return realtimeConfig.storage;
}

// Get alert configuration
export function getAlertConfig() {
  return realtimeConfig.alerts;
}
