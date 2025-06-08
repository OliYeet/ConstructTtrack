/**
 * Default Real-time Monitoring Configuration
 * Based on Charlie's implementation blueprint for LUM-585
 */

export interface RealtimeMonitoringConfig {
  enabled: boolean;
  retentionDays: number;
  samplingRate: number;
  latency: {
    p99Critical: number;
    p99Warning: number;
  };
  connection: {
    maxConnections: number;
    heartbeatInterval: number;
    timeoutMs: number;
  };
  metrics: {
    bufferSize: number;
    flushInterval: number;
    enableResourceMetrics: boolean;
    enableThroughputMetrics: boolean;
    enableConnectionMetrics: boolean;
    enableQueueMetrics: boolean;
  };
  storage: {
    type: 'supabase' | 'inmemory' | 'custom';
    batchSize: number;
    maxRetries: number;
  };
  alerts: {
    enabled: boolean;
    cooldownMs: number;
    channels: string[];
  };
  collectors: {
    connection: {
      enabled: boolean;
      sampleRate: number;
    };
    throughput: {
      enabled: boolean;
      sampleRate: number;
      aggregationWindow: number;
    };
    resource: {
      enabled: boolean;
      sampleInterval: number;
    };
    queueDepth: {
      enabled: boolean;
      sampleInterval: number;
    };
  };
}

export const defaultRealtimeMonitoringConfig: RealtimeMonitoringConfig = {
  enabled: true,
  retentionDays: 7,
  samplingRate: 1.0, // 100% sampling by default
  latency: {
    p99Critical: 500, // 500ms
    p99Warning: 250, // 250ms
  },
  connection: {
    maxConnections: 1000,
    heartbeatInterval: 30000, // 30 seconds
    timeoutMs: 60000, // 60 seconds
  },
  metrics: {
    bufferSize: 1000,
    flushInterval: 60000, // 1 minute
    enableResourceMetrics: true,
    enableThroughputMetrics: true,
    enableConnectionMetrics: true,
    enableQueueMetrics: true,
  },
  storage: {
    type: 'supabase',
    batchSize: 100,
    maxRetries: 3,
  },
  alerts: {
    enabled: true,
    cooldownMs: 300000, // 5 minutes
    channels: ['email', 'webhook'],
  },
  collectors: {
    connection: {
      enabled: true,
      sampleRate: 1.0,
    },
    throughput: {
      enabled: true,
      sampleRate: 0.1, // 10% sampling for high-volume metrics
      aggregationWindow: 5000, // 5 seconds
    },
    resource: {
      enabled: true,
      sampleInterval: 5000, // 5 seconds
    },
    queueDepth: {
      enabled: true,
      sampleInterval: 5000, // 5 seconds
    },
  },
};

// Environment-specific overrides
export const developmentOverrides: Partial<RealtimeMonitoringConfig> = {
  retentionDays: 1,
  samplingRate: 0.5, // 50% sampling in development
  storage: {
    type: 'inmemory',
    batchSize: 10,
    maxRetries: 1,
  },
  alerts: {
    enabled: false,
    cooldownMs: 60000, // 1 minute
    channels: [],
  },
};

export const productionOverrides: Partial<RealtimeMonitoringConfig> = {
  retentionDays: 30,
  samplingRate: 1.0,
  storage: {
    type: 'supabase',
    batchSize: 500,
    maxRetries: 5,
  },
  alerts: {
    enabled: true,
    cooldownMs: 300000, // 5 minutes
    channels: ['email', 'webhook', 'slack'],
  },
};
