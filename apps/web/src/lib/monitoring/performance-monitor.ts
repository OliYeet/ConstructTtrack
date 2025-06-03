/**
 * Performance Monitor
 * Comprehensive performance monitoring and metrics collection
 */

import { getLogger } from '@/lib/logging';

// Performance metric types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
  metadata?: Record<string, unknown>;
}

// Performance timing data
export interface PerformanceTiming {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

// Resource usage metrics
export interface ResourceMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed?: number;
    heapTotal?: number;
  };
  cpu: {
    usage: number;
    loadAverage?: number[];
  };
  timestamp: string;
}

// Performance thresholds
export interface PerformanceThresholds {
  responseTime: {
    warning: number;
    critical: number;
  };
  memoryUsage: {
    warning: number;
    critical: number;
  };
  cpuUsage: {
    warning: number;
    critical: number;
  };
}

// Performance monitor configuration
export interface PerformanceMonitorConfig {
  enableMetrics: boolean;
  enableResourceMonitoring: boolean;
  metricsInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  thresholds: PerformanceThresholds;
  enableAlerts: boolean;
}

// Performance monitor class
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private metrics: PerformanceMetric[] = [];
  private timings: Map<string, number> = new Map();
  private resourceTimer?: ReturnType<typeof setInterval>;
  private isMonitoring = false;

  constructor(config: PerformanceMonitorConfig) {
    this.config = config;
  }

  // Start monitoring
  start(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    if (this.config.enableResourceMonitoring) {
      this.startResourceMonitoring();
    }

    // Setup Web Vitals monitoring in browser
    if (typeof window !== 'undefined') {
      this.setupWebVitalsMonitoring();
    }

    const logger = getLogger();
    logger.info('Performance monitoring started', {
      metadata: {
        config: this.config,
      },
    });
  }

  // Stop monitoring
  stop(): void {
    this.isMonitoring = false;

    if (this.resourceTimer) {
      clearInterval(this.resourceTimer);
      this.resourceTimer = undefined;
    }

    const logger = getLogger();
    logger.info('Performance monitoring stopped');
  }

  // Record a performance metric
  recordMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {},
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags,
      metadata,
    };

    this.metrics.push(metric);
    this.checkThresholds(metric);
    this.cleanup();
  }

  // Start timing an operation
  startTiming(operationId: string): void {
    this.timings.set(operationId, performance.now());
  }

  // End timing an operation
  endTiming(
    operationId: string,
    tags: Record<string, string> = {},
    metadata?: Record<string, unknown>
  ): number | null {
    const startTime = this.timings.get(operationId);
    if (!startTime) {
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.timings.delete(operationId);

    // Record the timing metric
    this.recordMetric(
      'operation_duration',
      duration,
      'ms',
      { operation: operationId, ...tags },
      metadata
    );

    return duration;
  }

  // Measure function execution time
  async measureAsync<T>(
    operationName: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const operationId = `${operationName}_${Date.now()}`;
    this.startTiming(operationId);

    try {
      const result = await fn();
      this.endTiming(operationId, { ...tags, status: 'success' });
      return result;
    } catch (error) {
      this.endTiming(operationId, { ...tags, status: 'error' });
      throw error;
    }
  }

  // Measure synchronous function execution time
  measure<T>(
    operationName: string,
    fn: () => T,
    tags: Record<string, string> = {}
  ): T {
    const operationId = `${operationName}_${Date.now()}`;
    this.startTiming(operationId);

    try {
      const result = fn();
      this.endTiming(operationId, { ...tags, status: 'success' });
      return result;
    } catch (error) {
      this.endTiming(operationId, { ...tags, status: 'error' });
      throw error;
    }
  }

  // Get current resource metrics
  getResourceMetrics(): ResourceMetrics | null {
    if (typeof process !== 'undefined') {
      // Node.js environment
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return {
        memory: {
          used: memUsage.rss,
          total: memUsage.rss + memUsage.external,
          percentage: (memUsage.rss / (memUsage.rss + memUsage.external)) * 100,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
        },
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          loadAverage: process.platform !== 'win32' ? (() => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              return require('os').loadavg();
            } catch {
              return undefined;
            }
          })() : undefined,
        },
        timestamp: new Date().toISOString(),
      };
    } else if (typeof window !== 'undefined' && 'memory' in performance) {
      // Browser environment with memory API
      const memory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;

      return {
        memory: {
          used: memory?.usedJSHeapSize || 0,
          total: memory?.totalJSHeapSize || 0,
          percentage: memory ? (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100 : 0,
        },
        cpu: {
          usage: 0, // Not available in browser
        },
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }

  // Start resource monitoring
private startResourceMonitoring(): void {
     this.resourceTimer = setInterval(() => {
      try {
         const metrics = this.getResourceMetrics();
         if (metrics) {
           this.recordMetric(
             'memory_usage',
             metrics.memory.percentage,
             'percent',
             { type: 'memory' }
           );

           this.recordMetric(
             'memory_used',
             metrics.memory.used,
             'bytes',
             { type: 'memory' }
           );

           if (metrics.cpu.usage > 0) {
             // Convert CPU usage from seconds to percentage
             // Note: This is a simplified conversion. For accurate CPU percentage,
             // consider using a library like pidusage or implementing proper CPU sampling
             const cpuPercentage = Math.min((metrics.cpu.usage / 1000) * 100, 100);
             this.recordMetric(
               'cpu_usage',
               cpuPercentage,
               'percent',
               { type: 'cpu' }
             );
           }
         }
      } catch (error) {
        const logger = getLogger();
        logger.error('Failed to collect resource metrics', error instanceof Error ? error : new Error(String(error)), {
          metadata: { error: String(error) }
        });
      }
     }, this.config.metricsInterval);
   }

  // Setup Web Vitals monitoring
  private setupWebVitalsMonitoring(): void {
    // Core Web Vitals monitoring
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(
            'web_vital_lcp',
            entry.startTime,
            'ms',
            { type: 'web_vital', metric: 'lcp' }
          );
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay (FID)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(
            'web_vital_fid',
            (entry as any).processingStart - entry.startTime,
            'ms',
            { type: 'web_vital', metric: 'fid' }
          );
        }
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift (CLS)
      new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as any;
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value;
          }
        }
        this.recordMetric(
          'web_vital_cls',
          clsValue,
          'score',
          { type: 'web_vital', metric: 'cls' }
        );
      }).observe({ entryTypes: ['layout-shift'] });
    }

    // Navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        this.recordMetric(
          'page_load_time',
          navigation.loadEventEnd - navigation.fetchStart,
          'ms',
          { type: 'navigation' }
        );

        this.recordMetric(
          'dom_content_loaded',
          navigation.domContentLoadedEventEnd - navigation.fetchStart,
          'ms',
          { type: 'navigation' }
        );

        this.recordMetric(
          'first_byte',
          navigation.responseStart - navigation.fetchStart,
          'ms',
          { type: 'navigation' }
        );
      }, 0);
    });
  }

  // Check performance thresholds and trigger alerts
  private checkThresholds(metric: PerformanceMetric): void {
    if (!this.config.enableAlerts) {
      return;
    }

    const logger = getLogger();

    // Check response time thresholds
    if (metric.name === 'operation_duration' || metric.name === 'api_response_time') {
      if (metric.value > this.config.thresholds.responseTime.critical) {
        logger.error('Critical response time threshold exceeded', undefined, {
          metadata: {
            metric,
            threshold: this.config.thresholds.responseTime.critical,
            severity: 'critical',
          },
        });
      } else if (metric.value > this.config.thresholds.responseTime.warning) {
        logger.warn('Response time threshold warning', {
          metadata: {
            metric,
            threshold: this.config.thresholds.responseTime.warning,
            severity: 'warning',
          },
        });
      }
    }

    // Check memory usage thresholds
    if (metric.name === 'memory_usage') {
      if (metric.value > this.config.thresholds.memoryUsage.critical) {
        logger.error('Critical memory usage threshold exceeded', undefined, {
          metadata: {
            metric,
            threshold: this.config.thresholds.memoryUsage.critical,
            severity: 'critical',
          },
        });
      } else if (metric.value > this.config.thresholds.memoryUsage.warning) {
        logger.warn('Memory usage threshold warning', {
          metadata: {
            metric,
            threshold: this.config.thresholds.memoryUsage.warning,
            severity: 'warning',
          },
        });
      }
    }

    // Check CPU usage thresholds
    if (metric.name === 'cpu_usage') {
      if (metric.value > this.config.thresholds.cpuUsage.critical) {
        logger.error('Critical CPU usage threshold exceeded', undefined, {
          metadata: {
            metric,
            threshold: this.config.thresholds.cpuUsage.critical,
            severity: 'critical',
          },
        });
      } else if (metric.value > this.config.thresholds.cpuUsage.warning) {
        logger.warn('CPU usage threshold warning', {
          metadata: {
            metric,
            threshold: this.config.thresholds.cpuUsage.warning,
            severity: 'warning',
          },
        });
      }
    }
  }

  // Cleanup old metrics
  private cleanup(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.metrics = this.metrics.filter(
      metric => new Date(metric.timestamp).getTime() > cutoff
    );
  }

  // Get performance statistics
  getStats(): {
    totalMetrics: number;
    averageResponseTime: number;
    currentMemoryUsage: number;
    recentMetrics: PerformanceMetric[];
  } {
    const recentThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes
    const recentMetrics = this.metrics.filter(
      metric => new Date(metric.timestamp).getTime() > recentThreshold
    );

    const responseTimeMetrics = this.metrics.filter(
      metric => metric.name === 'operation_duration' || metric.name === 'api_response_time'
    );

    const averageResponseTime = responseTimeMetrics.length > 0 ?
      responseTimeMetrics.reduce((sum, metric) => sum + metric.value, 0) / responseTimeMetrics.length :
      0;

    const memoryMetrics = this.metrics.filter(metric => metric.name === 'memory_usage');
    const currentMemoryUsage = memoryMetrics.length > 0 ?
      memoryMetrics[memoryMetrics.length - 1].value :
      0;

    return {
      totalMetrics: this.metrics.length,
      averageResponseTime,
      currentMemoryUsage,
      recentMetrics: recentMetrics.slice(-10), // Last 10 recent metrics
    };
  }

  // Get all metrics
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Default configuration
export const defaultPerformanceConfig: PerformanceMonitorConfig = {
  enableMetrics: true,
  enableResourceMonitoring: true,
  metricsInterval: 30000, // 30 seconds
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  thresholds: {
    responseTime: {
      warning: 1000, // 1 second
      critical: 5000, // 5 seconds
    },
    memoryUsage: {
      warning: 80, // 80%
      critical: 95, // 95%
    },
    cpuUsage: {
      warning: 70, // 70%
      critical: 90, // 90%
    },
  },
  enableAlerts: true,
};

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor(defaultPerformanceConfig);
