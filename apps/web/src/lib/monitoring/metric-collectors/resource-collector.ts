/**
 * Resource Metric Collector
 *
 * Collects system resource metrics including CPU usage, memory consumption,
 * disk I/O, and network I/O for real-time monitoring and capacity planning.
 */

import {
  BaseMetricCollector,
  CollectorConfig,
  ResourceMetric,
} from './base-collector';

// Resource collector specific configuration
export interface ResourceCollectorConfig extends CollectorConfig {
  metrics: {
    cpu: boolean;
    memory: boolean;
    diskIO: boolean;
    networkIO: boolean;
  };
  processMonitoring: {
    enabled: boolean;
    topProcesses: number; // Number of top processes to track
  };
}

// CPU metrics
interface CPUMetrics {
  usage: number; // Overall CPU usage percentage
  loadAverage: number[]; // 1, 5, 15 minute load averages
  cores: number; // Number of CPU cores
  processes?: Array<{
    pid: number;
    name: string;
    usage: number;
  }>;
}

// Memory metrics
interface MemoryMetrics {
  total: number; // Total memory in bytes
  used: number; // Used memory in bytes
  free: number; // Free memory in bytes
  usage: number; // Usage percentage
  swap?: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
}

// Disk I/O metrics
interface DiskIOMetrics {
  readBytes: number;
  writeBytes: number;
  readOps: number;
  writeOps: number;
  usage: number; // Disk usage percentage
}

// Network I/O metrics
interface NetworkIOMetrics {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  errors: number;
}

export class ResourceCollector extends BaseMetricCollector {
  private resourceConfig: ResourceCollectorConfig;
  private lastCPUTimes: {
    user: number;
    nice: number;
    sys: number;
    irq: number;
    idle: number;
  } | null = null;
  private lastNetworkStats: NetworkIOMetrics | null = null;
  private lastDiskStats: DiskIOMetrics | null = null;

  constructor(config: ResourceCollectorConfig) {
    super('resource-collector', 'System Resource Collector', config);
    this.resourceConfig = config;
  }

  async collect(): Promise<ResourceMetric[]> {
    const metrics: ResourceMetric[] = [];

    try {
      if (this.resourceConfig.metrics.cpu) {
        const cpuMetrics = await this.collectCPUMetrics();
        metrics.push(...cpuMetrics);
      }

      if (this.resourceConfig.metrics.memory) {
        const memoryMetrics = await this.collectMemoryMetrics();
        metrics.push(...memoryMetrics);
      }

      if (this.resourceConfig.metrics.diskIO) {
        const diskMetrics = await this.collectDiskIOMetrics();
        metrics.push(...diskMetrics);
      }

      if (this.resourceConfig.metrics.networkIO) {
        const networkMetrics = await this.collectNetworkIOMetrics();
        metrics.push(...networkMetrics);
      }
    } catch (error) {
      throw new Error(
        `Resource collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return metrics;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.interval < 1000) {
      errors.push('Resource collection interval must be at least 1000ms');
    }

    if (
      !this.resourceConfig.metrics.cpu &&
      !this.resourceConfig.metrics.memory &&
      !this.resourceConfig.metrics.diskIO &&
      !this.resourceConfig.metrics.networkIO
    ) {
      errors.push('At least one resource metric type must be enabled');
    }

    if (
      this.resourceConfig.processMonitoring.enabled &&
      this.resourceConfig.processMonitoring.topProcesses < 1
    ) {
      errors.push('Top processes count must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async collectCPUMetrics(): Promise<ResourceMetric[]> {
    const metrics: ResourceMetric[] = [];

    try {
      const cpuData = await this.getCPUUsage();

      // Overall CPU usage metric
      const cpuMetric: ResourceMetric = {
        ...this.createBaseMetric('resource', {
          resourceType: 'cpu',
          metric: 'usage',
        }),
        type: 'resource',
        resourceType: 'cpu',
        value: cpuData.usage,
        unit: 'percent',
        details: {
          usage: cpuData.usage,
          total: 100,
          used: cpuData.usage,
          free: 100 - cpuData.usage,
          processes: cpuData.processes,
        },
        metadata: {
          cores: cpuData.cores,
          loadAverage: cpuData.loadAverage,
        },
      };

      metrics.push(cpuMetric);

      // Load average metrics
      if (cpuData.loadAverage && cpuData.loadAverage.length >= 3) {
        const loadMetric: ResourceMetric = {
          ...this.createBaseMetric('resource', {
            resourceType: 'cpu',
            metric: 'load',
          }),
          type: 'resource',
          resourceType: 'cpu',
          value: cpuData.loadAverage[0], // 1-minute load average
          unit: 'load',
          details: {
            usage: (cpuData.loadAverage[0] / cpuData.cores) * 100,
          },
          metadata: {
            loadAverage1m: cpuData.loadAverage[0],
            loadAverage5m: cpuData.loadAverage[1],
            loadAverage15m: cpuData.loadAverage[2],
            cores: cpuData.cores,
          },
        };

        metrics.push(loadMetric);
      }
    } catch (error) {
      throw new Error(
        `CPU metrics collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return metrics;
  }

  private async collectMemoryMetrics(): Promise<ResourceMetric[]> {
    const metrics: ResourceMetric[] = [];

    try {
      const memoryData = await this.getMemoryUsage();

      const memoryMetric: ResourceMetric = {
        ...this.createBaseMetric('resource', {
          resourceType: 'memory',
          metric: 'usage',
        }),
        type: 'resource',
        resourceType: 'memory',
        value: memoryData.usage,
        unit: 'percent',
        details: {
          usage: memoryData.usage,
          total: memoryData.total,
          used: memoryData.used,
          free: memoryData.free,
        },
        metadata: {
          totalBytes: memoryData.total,
          usedBytes: memoryData.used,
          freeBytes: memoryData.free,
          swap: memoryData.swap,
        },
      };

      metrics.push(memoryMetric);
    } catch (error) {
      throw new Error(
        `Memory metrics collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return metrics;
  }

  private async collectDiskIOMetrics(): Promise<ResourceMetric[]> {
    const metrics: ResourceMetric[] = [];

    try {
      const diskData = await this.getDiskIOUsage();

      const diskMetric: ResourceMetric = {
        ...this.createBaseMetric('resource', {
          resourceType: 'disk',
          metric: 'io',
        }),
        type: 'resource',
        resourceType: 'disk',
        value: diskData.usage,
        unit: 'percent',
        details: {
          usage: diskData.usage,
        },
        metadata: {
          readBytes: diskData.readBytes,
          writeBytes: diskData.writeBytes,
          readOps: diskData.readOps,
          writeOps: diskData.writeOps,
        },
      };

      metrics.push(diskMetric);
    } catch (error) {
      throw new Error(
        `Disk I/O metrics collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return metrics;
  }

  private async collectNetworkIOMetrics(): Promise<ResourceMetric[]> {
    const metrics: ResourceMetric[] = [];

    try {
      const networkData = await this.getNetworkIOUsage();

      const networkMetric: ResourceMetric = {
        ...this.createBaseMetric('resource', {
          resourceType: 'network',
          metric: 'io',
        }),
        type: 'resource',
        resourceType: 'network',
        value: networkData.bytesReceived + networkData.bytesSent,
        unit: 'bytes',
        details: {},
        metadata: {
          bytesReceived: networkData.bytesReceived,
          bytesSent: networkData.bytesSent,
          packetsReceived: networkData.packetsReceived,
          packetsSent: networkData.packetsSent,
          errors: networkData.errors,
        },
      };

      metrics.push(networkMetric);
    } catch (error) {
      throw new Error(
        `Network I/O metrics collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return metrics;
  }

  // Platform-specific CPU usage calculation
  private async getCPUUsage(): Promise<CPUMetrics> {
    const os = await import('os');

    const cpus = os.cpus();
    const cores = cpus.length;
    const loadAverage = os.loadavg();

    // Calculate CPU usage using delta from previous snapshot
    let usage = 0;

    if (this.lastCPUTimes) {
      let totalDelta = 0;
      let idleDelta = 0;

      for (const cpu of cpus) {
        totalDelta +=
          cpu.times.user +
          cpu.times.nice +
          cpu.times.sys +
          cpu.times.irq +
          cpu.times.idle;
        idleDelta += cpu.times.idle;
      }

      // Calculate previous total using the same five fields for consistency
      const prevTotal =
        this.lastCPUTimes.user +
        this.lastCPUTimes.nice +
        this.lastCPUTimes.sys +
        this.lastCPUTimes.irq +
        this.lastCPUTimes.idle;

      const deltaTotal = totalDelta - prevTotal;
      const deltaIdle = idleDelta - this.lastCPUTimes.idle;

      // Guard against division by zero to prevent Infinity/NaN
      if (deltaTotal > 0) {
        usage = Math.max(0, Math.min(100, (1 - deltaIdle / deltaTotal) * 100));
      }
    }

    // Store snapshot for next iteration with all five CPU time fields
    const snapshot = {
      user: 0,
      nice: 0,
      sys: 0,
      irq: 0,
      idle: 0,
    };
    cpus.forEach(cpu => {
      snapshot.user += cpu.times.user;
      snapshot.nice += cpu.times.nice;
      snapshot.sys += cpu.times.sys;
      snapshot.irq += cpu.times.irq;
      snapshot.idle += cpu.times.idle;
    });
    this.lastCPUTimes = snapshot;

    let processes: Array<{ pid: number; name: string; usage: number }> = [];

    // Get top processes if enabled
    if (this.resourceConfig.processMonitoring.enabled) {
      processes = await this.getTopProcesses();
    }

    return {
      usage: Math.max(0, Math.min(100, usage)),
      loadAverage,
      cores,
      processes,
    };
  }

  // Platform-specific memory usage calculation
  private async getMemoryUsage(): Promise<MemoryMetrics> {
    const os = await import('os');

    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;

    return {
      total,
      used,
      free,
      usage: Math.max(0, Math.min(100, usage)),
    };
  }

  // Simplified disk I/O usage (would need platform-specific implementation)
  private async getDiskIOUsage(): Promise<DiskIOMetrics> {
    // This is a simplified implementation
    // In production, you'd want to use platform-specific APIs or libraries
    return {
      readBytes: 0,
      writeBytes: 0,
      readOps: 0,
      writeOps: 0,
      usage: 0,
    };
  }

  // Simplified network I/O usage (would need platform-specific implementation)
  private async getNetworkIOUsage(): Promise<NetworkIOMetrics> {
    // This is a simplified implementation
    // In production, you'd want to use platform-specific APIs or libraries
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      errors: 0,
    };
  }

  // Get top processes by CPU usage (simplified implementation)
  private async getTopProcesses(): Promise<
    Array<{ pid: number; name: string; usage: number }>
  > {
    // This is a simplified implementation
    // In production, you'd want to use a library like pidusage or platform-specific APIs
    return [];
  }
}

// Default resource collector configuration
export const defaultResourceCollectorConfig: ResourceCollectorConfig = {
  enabled: true,
  interval: 30000, // 30 seconds
  batchSize: 10,
  retryAttempts: 3,
  retryDelay: 1000,
  metrics: {
    cpu: true,
    memory: true,
    diskIO: false, // Disabled by default for performance
    networkIO: false, // Disabled by default for performance
  },
  processMonitoring: {
    enabled: false, // Disabled by default for performance
    topProcesses: 5,
  },
  tags: {
    component: 'resource-monitoring',
  },
};
