/**
 * Resource Collector
 * Tracks CPU, memory, and system resource usage
 * Based on Charlie's implementation blueprint for LUM-585
 */

import { realtimeConfig } from '../config/realtime-config';

import { BaseRealtimeCollector } from './base';

// Resource metrics
export interface ResourceMetrics {
  memory: {
    rss: number; // Resident Set Size
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    percentage: number;
  };
  cpu: {
    usage: number; // CPU usage percentage
    loadAverage?: number[]; // 1, 5, 15 minute load averages (Unix only)
    userTime: number;
    systemTime: number;
  };
  process: {
    uptime: number;
    pid: number;
    ppid?: number;
    platform: string;
    arch: string;
  };
  system?: {
    totalMemory?: number;
    freeMemory?: number;
    cpuCount?: number;
  };
}

// Resource statistics
export interface ResourceStats {
  samples: number;
  averageMemoryUsage: number;
  peakMemoryUsage: number;
  averageCpuUsage: number;
  peakCpuUsage: number;
  memoryLeakDetected: boolean;
  lastSampleTime: string;
}

export class ResourceCollector extends BaseRealtimeCollector {
  private resourceStats: ResourceStats;
  private config = realtimeConfig.collectors.resource;
  private samplingInterval?: NodeJS.Timeout;
  private previousCpuUsage?: NodeJS.CpuUsage;
  private previousSampleTime?: number;
  private memoryHistory: number[] = [];
  private readonly maxHistorySize = 100; // Keep last 100 samples for leak detection
  private isSampling = false;

  constructor() {
    super('resource-collector');
    this.resourceStats = {
      samples: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0,
      averageCpuUsage: 0,
      peakCpuUsage: 0,
      memoryLeakDetected: false,
      lastSampleTime: new Date().toISOString(),
    };
  }

  protected onStart(): void {
    this.resetStats();
    this.startSampling();
  }

  protected onStop(): void {
    this.stopSampling();
  }

  private startSampling(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
    }
    this.isSampling = true;

    // Take initial CPU measurement
    this.previousCpuUsage = process.cpuUsage();

    // Start the sampling loop
    this.scheduleSample();
  }

  private async scheduleSample(): Promise<void> {
    if (!this.isSampling) return;
    await this.sampleResources();
    setTimeout(() => this.scheduleSample(), this.config.sampleInterval);
  }

  private stopSampling(): void {
    this.isSampling = false;
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = undefined;
    }
  }

  private async sampleResources(): Promise<void> {
    if (!this.isSampling) return; // Guard against sampling when stopped

    try {
      const metrics = await this.collectResourceMetrics();
      this.processResourceMetrics(metrics);
      this.emitResourceMetrics(metrics);
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'sampleResources'
      );
    }
  }

  private async collectResourceMetrics(): Promise<ResourceMetrics> {
    const memUsage = process.memoryUsage();
    const currentCpuUsage = process.cpuUsage();
    const currentTime = Date.now();

    // Calculate CPU usage percentage
    let cpuPercentage = 0;
    if (this.previousCpuUsage && this.previousSampleTime) {
      const cpuDelta = process.cpuUsage(this.previousCpuUsage);
      const timeDelta = currentTime - this.previousSampleTime;

      // Guard against division by zero or very small time deltas
      if (timeDelta > 10) {
        // Minimum 10ms to avoid division by zero
        // Convert microseconds to milliseconds and calculate percentage
        const totalCpuTime = (cpuDelta.user + cpuDelta.system) / 1000; // ms

        // Get actual CPU count first, then calculate percentage
        let cores = 1; // Default fallback
        try {
          if (typeof process !== 'undefined' && process.versions?.node) {
            const os = await import('os');
            cores = os.cpus().length;
          }
        } catch {
          // Use default if os module is not available
        }

        cpuPercentage = (totalCpuTime / (timeDelta * cores)) * 100;

        // Don’t clamp – callers can decide how to interpret >100 %
      }
    }

    // Update for next calculation
    this.previousCpuUsage = currentCpuUsage;
    this.previousSampleTime = currentTime;

    // Get system information
    let loadAverage: number[] | undefined;
    let totalMemory: number | undefined;
    let freeMemory: number | undefined;
    let cpuCount: number | undefined;

    try {
      // Use dynamic import for os module (Node.js only) to avoid browser compatibility issues
      if (typeof process !== 'undefined' && process.versions?.node) {
        // Dynamic import to prevent module loading errors in browser environments
        const os = await import('os');
        loadAverage = process.platform !== 'win32' ? os.loadavg() : undefined;
        totalMemory = os.totalmem();
        freeMemory = os.freemem();
        cpuCount = os.cpus().length;
      }
    } catch {
      // Ignore errors if os module is not available (e.g., in browser environments)
    }

    const metrics: ResourceMetrics = {
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers || 0,
        percentage: totalMemory ? (memUsage.rss / totalMemory) * 100 : 0,
      },
      cpu: {
        usage: cpuPercentage, // No clamping - let callers decide how to interpret values
        loadAverage,
        userTime: currentCpuUsage.user,
        systemTime: currentCpuUsage.system,
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        ppid: process.ppid,
        platform: process.platform,
        arch: process.arch,
      },
      system: totalMemory
        ? {
            totalMemory,
            freeMemory,
            cpuCount,
          }
        : undefined,
    };

    return metrics;
  }

  private processResourceMetrics(metrics: ResourceMetrics): void {
    this.resourceStats.samples++;
    this.resourceStats.lastSampleTime = new Date().toISOString();

    // Update memory statistics
    const memoryUsageMB = metrics.memory.rss / (1024 * 1024);
    this.updateMemoryStats(memoryUsageMB);

    // Update CPU statistics
    this.updateCpuStats(metrics.cpu.usage);

    // Check for memory leaks
    this.checkMemoryLeak();
  }

  private updateMemoryStats(memoryUsageMB: number): void {
    // Update peak
    if (memoryUsageMB > this.resourceStats.peakMemoryUsage) {
      this.resourceStats.peakMemoryUsage = memoryUsageMB;
    }

    // Update running average
    const totalSamples = this.resourceStats.samples;
    this.resourceStats.averageMemoryUsage =
      (this.resourceStats.averageMemoryUsage * (totalSamples - 1) +
        memoryUsageMB) /
      totalSamples;

    // Add to history for leak detection
    this.memoryHistory.push(memoryUsageMB);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
  }

  private updateCpuStats(cpuUsage: number): void {
    // Update peak
    if (cpuUsage > this.resourceStats.peakCpuUsage) {
      this.resourceStats.peakCpuUsage = cpuUsage;
    }

    // Update running average
    const totalSamples = this.resourceStats.samples;
    this.resourceStats.averageCpuUsage =
      (this.resourceStats.averageCpuUsage * (totalSamples - 1) + cpuUsage) /
      totalSamples;
  }

  private checkMemoryLeak(): void {
    if (this.memoryHistory.length < 20) {
      return; // Need at least 20 samples
    }

    // Simple memory leak detection: check if memory is consistently increasing
    const recentSamples = this.memoryHistory.slice(-20);
    const oldSamples = this.memoryHistory.slice(-40, -20);

    if (oldSamples.length === 0) {
      return;
    }

    const recentAverage =
      recentSamples.reduce((sum, val) => sum + val, 0) / recentSamples.length;
    const oldAverage =
      oldSamples.reduce((sum, val) => sum + val, 0) / oldSamples.length;

    // If recent average is significantly higher than old average
    const threshold = 1.5; // 50% increase threshold - less sensitive to normal fluctuations
    const minMemoryIncrease = 20; // Minimum 20MB increase to avoid false positives
    if (
      recentAverage > oldAverage * threshold &&
      recentAverage - oldAverage > minMemoryIncrease
    ) {
      this.resourceStats.memoryLeakDetected = true;

      this.emitMetric('memory_leak_detected', 1, 'count', {
        recent_average: recentAverage.toFixed(2),
        old_average: oldAverage.toFixed(2),
        increase_ratio: (recentAverage / oldAverage).toFixed(2),
      });
    }
  }

  private emitResourceMetrics(metrics: ResourceMetrics): void {
    // Memory metrics
    this.emitMetric('memory_rss', metrics.memory.rss / (1024 * 1024), 'mb');
    this.emitMetric(
      'memory_heap_used',
      metrics.memory.heapUsed / (1024 * 1024),
      'mb'
    );
    this.emitMetric(
      'memory_heap_total',
      metrics.memory.heapTotal / (1024 * 1024),
      'mb'
    );
    this.emitMetric(
      'memory_external',
      metrics.memory.external / (1024 * 1024),
      'mb'
    );
    this.emitMetric('memory_percentage', metrics.memory.percentage, 'percent');

    // CPU metrics
    this.emitMetric('cpu_usage', metrics.cpu.usage, 'percent');
    this.emitMetric('cpu_user_time', metrics.cpu.userTime / 1000, 'ms');
    this.emitMetric('cpu_system_time', metrics.cpu.systemTime / 1000, 'ms');

    // Load average (Unix only)
    if (metrics.cpu.loadAverage) {
      this.emitMetric('load_average_1m', metrics.cpu.loadAverage[0], 'load');
      this.emitMetric('load_average_5m', metrics.cpu.loadAverage[1], 'load');
      this.emitMetric('load_average_15m', metrics.cpu.loadAverage[2], 'load');
    }

    // Process metrics
    this.emitMetric('process_uptime', metrics.process.uptime, 'seconds');

    // System metrics
    if (metrics.system) {
      if (metrics.system.totalMemory) {
        this.emitMetric(
          'system_memory_total',
          metrics.system.totalMemory / (1024 * 1024),
          'mb'
        );
      }
      if (metrics.system.freeMemory) {
        this.emitMetric(
          'system_memory_free',
          metrics.system.freeMemory / (1024 * 1024),
          'mb'
        );
      }
      if (metrics.system.cpuCount) {
        this.emitMetric('system_cpu_count', metrics.system.cpuCount, 'count');
      }
    }

    // Statistical metrics
    this.emitMetric(
      'memory_usage_average',
      this.resourceStats.averageMemoryUsage,
      'mb'
    );
    this.emitMetric(
      'memory_usage_peak',
      this.resourceStats.peakMemoryUsage,
      'mb'
    );
    this.emitMetric(
      'cpu_usage_average',
      this.resourceStats.averageCpuUsage,
      'percent'
    );
    this.emitMetric(
      'cpu_usage_peak',
      this.resourceStats.peakCpuUsage,
      'percent'
    );
  }

  private resetStats(): void {
    this.resourceStats = {
      samples: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0,
      averageCpuUsage: 0,
      peakCpuUsage: 0,
      memoryLeakDetected: false,
      lastSampleTime: new Date().toISOString(),
    };
    this.memoryHistory = [];
    this.previousCpuUsage = undefined;
    this.previousSampleTime = undefined;
  }

  // Public getters for statistics
  public getResourceStats(): ResourceStats {
    return { ...this.resourceStats };
  }

  public getCurrentResourceUsage(): { memoryMB: number; cpuPercent: number } {
    const memUsage = process.memoryUsage();
    return {
      memoryMB: memUsage.rss / (1024 * 1024),
      cpuPercent: this.resourceStats.averageCpuUsage, // Use average as current
    };
  }

  public isMemoryLeakDetected(): boolean {
    return this.resourceStats.memoryLeakDetected;
  }
}
