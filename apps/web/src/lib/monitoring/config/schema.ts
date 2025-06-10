/**
 * Real-time Monitoring Configuration Schema
 * Zod validation schemas for configuration validation
 */

import { z } from 'zod';

// Latency configuration schema
const LatencyConfigSchema = z.object({
  p99Critical: z.number().int().positive(),
  p99Warning: z.number().int().positive(),
});

// Connection configuration schema
const ConnectionConfigSchema = z.object({
  maxConnections: z.number().int().positive(),
  heartbeatInterval: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
});

// Metrics configuration schema
const MetricsConfigSchema = z.object({
  bufferSize: z.number().int().positive(),
  flushInterval: z.number().int().positive(),
  enableResourceMetrics: z.boolean(),
  enableThroughputMetrics: z.boolean(),
  enableConnectionMetrics: z.boolean(),
  enableQueueMetrics: z.boolean(),
});

// Storage configuration schema
const StorageConfigSchema = z.object({
  type: z.enum(['supabase', 'inmemory', 'custom']),
  batchSize: z.number().int().positive(),
  maxRetries: z.number().int().nonnegative(),
});

// Supported alert channels
const AlertChannelSchema = z.enum(['email', 'webhook', 'slack']);

// Alerts configuration schema
const AlertsConfigSchema = z.object({
  enabled: z.boolean(),
  cooldownMs: z.number().int().positive(),
  channels: z.array(AlertChannelSchema),
});

// Collector configuration schemas
const ConnectionCollectorSchema = z.object({
  enabled: z.boolean(),
  sampleRate: z.number().min(0).max(1),
});

const ThroughputCollectorSchema = z.object({
  enabled: z.boolean(),
  sampleRate: z.number().min(0).max(1),
  aggregationWindow: z.number().int().positive(),
});

const ResourceCollectorSchema = z.object({
  enabled: z.boolean(),
  sampleInterval: z.number().int().positive(),
});

const QueueDepthCollectorSchema = z.object({
  enabled: z.boolean(),
  sampleInterval: z.number().int().positive(),
});

const CollectorsConfigSchema = z.object({
  connection: ConnectionCollectorSchema,
  throughput: ThroughputCollectorSchema,
  resource: ResourceCollectorSchema,
  queueDepth: QueueDepthCollectorSchema,
});

// Main configuration schema
export const RealtimeConfigSchema = z.object({
  enabled: z.boolean(),
  retentionDays: z.number().int().positive(),
  samplingRate: z.number().min(0).max(1),
  latency: LatencyConfigSchema,
  connection: ConnectionConfigSchema,
  metrics: MetricsConfigSchema,
  storage: StorageConfigSchema,
  alerts: AlertsConfigSchema,
  collectors: CollectorsConfigSchema,
});

// Type inference from schema
export type RealtimeConfigType = z.infer<typeof RealtimeConfigSchema>;

// Validation helper functions
export function validateRealtimeConfig(config: unknown): RealtimeConfigType {
  return RealtimeConfigSchema.parse(config);
}

export function isValidRealtimeConfig(
  config: unknown
): config is RealtimeConfigType {
  return RealtimeConfigSchema.safeParse(config).success;
}

// Environment variable schema
export const RealtimeEnvSchema = z.object({
  NEXT_PUBLIC_REALTIME_MONITORING_ENABLED: z.string().optional(),
  REALTIME_MONITORING_RETENTION_DAYS: z.string().optional(),
  REALTIME_MONITORING_SAMPLING_RATE: z.string().optional(),
  REALTIME_LATENCY_P99_WARN: z.string().optional(),
  REALTIME_LATENCY_P99_CRIT: z.string().optional(),
  REALTIME_MONITORING_STORE: z.string().optional(),
  REALTIME_CONNECTION_MAX: z.string().optional(),
  REALTIME_HEARTBEAT_INTERVAL: z.string().optional(),
  REALTIME_TIMEOUT_MS: z.string().optional(),
  REALTIME_BUFFER_SIZE: z.string().optional(),
  REALTIME_FLUSH_INTERVAL: z.string().optional(),
  REALTIME_BATCH_SIZE: z.string().optional(),
  REALTIME_MAX_RETRIES: z.string().optional(),
  REALTIME_ALERTS_ENABLED: z.string().optional(),
  REALTIME_ALERTS_COOLDOWN: z.string().optional(),
  REALTIME_ALERTS_CHANNELS: z.string().optional(),
});

export type RealtimeEnvType = z.infer<typeof RealtimeEnvSchema>;

// Validation for environment variables
export function validateRealtimeEnv(env: unknown): RealtimeEnvType {
  return RealtimeEnvSchema.parse(env);
}
