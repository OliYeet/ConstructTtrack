/**
 * Resource Monitor
 * System resource usage monitoring and alerting
 */

import { performanceMonitor } from './performance-monitor';
import { getLogger } from '@/lib/logging';

// Resource usage snapshot
export interface ResourceSnapshot {
  timestamp: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
    heap?: {
      used: number;
      total: number;
      limit: number;
    };
  };
  cpu: {
    usage: number;
    loadAverage?: number[];
    processes?: number;
  };
  disk?: {
    used: number;
    total: number;
    percentage: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
}

// Resource alert configuration
export interface ResourceAlertConfig {
  memory: {
    warningThreshold: number;
    criticalThreshold: number;
    enabled: boolean;
  };
  cpu: {
    warningThreshold: number;
    criticalThreshold: number;
    enabled: boolean;
  };
  disk?: {
    warningThreshold: number;
    criticalThreshold: number;
    enabled: boolean;
  };
}

// Resource trend data
export interface ResourceTrend {
  metric: string;
  values: Array<{ timestamp: string; value: number }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // percentage change per hour
}

// Resource monitor class
export class ResourceMonitor {
  private snapshots: ResourceSnapshot[] = [];
  private alertConfig: ResourceAlertConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private maxSnapshots = 1440; // 24 hours at 1-minute intervals

  constructor(alertConfig: ResourceAlertConfig) {
    this.alertConfig = alertConfig;
  }

  // Start monitoring
  start(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Take initial snapshot
    this.takeSnapshot();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);

    const logger = getLogger();
    logger.info('Resource monitoring started', {
      metadata: {
        interval: intervalMs,
        alertConfig: this.alertConfig,
      },
    });
  }

  // Stop monitoring
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;

    const logger = getLogger();
    logger.info('Resource monitoring stopped');
  }

  // Take a resource snapshot
  private async takeSnapshot(): Promise<void> {
    try {
      const snapshot = await this.collectResourceData();
      this.snapshots.push(snapshot);

      // Check alerts
      this.checkAlerts(snapshot);

      // Cleanup old snapshots
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots = this.snapshots.slice(-this.maxSnapshots);
      }

      // Record metrics in performance monitor
      this.recordMetrics(snapshot);

    } catch (error) {
      const logger = getLogger();
      logger.error('Failed to take resource snapshot', error);
    }
  }

  // Collect resource data
  private async collectResourceData(): Promise<ResourceSnapshot> {
    const timestamp = new Date().toISOString();
    
    // Memory data
    const memory = await this.getMemoryUsage();
    
    // CPU data
    const cpu = await this.getCpuUsage();
    
    // Disk data (if available)
    const disk = await this.getDiskUsage();
    
    // Network data (if available)
    const network = await this.getNetworkUsage();

    return {
      timestamp,
      memory,
      cpu,
      disk,
      network,
    };
  }

  // Get memory usage
  private async getMemoryUsage(): Promise<ResourceSnapshot['memory']> {
    if (typeof process !== 'undefined') {
      // Node.js environment
      const memUsage = process.memoryUsage();
      
      // Try to get system memory info
      let totalMemory = 0;
      try {
        const os = await import('os');
        totalMemory = os.totalmem();
      } catch {
        totalMemory = memUsage.rss * 4; // Rough estimate
      }

      return {
        used: memUsage.rss,
        total: totalMemory,
        percentage: (memUsage.rss / totalMemory) * 100,
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          limit: memUsage.heapTotal * 1.5, // Rough estimate
        },
      };
    } else if (typeof window !== 'undefined' && 'memory' in performance) {
      // Browser environment with memory API
      const memory = (performance as any).memory;
      
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
        heap: {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        },
      };
    } else {
      // Fallback
      return {
        used: 0,
        total: 0,
        percentage: 0,
      };
    }
  }

  // Get CPU usage
  private async getCpuUsage(): Promise<ResourceSnapshot['cpu']> {
    if (typeof process !== 'undefined') {
      // Node.js environment
      const cpuUsage = process.cpuUsage();
      const usage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      let loadAverage: number[] | undefined;
      let processes: number | undefined;

      try {
        const os = await import('os');
        loadAverage = os.loadavg();
        // processes = os.cpus().length; // Number of CPU cores
      } catch {
        // OS module not available
      }

      return {
        usage,
        loadAverage,
        processes,
      };
    } else {
      // Browser environment - CPU usage not directly available
      return {
        usage: 0,
      };
    }
  }

  // Get disk usage (Node.js only)
  private async getDiskUsage(): Promise<ResourceSnapshot['disk'] | undefined> {
    if (typeof process === 'undefined') {
      return undefined;
    }

    try {
      const fs = await import('fs');
      const stats = await fs.promises.statfs(process.cwd());
      
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;

      return {
        used,
        total,
        percentage: (used / total) * 100,
      };
    } catch {
      return undefined;
    }
  }

  // Get network usage (placeholder - would need platform-specific implementation)
  private async getNetworkUsage(): Promise<ResourceSnapshot['network'] | undefined> {
    // This would require platform-specific implementations
    // For now, return undefined
    return undefined;
  }

  // Record metrics in performance monitor
  private recordMetrics(snapshot: ResourceSnapshot): void {
    // Memory metrics
    performanceMonitor.recordMetric(
      'system_memory_usage',
      snapshot.memory.percentage,
      'percent',
      { type: 'memory' }
    );

    performanceMonitor.recordMetric(
      'system_memory_used',
      snapshot.memory.used,
      'bytes',
      { type: 'memory' }
    );

    if (snapshot.memory.heap) {
      performanceMonitor.recordMetric(
        'heap_memory_usage',
        (snapshot.memory.heap.used / snapshot.memory.heap.total) * 100,
        'percent',
        { type: 'heap' }
      );
    }

    // CPU metrics
    if (snapshot.cpu.usage > 0) {
      performanceMonitor.recordMetric(
        'system_cpu_usage',
        snapshot.cpu.usage,
        'seconds',
        { type: 'cpu' }
      );
    }

    if (snapshot.cpu.loadAverage) {
      performanceMonitor.recordMetric(
        'system_load_average',
        snapshot.cpu.loadAverage[0],
        'load',
        { type: 'load', period: '1min' }
      );
    }

    // Disk metrics
    if (snapshot.disk) {
      performanceMonitor.recordMetric(
        'system_disk_usage',
        snapshot.disk.percentage,
        'percent',
        { type: 'disk' }
      );
    }
  }

  // Check resource alerts
  private checkAlerts(snapshot: ResourceSnapshot): void {
    const logger = getLogger();

    // Memory alerts
    if (this.alertConfig.memory.enabled) {
      if (snapshot.memory.percentage > this.alertConfig.memory.criticalThreshold) {
        logger.error('Critical memory usage alert', undefined, {
          metadata: {
            usage: snapshot.memory.percentage,
            threshold: this.alertConfig.memory.criticalThreshold,
            used: snapshot.memory.used,
            total: snapshot.memory.total,
            alertType: 'resource_critical',
          },
        });
      } else if (snapshot.memory.percentage > this.alertConfig.memory.warningThreshold) {
        logger.warn('Memory usage warning', {
          metadata: {
            usage: snapshot.memory.percentage,
            threshold: this.alertConfig.memory.warningThreshold,
            used: snapshot.memory.used,
            total: snapshot.memory.total,
            alertType: 'resource_warning',
          },
        });
      }
    }

    // CPU alerts
    if (this.alertConfig.cpu.enabled && snapshot.cpu.usage > 0) {
      const cpuPercentage = snapshot.cpu.usage * 100; // Convert to percentage
      
      if (cpuPercentage > this.alertConfig.cpu.criticalThreshold) {
        logger.error('Critical CPU usage alert', undefined, {
          metadata: {
            usage: cpuPercentage,
            threshold: this.alertConfig.cpu.criticalThreshold,
            loadAverage: snapshot.cpu.loadAverage,
            alertType: 'resource_critical',
          },
        });
      } else if (cpuPercentage > this.alertConfig.cpu.warningThreshold) {
        logger.warn('CPU usage warning', {
          metadata: {
            usage: cpuPercentage,
            threshold: this.alertConfig.cpu.warningThreshold,
            loadAverage: snapshot.cpu.loadAverage,
            alertType: 'resource_warning',
          },
        });
      }
    }

    // Disk alerts
    if (this.alertConfig.disk?.enabled && snapshot.disk) {
      if (snapshot.disk.percentage > this.alertConfig.disk.criticalThreshold) {
        logger.error('Critical disk usage alert', undefined, {
          metadata: {
            usage: snapshot.disk.percentage,
            threshold: this.alertConfig.disk.criticalThreshold,
            used: snapshot.disk.used,
            total: snapshot.disk.total,
            alertType: 'resource_critical',
          },
        });
      } else if (snapshot.disk.percentage > this.alertConfig.disk.warningThreshold) {
        logger.warn('Disk usage warning', {
          metadata: {
            usage: snapshot.disk.percentage,
            threshold: this.alertConfig.disk.warningThreshold,
            used: snapshot.disk.used,
            total: snapshot.disk.total,
            alertType: 'resource_warning',
          },
        });
      }
    }
  }

  // Get current resource usage
  getCurrentUsage(): ResourceSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  // Get resource history
  getHistory(hours: number = 1): ResourceSnapshot[] {
    const threshold = Date.now() - (hours * 60 * 60 * 1000);
    return this.snapshots.filter(
      snapshot => new Date(snapshot.timestamp).getTime() > threshold
    );
  }

  // Get resource trends
  getTrends(): ResourceTrend[] {
    if (this.snapshots.length < 2) {
      return [];
    }

    const trends: ResourceTrend[] = [];
    const recentSnapshots = this.snapshots.slice(-60); // Last hour

    // Memory trend
    const memoryValues = recentSnapshots.map(s => ({
      timestamp: s.timestamp,
      value: s.memory.percentage,
    }));
    trends.push(this.calculateTrend('memory_usage', memoryValues));

    // CPU trend (if available)
    const cpuValues = recentSnapshots
      .filter(s => s.cpu.usage > 0)
      .map(s => ({
        timestamp: s.timestamp,
        value: s.cpu.usage * 100,
      }));
    if (cpuValues.length > 1) {
      trends.push(this.calculateTrend('cpu_usage', cpuValues));
    }

    return trends;
  }

  // Calculate trend for a metric
  private calculateTrend(
    metric: string,
    values: Array<{ timestamp: string; value: number }>
  ): ResourceTrend {
    if (values.length < 2) {
      return {
        metric,
        values,
        trend: 'stable',
        changeRate: 0,
      };
    }

    const first = values[0].value;
    const last = values[values.length - 1].value;
    const change = last - first;
    const changePercentage = (change / first) * 100;

    // Calculate hourly change rate
    const timeSpan = new Date(values[values.length - 1].timestamp).getTime() - 
                    new Date(values[0].timestamp).getTime();
    const hours = timeSpan / (60 * 60 * 1000);
    const changeRate = hours > 0 ? changePercentage / hours : 0;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(changeRate) < 1) {
      trend = 'stable';
    } else if (changeRate > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      metric,
      values,
      trend,
      changeRate,
    };
  }

  // Get resource statistics
  getStats(): {
    totalSnapshots: number;
    monitoringDuration: number;
    averageMemoryUsage: number;
    averageCpuUsage: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
  } {
    if (this.snapshots.length === 0) {
      return {
        totalSnapshots: 0,
        monitoringDuration: 0,
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        peakMemoryUsage: 0,
        peakCpuUsage: 0,
      };
    }

    const monitoringDuration = new Date(this.snapshots[this.snapshots.length - 1].timestamp).getTime() -
                              new Date(this.snapshots[0].timestamp).getTime();

    const memoryUsages = this.snapshots.map(s => s.memory.percentage);
    const cpuUsages = this.snapshots.filter(s => s.cpu.usage > 0).map(s => s.cpu.usage * 100);

    return {
      totalSnapshots: this.snapshots.length,
      monitoringDuration,
      averageMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      averageCpuUsage: cpuUsages.length > 0 ? cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length : 0,
      peakMemoryUsage: Math.max(...memoryUsages),
      peakCpuUsage: cpuUsages.length > 0 ? Math.max(...cpuUsages) : 0,
    };
  }
}

// Default alert configuration
export const defaultResourceAlertConfig: ResourceAlertConfig = {
  memory: {
    warningThreshold: 80,
    criticalThreshold: 95,
    enabled: true,
  },
  cpu: {
    warningThreshold: 70,
    criticalThreshold: 90,
    enabled: true,
  },
  disk: {
    warningThreshold: 85,
    criticalThreshold: 95,
    enabled: false, // Disabled by default as it requires additional permissions
  },
};

// Global resource monitor instance
export const resourceMonitor = new ResourceMonitor(defaultResourceAlertConfig);
