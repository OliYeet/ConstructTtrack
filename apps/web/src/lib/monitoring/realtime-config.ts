/**
 * Enhanced Real-time Monitoring Configuration
 *
 * Provides configuration management for the extended monitoring system
 * with support for multiple metric collectors, aggregation, and export.
 */

import {
  defaultRealtimeMonitoringConfig,
  RealtimeMonitoringConfig,
} from './realtime-metrics';

// Extended configuration for enhanced monitoring
export interface EnhancedRealtimeMonitoringConfig
  extends RealtimeMonitoringConfig {
  // Metric collector configuration
  collectors: {
    resource: {
      enabled: boolean;
      interval: number; // Collection interval in ms
      metrics: {
        cpu: boolean;
        memory: boolean;
        diskIO: boolean;
        networkIO: boolean;
      };
    };
    aggregate: {
      enabled: boolean;
      interval: number; // Aggregation interval in ms
      retentionPeriods: {
        hourly: number; // Hours to keep hourly aggregates
        daily: number; // Days to keep daily aggregates
        weekly: number; // Weeks to keep weekly aggregates
      };
    };
    export: {
      prometheus: {
        enabled: boolean;
        endpoint: string;
        interval: number; // Export interval in ms
      };
      openTelemetry: {
        enabled: boolean;
        endpoint: string;
        headers: Record<string, string>;
      };
    };
  };

  // Storage configuration
  storage: {
    enabled: boolean;
    provider: 'supabase' | 'memory' | 'redis';
    retentionPeriod: number; // How long to keep raw metrics (ms)
    batchSize: number; // Number of metrics to batch for storage
    flushInterval: number; // How often to flush to storage (ms)
  };

  // Dashboard configuration
  dashboard: {
    enabled: boolean;
    refreshInterval: number; // Dashboard refresh interval (ms)
    defaultTimeRange: number; // Default time range for charts (ms)
    maxDataPoints: number; // Maximum data points per chart
  };
}

// Environment variable configuration
export interface MonitoringEnvironmentConfig {
  // Core monitoring
  REALTIME_MONITORING_ENABLED?: string;
  REALTIME_MONITORING_SAMPLING_RATE?: string;
  REALTIME_MONITORING_RETENTION_PERIOD?: string;

  // Resource monitoring
  RESOURCE_MONITORING_ENABLED?: string;
  RESOURCE_MONITORING_INTERVAL?: string;
  CPU_MONITORING_ENABLED?: string;
  MEMORY_MONITORING_ENABLED?: string;
  DISK_IO_MONITORING_ENABLED?: string;
  NETWORK_IO_MONITORING_ENABLED?: string;

  // Aggregation
  AGGREGATE_MONITORING_ENABLED?: string;
  AGGREGATE_MONITORING_INTERVAL?: string;
  HOURLY_RETENTION_HOURS?: string;
  DAILY_RETENTION_DAYS?: string;
  WEEKLY_RETENTION_WEEKS?: string;

  // Export
  PROMETHEUS_EXPORT_ENABLED?: string;
  PROMETHEUS_ENDPOINT?: string;
  PROMETHEUS_EXPORT_INTERVAL?: string;
  OPENTELEMETRY_EXPORT_ENABLED?: string;
  OPENTELEMETRY_ENDPOINT?: string;
  OPENTELEMETRY_HEADERS?: string;

  // Storage
  MONITORING_STORAGE_ENABLED?: string;
  MONITORING_STORAGE_PROVIDER?: string;
  MONITORING_STORAGE_RETENTION?: string;
  MONITORING_STORAGE_BATCH_SIZE?: string;
  MONITORING_STORAGE_FLUSH_INTERVAL?: string;

  // Dashboard
  MONITORING_DASHBOARD_ENABLED?: string;
  MONITORING_DASHBOARD_REFRESH?: string;
  MONITORING_DASHBOARD_TIME_RANGE?: string;
  MONITORING_DASHBOARD_MAX_POINTS?: string;
}

// Default enhanced configuration
export const defaultEnhancedMonitoringConfig: EnhancedRealtimeMonitoringConfig =
  {
    ...defaultRealtimeMonitoringConfig,

    collectors: {
      resource: {
        enabled: true,
        interval: 30000, // 30 seconds
        metrics: {
          cpu: true,
          memory: true,
          diskIO: false, // Disabled by default for performance
          networkIO: false, // Disabled by default for performance
        },
      },
      aggregate: {
        enabled: true,
        interval: 300000, // 5 minutes
        retentionPeriods: {
          hourly: 168, // 7 days of hourly data
          daily: 90, // 90 days of daily data
          weekly: 52, // 52 weeks of weekly data
        },
      },
      export: {
        prometheus: {
          enabled: false, // Disabled by default
          endpoint: '/metrics',
          interval: 60000, // 1 minute
        },
        openTelemetry: {
          enabled: false, // Disabled by default
          endpoint: '',
          headers: {},
        },
      },
    },

    storage: {
      enabled: true,
      provider: 'supabase',
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      batchSize: 100,
      flushInterval: 30000, // 30 seconds
    },

    dashboard: {
      enabled: true,
      refreshInterval: 30000, // 30 seconds
      defaultTimeRange: 24 * 60 * 60 * 1000, // 24 hours
      maxDataPoints: 1000,
    },
  };

// Configuration loader with environment variable support
export class MonitoringConfigLoader {
  private static instance: MonitoringConfigLoader;
  private config: EnhancedRealtimeMonitoringConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): MonitoringConfigLoader {
    if (!MonitoringConfigLoader.instance) {
      MonitoringConfigLoader.instance = new MonitoringConfigLoader();
    }
    return MonitoringConfigLoader.instance;
  }

  getConfig(): EnhancedRealtimeMonitoringConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<EnhancedRealtimeMonitoringConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private loadConfiguration(): EnhancedRealtimeMonitoringConfig {
    const env = process.env as MonitoringEnvironmentConfig;
    const config = { ...defaultEnhancedMonitoringConfig };

    // Core monitoring
    if (env.REALTIME_MONITORING_ENABLED !== undefined) {
      config.enabled = env.REALTIME_MONITORING_ENABLED === 'true';
    }
    if (env.REALTIME_MONITORING_SAMPLING_RATE) {
      config.samplingRate = parseFloat(env.REALTIME_MONITORING_SAMPLING_RATE);
    }
    if (env.REALTIME_MONITORING_RETENTION_PERIOD) {
      config.metricsRetentionPeriod = parseInt(
        env.REALTIME_MONITORING_RETENTION_PERIOD
      );
    }

    // Resource monitoring
    if (env.RESOURCE_MONITORING_ENABLED !== undefined) {
      config.collectors.resource.enabled =
        env.RESOURCE_MONITORING_ENABLED === 'true';
    }
    if (env.RESOURCE_MONITORING_INTERVAL) {
      config.collectors.resource.interval = parseInt(
        env.RESOURCE_MONITORING_INTERVAL
      );
    }
    if (env.CPU_MONITORING_ENABLED !== undefined) {
      config.collectors.resource.metrics.cpu =
        env.CPU_MONITORING_ENABLED === 'true';
    }
    if (env.MEMORY_MONITORING_ENABLED !== undefined) {
      config.collectors.resource.metrics.memory =
        env.MEMORY_MONITORING_ENABLED === 'true';
    }

    // Storage
    if (env.MONITORING_STORAGE_ENABLED !== undefined) {
      config.storage.enabled = env.MONITORING_STORAGE_ENABLED === 'true';
    }
    if (env.MONITORING_STORAGE_PROVIDER) {
      config.storage.provider = env.MONITORING_STORAGE_PROVIDER as
        | 'supabase'
        | 'memory'
        | 'redis';
    }

    // Export
    if (env.PROMETHEUS_EXPORT_ENABLED !== undefined) {
      config.collectors.export.prometheus.enabled =
        env.PROMETHEUS_EXPORT_ENABLED === 'true';
    }
    if (env.PROMETHEUS_ENDPOINT) {
      config.collectors.export.prometheus.endpoint = env.PROMETHEUS_ENDPOINT;
    }

    return config;
  }

  // Validate configuration
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.config;

    // Validate intervals
    if (config.collectors.resource.interval < 1000) {
      errors.push('Resource monitoring interval must be at least 1000ms');
    }
    if (config.collectors.aggregate.interval < 60000) {
      errors.push(
        'Aggregate monitoring interval must be at least 60000ms (1 minute)'
      );
    }

    // Validate retention periods
    if (config.storage.retentionPeriod < 3600000) {
      errors.push('Storage retention period must be at least 1 hour');
    }

    // Validate storage configuration
    if (
      config.storage.enabled &&
      !['supabase', 'memory', 'redis'].includes(config.storage.provider)
    ) {
      errors.push(
        'Invalid storage provider. Must be one of: supabase, memory, redis'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const monitoringConfig = MonitoringConfigLoader.getInstance();

// Utility functions
export function getMonitoringConfig(): EnhancedRealtimeMonitoringConfig {
  return monitoringConfig.getConfig();
}

export function updateMonitoringConfig(
  updates: Partial<EnhancedRealtimeMonitoringConfig>
): void {
  monitoringConfig.updateConfig(updates);
}

export function validateMonitoringConfig(): {
  valid: boolean;
  errors: string[];
} {
  return monitoringConfig.validateConfig();
}
