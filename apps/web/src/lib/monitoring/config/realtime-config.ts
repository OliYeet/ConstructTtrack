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

  const envConfig: Partial<RealtimeMonitoringConfig> = {};

  // Only set values that are actually provided in environment
  if (env.NEXT_PUBLIC_REALTIME_MONITORING_ENABLED !== undefined) {
    envConfig.enabled = env.NEXT_PUBLIC_REALTIME_MONITORING_ENABLED === 'true';
  }

  if (env.REALTIME_MONITORING_RETENTION_DAYS) {
    envConfig.retentionDays = parseInt(
      env.REALTIME_MONITORING_RETENTION_DAYS,
      10
    );
  }

  if (env.REALTIME_MONITORING_SAMPLING_RATE) {
    envConfig.samplingRate = parseFloat(env.REALTIME_MONITORING_SAMPLING_RATE);
  }

  // Latency config
  const latencyConfig: Partial<RealtimeMonitoringConfig['latency']> = {};
  if (env.REALTIME_LATENCY_P99_CRIT) {
    latencyConfig.p99Critical = parseInt(env.REALTIME_LATENCY_P99_CRIT, 10);
  }
  if (env.REALTIME_LATENCY_P99_WARN) {
    latencyConfig.p99Warning = parseInt(env.REALTIME_LATENCY_P99_WARN, 10);
  }
  if (Object.keys(latencyConfig).length > 0) {
    envConfig.latency = latencyConfig as RealtimeMonitoringConfig['latency'];
  }

  // Connection config
  const connectionConfig: Partial<RealtimeMonitoringConfig['connection']> = {};
  if (env.REALTIME_CONNECTION_MAX) {
    connectionConfig.maxConnections = parseInt(env.REALTIME_CONNECTION_MAX, 10);
  }
  if (env.REALTIME_HEARTBEAT_INTERVAL) {
    connectionConfig.heartbeatInterval = parseInt(
      env.REALTIME_HEARTBEAT_INTERVAL,
      10
    );
  }
  if (env.REALTIME_TIMEOUT_MS) {
    connectionConfig.timeoutMs = parseInt(env.REALTIME_TIMEOUT_MS, 10);
  }
  if (Object.keys(connectionConfig).length > 0) {
    envConfig.connection =
      connectionConfig as RealtimeMonitoringConfig['connection'];
  }

  // Metrics config
  const metricsConfig: Partial<RealtimeMonitoringConfig['metrics']> = {};
  if (env.REALTIME_BUFFER_SIZE) {
    metricsConfig.bufferSize = parseInt(env.REALTIME_BUFFER_SIZE, 10);
  }
  if (env.REALTIME_FLUSH_INTERVAL) {
    metricsConfig.flushInterval = parseInt(env.REALTIME_FLUSH_INTERVAL, 10);
  }
  if (Object.keys(metricsConfig).length > 0) {
    envConfig.metrics = metricsConfig as RealtimeMonitoringConfig['metrics'];
  }

  // Storage config
  const storageConfig: Partial<RealtimeMonitoringConfig['storage']> = {};
  if (env.REALTIME_MONITORING_STORE) {
    storageConfig.type = env.REALTIME_MONITORING_STORE as
      | 'supabase'
      | 'inmemory'
      | 'custom';
  }
  if (env.REALTIME_BATCH_SIZE) {
    storageConfig.batchSize = parseInt(env.REALTIME_BATCH_SIZE, 10);
  }
  if (env.REALTIME_MAX_RETRIES) {
    storageConfig.maxRetries = parseInt(env.REALTIME_MAX_RETRIES, 10);
  }
  if (Object.keys(storageConfig).length > 0) {
    envConfig.storage = storageConfig as RealtimeMonitoringConfig['storage'];
  }

  // Alerts config
  const alertsConfig: Partial<RealtimeMonitoringConfig['alerts']> = {};
  if (env.REALTIME_ALERTS_ENABLED !== undefined) {
    alertsConfig.enabled = env.REALTIME_ALERTS_ENABLED === 'true';
  }
  if (env.REALTIME_ALERTS_COOLDOWN) {
    alertsConfig.cooldownMs = parseInt(env.REALTIME_ALERTS_COOLDOWN, 10);
  }
  if (env.REALTIME_ALERTS_CHANNELS) {
    alertsConfig.channels = env.REALTIME_ALERTS_CHANNELS.split(',').map(c =>
      c.trim()
    );
  }
  if (Object.keys(alertsConfig).length > 0) {
    envConfig.alerts = alertsConfig as RealtimeMonitoringConfig['alerts'];
  }

  return envConfig;
}

// Deep merge utility function
// Note: Arrays are replaced entirely (not merged) which is intentional for config overrides
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

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
        result[key] = deepMerge(
          targetValue as any,
          sourceValue as any
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
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
