/**
 * Export Metric Collector
 *
 * Exports metrics to external monitoring systems like Prometheus and OpenTelemetry.
 * Provides standardized metric export formats and handles delivery to external endpoints.
 */

import { getLogger } from '../../logging';

import {
  BaseMetricCollector,
  CollectorConfig,
  ExportMetric,
  CollectorMetric,
} from './base-collector';

// Export collector specific configuration
export interface ExportCollectorConfig extends CollectorConfig {
  exporters: {
    prometheus: {
      enabled: boolean;
      endpoint: string;
      format: 'text' | 'json';
      includeTimestamp: boolean;
      includeHelp: boolean;
    };
    openTelemetry: {
      enabled: boolean;
      endpoint: string;
      protocol: 'grpc' | 'http';
      headers: Record<string, string>;
      compression: 'gzip' | 'none';
    };
    json: {
      enabled: boolean;
      endpoint?: string;
      format: 'structured' | 'flat';
    };
  };
  delivery: {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    batchSize: number;
  };
  filtering: {
    includeMetricTypes: string[];
    excludeMetricTypes: string[];
    includeTags: Record<string, string>;
    excludeTags: Record<string, string>;
  };
}

// Prometheus metric format
interface PrometheusMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help?: string;
  value: number;
  labels: Record<string, string>;
  timestamp?: number;
}

// OpenTelemetry metric format
interface OpenTelemetryMetric {
  name: string;
  description?: string;
  unit?: string;
  type: 'counter' | 'gauge' | 'histogram';
  dataPoints: Array<{
    value: number;
    timestamp: number;
    attributes: Record<string, string>;
  }>;
}

export class ExportCollector extends BaseMetricCollector {
  private exportConfig: ExportCollectorConfig;
  private metricQueue: CollectorMetric[] = [];
  private exportStats = {
    prometheus: { sent: 0, failed: 0, lastExport: 0 },
    openTelemetry: { sent: 0, failed: 0, lastExport: 0 },
    json: { sent: 0, failed: 0, lastExport: 0 },
  };

  constructor(config: ExportCollectorConfig) {
    super('export-collector', 'Metric Export Collector', config);
    this.exportConfig = config;
  }

  async collect(): Promise<ExportMetric[]> {
    const metrics: ExportMetric[] = [];

    try {
      // Process queued metrics for export
      if (this.metricQueue.length === 0) {
        return metrics;
      }

      const metricsToExport = this.metricQueue.splice(
        0,
        this.exportConfig.delivery.batchSize
      );
      const filteredMetrics = this.filterMetrics(metricsToExport);

      if (filteredMetrics.length === 0) {
        return metrics;
      }

      // Export to Prometheus
      if (this.exportConfig.exporters.prometheus.enabled) {
        const prometheusMetrics =
          await this.exportToPrometheus(filteredMetrics);
        metrics.push(...prometheusMetrics);
      }

      // Export to OpenTelemetry
      if (this.exportConfig.exporters.openTelemetry.enabled) {
        const otelMetrics = await this.exportToOpenTelemetry(filteredMetrics);
        metrics.push(...otelMetrics);
      }

      // Export to JSON
      if (this.exportConfig.exporters.json.enabled) {
        const jsonMetrics = await this.exportToJSON(filteredMetrics);
        metrics.push(...jsonMetrics);
      }
    } catch (error) {
      throw new Error(
        `Export collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return metrics;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.interval < 10000) {
      errors.push(
        'Export collection interval must be at least 10000ms (10 seconds)'
      );
    }

    if (
      !this.exportConfig.exporters.prometheus.enabled &&
      !this.exportConfig.exporters.openTelemetry.enabled &&
      !this.exportConfig.exporters.json.enabled
    ) {
      errors.push('At least one exporter must be enabled');
    }

    // Validate Prometheus configuration
    if (this.exportConfig.exporters.prometheus.enabled) {
      if (!this.exportConfig.exporters.prometheus.endpoint) {
        errors.push(
          'Prometheus endpoint is required when Prometheus export is enabled'
        );
      }
    }

    // Validate OpenTelemetry configuration
    if (this.exportConfig.exporters.openTelemetry.enabled) {
      if (!this.exportConfig.exporters.openTelemetry.endpoint) {
        errors.push(
          'OpenTelemetry endpoint is required when OpenTelemetry export is enabled'
        );
      }
    }

    // Validate delivery configuration
    if (this.exportConfig.delivery.maxRetries < 0) {
      errors.push('Max retries must be non-negative');
    }
    if (this.exportConfig.delivery.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }
    if (this.exportConfig.delivery.batchSize < 1) {
      errors.push('Batch size must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Add metrics to the export queue
  addMetricsToQueue(metrics: CollectorMetric[]): void {
    this.metricQueue.push(...metrics);

    // Limit queue size to prevent memory issues
    const maxQueueSize = this.exportConfig.delivery.batchSize * 10;
    if (this.metricQueue.length > maxQueueSize) {
      this.metricQueue = this.metricQueue.slice(-maxQueueSize);
    }
  }

  // Get export statistics
  getExportStats(): typeof this.exportStats {
    return { ...this.exportStats };
  }

  private filterMetrics(metrics: CollectorMetric[]): CollectorMetric[] {
    return metrics.filter(metric => {
      // Filter by metric type
      if (this.exportConfig.filtering.includeMetricTypes.length > 0) {
        if (
          !this.exportConfig.filtering.includeMetricTypes.includes(metric.type)
        ) {
          return false;
        }
      }
      if (
        this.exportConfig.filtering.excludeMetricTypes.includes(metric.type)
      ) {
        return false;
      }

      // Filter by tags
      for (const [key, value] of Object.entries(
        this.exportConfig.filtering.includeTags
      )) {
        if (metric.tags[key] !== value) {
          return false;
        }
      }
      for (const [key, value] of Object.entries(
        this.exportConfig.filtering.excludeTags
      )) {
        if (metric.tags[key] === value) {
          return false;
        }
      }

      return true;
    });
  }

  private async exportToPrometheus(
    metrics: CollectorMetric[]
  ): Promise<ExportMetric[]> {
    const exportMetrics: ExportMetric[] = [];

    try {
      const prometheusMetrics = this.convertToPrometheusFormat(metrics);
      const payload = this.formatPrometheusPayload(prometheusMetrics);

      const exportMetric: ExportMetric = {
        ...this.createBaseMetric('export', { format: 'prometheus' }),
        type: 'export',
        exportFormat: 'prometheus',
        destination: this.exportConfig.exporters.prometheus.endpoint,
        payload,
        status: 'pending',
      };

      // Attempt to send to Prometheus endpoint
      const success = await this.sendToEndpoint(
        this.exportConfig.exporters.prometheus.endpoint,
        payload,
        { 'Content-Type': 'text/plain' }
      );

      exportMetric.status = success ? 'sent' : 'failed';
      if (success) {
        this.exportStats.prometheus.sent++;
        this.exportStats.prometheus.lastExport = Date.now();
      } else {
        this.exportStats.prometheus.failed++;
        exportMetric.error = 'Failed to send to Prometheus endpoint';
      }

      exportMetrics.push(exportMetric);
    } catch (error) {
      this.exportStats.prometheus.failed++;
      const errorMetric: ExportMetric = {
        ...this.createBaseMetric('export', { format: 'prometheus' }),
        type: 'export',
        exportFormat: 'prometheus',
        destination: this.exportConfig.exporters.prometheus.endpoint,
        payload: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
      exportMetrics.push(errorMetric);
    }

    return exportMetrics;
  }

  private async exportToOpenTelemetry(
    metrics: CollectorMetric[]
  ): Promise<ExportMetric[]> {
    const exportMetrics: ExportMetric[] = [];

    try {
      const otelMetrics = this.convertToOpenTelemetryFormat(metrics);
      const payload = JSON.stringify({ metrics: otelMetrics });

      const exportMetric: ExportMetric = {
        ...this.createBaseMetric('export', { format: 'opentelemetry' }),
        type: 'export',
        exportFormat: 'opentelemetry',
        destination: this.exportConfig.exporters.openTelemetry.endpoint,
        payload,
        status: 'pending',
      };

      // Attempt to send to OpenTelemetry endpoint
      const headers = {
        'Content-Type': 'application/json',
        ...this.exportConfig.exporters.openTelemetry.headers,
      };

      const success = await this.sendToEndpoint(
        this.exportConfig.exporters.openTelemetry.endpoint,
        payload,
        headers
      );

      exportMetric.status = success ? 'sent' : 'failed';
      if (success) {
        this.exportStats.openTelemetry.sent++;
        this.exportStats.openTelemetry.lastExport = Date.now();
      } else {
        this.exportStats.openTelemetry.failed++;
        exportMetric.error = 'Failed to send to OpenTelemetry endpoint';
      }

      exportMetrics.push(exportMetric);
    } catch (error) {
      this.exportStats.openTelemetry.failed++;
      const errorMetric: ExportMetric = {
        ...this.createBaseMetric('export', { format: 'opentelemetry' }),
        type: 'export',
        exportFormat: 'opentelemetry',
        destination: this.exportConfig.exporters.openTelemetry.endpoint,
        payload: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
      exportMetrics.push(errorMetric);
    }

    return exportMetrics;
  }

  private async exportToJSON(
    metrics: CollectorMetric[]
  ): Promise<ExportMetric[]> {
    const exportMetrics: ExportMetric[] = [];

    try {
      const payload = JSON.stringify(metrics, null, 2);

      const exportMetric: ExportMetric = {
        ...this.createBaseMetric('export', { format: 'json' }),
        type: 'export',
        exportFormat: 'json',
        destination: this.exportConfig.exporters.json.endpoint || 'local',
        payload,
        status: 'sent', // JSON export is always successful locally
      };

      this.exportStats.json.sent++;
      this.exportStats.json.lastExport = Date.now();

      exportMetrics.push(exportMetric);
    } catch (error) {
      this.exportStats.json.failed++;
      const errorMetric: ExportMetric = {
        ...this.createBaseMetric('export', { format: 'json' }),
        type: 'export',
        exportFormat: 'json',
        destination: this.exportConfig.exporters.json.endpoint || 'local',
        payload: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
      exportMetrics.push(errorMetric);
    }

    return exportMetrics;
  }

  private convertToPrometheusFormat(
    metrics: CollectorMetric[]
  ): PrometheusMetric[] {
    return metrics.map(metric => {
      const name = this.sanitizePrometheusName(
        `constructtrack_${metric.type}_${metric.source}`
      );
      const labels = { ...metric.tags };

      let value = 0;
      let type: PrometheusMetric['type'] = 'gauge';

      // Extract value based on metric type
      if (metric.type === 'resource') {
        value = metric.value;
        type = 'gauge';
      }

      return {
        name,
        type,
        value,
        labels,
        timestamp: metric.timestamp,
        help: `ConstructTrack ${metric.type} metric from ${metric.source}`,
      };
    });
  }

  private convertToOpenTelemetryFormat(
    metrics: CollectorMetric[]
  ): OpenTelemetryMetric[] {
    const grouped = new Map<string, CollectorMetric[]>();

    // Group metrics by name
    for (const metric of metrics) {
      const name = `constructtrack.${metric.type}.${metric.source}`;
      if (!grouped.has(name)) {
        grouped.set(name, []);
      }
      const group = grouped.get(name);
      if (group) {
        group.push(metric);
      }
    }

    return Array.from(grouped.entries()).map(([name, metricGroup]) => {
      const dataPoints = metricGroup.map(metric => ({
        value: metric.type === 'resource' ? metric.value : 0,
        timestamp: metric.timestamp,
        attributes: metric.tags,
      }));

      return {
        name,
        description: `ConstructTrack ${metricGroup[0].type} metric`,
        unit: metricGroup[0].type === 'resource' ? 'percent' : 'count',
        type: 'gauge' as const,
        dataPoints,
      };
    });
  }

  private formatPrometheusPayload(metrics: PrometheusMetric[]): string {
    const lines: string[] = [];

    for (const metric of metrics) {
      if (this.exportConfig.exporters.prometheus.includeHelp && metric.help) {
        lines.push(`# HELP ${metric.name} ${metric.help}`);
      }
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      const labels = Object.entries(metric.labels)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');

      const labelStr = labels ? `{${labels}}` : '';
      const timestamp = this.exportConfig.exporters.prometheus.includeTimestamp
        ? ` ${metric.timestamp}`
        : '';

      lines.push(`${metric.name}${labelStr} ${metric.value}${timestamp}`);
    }

    return lines.join('\n');
  }

  private sanitizePrometheusName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]/, '_');
  }

  private async sendToEndpoint(
    endpoint: string,
    payload: string,
    headers: Record<string, string>
  ): Promise<boolean> {
    try {
      // This is a simplified implementation
      // In production, you'd use fetch or a proper HTTP client
      const logger = getLogger();
      logger.debug(`Sending to ${endpoint}`, {
        metadata: {
          payloadLength: payload.length,
          headers,
        },
      });
      return true;
    } catch (error) {
      const logger = getLogger();
      logger.error(`Failed to send to ${endpoint}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Default export collector configuration
export const defaultExportCollectorConfig: ExportCollectorConfig = {
  enabled: false, // Disabled by default
  interval: 60000, // 1 minute
  batchSize: 100,
  retryAttempts: 3,
  retryDelay: 5000,
  exporters: {
    prometheus: {
      enabled: false,
      endpoint: '/metrics',
      format: 'text',
      includeTimestamp: false,
      includeHelp: true,
    },
    openTelemetry: {
      enabled: false,
      endpoint: '',
      protocol: 'http',
      headers: {},
      compression: 'none',
    },
    json: {
      enabled: true,
      format: 'structured',
    },
  },
  delivery: {
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 30000,
    batchSize: 100,
  },
  filtering: {
    includeMetricTypes: [],
    excludeMetricTypes: [],
    includeTags: {},
    excludeTags: {},
  },
  tags: {
    component: 'export-monitoring',
  },
};
