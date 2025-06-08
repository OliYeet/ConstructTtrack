/**
 * Performance Regression Detector
 *
 * Monitors performance metrics and detects regressions
 * Provides alerts and rollback recommendations
 *
 * Part of LUM-584 Performance Optimization Phase 3
 */

import { logger } from '../utils/logger';

import { connectionOptimizer } from './connection-optimizer';
import { performanceProfiler } from './performance-profiler';

export interface PerformanceBaseline {
  timestamp: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  connectionCount: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface RegressionAlert {
  metric: string;
  severity: 'warning' | 'critical';
  currentValue: number;
  baselineValue: number;
  degradation: number;
  threshold: number;
  timestamp: number;
  recommendation: string;
}

export interface RegressionConfig {
  enabled: boolean;
  checkInterval: number;
  warningThreshold: number; // % degradation for warning
  criticalThreshold: number; // % degradation for critical alert
  baselineWindow: number; // Time window for baseline calculation
  minSamples: number; // Minimum samples for reliable baseline
}

export class RegressionDetector {
  private baselines: PerformanceBaseline[] = [];
  private alerts: RegressionAlert[] = [];
  private checkInterval: ReturnType<typeof globalThis.setInterval> | null =
    null;

  constructor(
    private readonly config: RegressionConfig = {
      enabled: true,
      checkInterval: 60000, // 1 minute
      warningThreshold: 15, // 15% degradation warning
      criticalThreshold: 30, // 30% degradation critical
      baselineWindow: 300000, // 5 minutes
      minSamples: 10,
    }
  ) {}

  /**
   * Start regression monitoring
   */
  start(): void {
    if (!this.config.enabled) {
      return;
    }

    this.checkInterval = globalThis.setInterval(() => {
      this.checkForRegressions();
    }, this.config.checkInterval);

    logger.info('Regression detector started', {
      checkInterval: this.config.checkInterval,
      warningThreshold: this.config.warningThreshold,
      criticalThreshold: this.config.criticalThreshold,
    });
  }

  /**
   * Stop regression monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      globalThis.clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    logger.info('Regression detector stopped');
  }

  /**
   * Record performance baseline
   */
  recordBaseline(): void {
    const performanceStats = performanceProfiler.getPerformanceSummary();
    const connectionStats = connectionOptimizer.getPoolStats();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const baseline: PerformanceBaseline = {
      timestamp: Date.now(),
      averageLatency: performanceStats.averageLatency,
      p95Latency: 0, // Would need to implement in profiler
      p99Latency: 0, // Would need to implement in profiler
      throughput: connectionStats.throughput,
      errorRate: connectionStats.errorRate,
      connectionCount: connectionStats.totalConnections,
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: cpuUsage.user + cpuUsage.system,
    };

    this.baselines.push(baseline);

    // Keep only recent baselines
    const cutoff = Date.now() - this.config.baselineWindow * 2; // Keep 2x window for comparison
    this.baselines = this.baselines.filter(b => b.timestamp >= cutoff);

    logger.debug('Performance baseline recorded', baseline);
  }

  /**
   * Get current performance baseline
   */
  getCurrentBaseline(): PerformanceBaseline | null {
    const cutoff = Date.now() - this.config.baselineWindow;
    const recentBaselines = this.baselines.filter(b => b.timestamp >= cutoff);

    if (recentBaselines.length < this.config.minSamples) {
      return null;
    }

    // Calculate average baseline from recent samples
    const avgBaseline: PerformanceBaseline = {
      timestamp: Date.now(),
      averageLatency: this.average(recentBaselines.map(b => b.averageLatency)),
      p95Latency: this.average(recentBaselines.map(b => b.p95Latency)),
      p99Latency: this.average(recentBaselines.map(b => b.p99Latency)),
      throughput: this.average(recentBaselines.map(b => b.throughput)),
      errorRate: this.average(recentBaselines.map(b => b.errorRate)),
      connectionCount: this.average(
        recentBaselines.map(b => b.connectionCount)
      ),
      memoryUsage: this.average(recentBaselines.map(b => b.memoryUsage)),
      cpuUsage: this.average(recentBaselines.map(b => b.cpuUsage)),
    };

    return avgBaseline;
  }

  /**
   * Check for performance regressions
   */
  checkForRegressions(): void {
    const baseline = this.getCurrentBaseline();
    if (!baseline) {
      logger.debug('Insufficient baseline data for regression detection');
      return;
    }

    // Get current performance metrics without recording to baseline yet
    const current = this.getCurrentPerformanceSnapshot();
    if (!current) return;

    const newAlerts: RegressionAlert[] = [];

    // Check latency regression
    const latencyDegradation = this.calculateDegradation(
      baseline.averageLatency,
      current.averageLatency
    );
    if (latencyDegradation > this.config.warningThreshold) {
      newAlerts.push({
        metric: 'averageLatency',
        severity:
          latencyDegradation > this.config.criticalThreshold
            ? 'critical'
            : 'warning',
        currentValue: current.averageLatency,
        baselineValue: baseline.averageLatency,
        degradation: latencyDegradation,
        threshold:
          latencyDegradation > this.config.criticalThreshold
            ? this.config.criticalThreshold
            : this.config.warningThreshold,
        timestamp: Date.now(),
        recommendation: this.getLatencyRecommendation(latencyDegradation),
      });
    }

    // Check throughput regression (inverse - lower is worse)
    const throughputDegradation = this.calculateThroughputDegradation(
      baseline.throughput,
      current.throughput
    );
    if (throughputDegradation > this.config.warningThreshold) {
      newAlerts.push({
        metric: 'throughput',
        severity:
          throughputDegradation > this.config.criticalThreshold
            ? 'critical'
            : 'warning',
        currentValue: current.throughput,
        baselineValue: baseline.throughput,
        degradation: throughputDegradation,
        threshold:
          throughputDegradation > this.config.criticalThreshold
            ? this.config.criticalThreshold
            : this.config.warningThreshold,
        timestamp: Date.now(),
        recommendation: this.getThroughputRecommendation(throughputDegradation),
      });
    }

    // Check error rate regression
    const errorRateDegradation = this.calculateDegradation(
      baseline.errorRate,
      current.errorRate
    );
    if (errorRateDegradation > this.config.warningThreshold) {
      newAlerts.push({
        metric: 'errorRate',
        severity:
          errorRateDegradation > this.config.criticalThreshold
            ? 'critical'
            : 'warning',
        currentValue: current.errorRate,
        baselineValue: baseline.errorRate,
        degradation: errorRateDegradation,
        threshold:
          errorRateDegradation > this.config.criticalThreshold
            ? this.config.criticalThreshold
            : this.config.warningThreshold,
        timestamp: Date.now(),
        recommendation: this.getErrorRateRecommendation(errorRateDegradation),
      });
    }

    // Check memory usage regression
    const memoryDegradation = this.calculateDegradation(
      baseline.memoryUsage,
      current.memoryUsage
    );
    if (memoryDegradation > this.config.warningThreshold) {
      newAlerts.push({
        metric: 'memoryUsage',
        severity:
          memoryDegradation > this.config.criticalThreshold
            ? 'critical'
            : 'warning',
        currentValue: current.memoryUsage,
        baselineValue: baseline.memoryUsage,
        degradation: memoryDegradation,
        threshold:
          memoryDegradation > this.config.criticalThreshold
            ? this.config.criticalThreshold
            : this.config.warningThreshold,
        timestamp: Date.now(),
        recommendation: this.getMemoryRecommendation(memoryDegradation),
      });
    }

    // Process new alerts
    newAlerts.forEach(alert => {
      this.alerts.push(alert);
      this.logAlert(alert);
    });

    // Now record the current baseline after comparison (prevents double-counting)
    this.recordBaseline();

    // Cleanup old alerts (keep last 24 hours)
    const alertCutoff = Date.now() - 86400000; // 24 hours
    this.alerts = this.alerts.filter(alert => alert.timestamp >= alertCutoff);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(hours: number = 1): RegressionAlert[] {
    const cutoff = Date.now() - hours * 3600000;
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Get regression summary
   */
  getRegressionSummary(): {
    totalAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    affectedMetrics: string[];
    recommendations: string[];
  } {
    const recentAlerts = this.getRecentAlerts(24); // Last 24 hours
    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical');
    const warningAlerts = recentAlerts.filter(a => a.severity === 'warning');
    const affectedMetrics = [...new Set(recentAlerts.map(a => a.metric))];
    const recommendations = [
      ...new Set(recentAlerts.map(a => a.recommendation)),
    ];

    return {
      totalAlerts: recentAlerts.length,
      criticalAlerts: criticalAlerts.length,
      warningAlerts: warningAlerts.length,
      affectedMetrics,
      recommendations,
    };
  }

  /**
   * Get current performance snapshot without recording to baseline
   */
  private getCurrentPerformanceSnapshot(): PerformanceBaseline | null {
    const profilerSummary = performanceProfiler.getPerformanceSummary();
    const connectionStats = connectionOptimizer.getPoolStats();

    return {
      timestamp: Date.now(),
      averageLatency: profilerSummary.averageLatency || 0,
      p95Latency: 0, // Not available in current profiler summary
      p99Latency: 0, // Not available in current profiler summary
      throughput: connectionStats.throughput || 0,
      errorRate: connectionStats.errorRate || 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuUsage: 0, // Not available in current profiler summary
      connectionCount: connectionStats.activeConnections || 0,
    };
  }

  /**
   * Calculate performance degradation percentage (only returns positive for actual degradations)
   */
  private calculateDegradation(baseline: number, current: number): number {
    // Prevent division by zero and handle edge cases
    if (
      baseline === 0 ||
      !Number.isFinite(baseline) ||
      !Number.isFinite(current)
    ) {
      return 0;
    }

    // For very small baselines, use absolute difference instead of percentage
    if (Math.abs(baseline) < 0.001) {
      return current > baseline + 0.001 ? 100 : 0;
    }

    // Only return positive values for actual degradations (current > baseline)
    const degradation = ((current - baseline) / baseline) * 100;
    return Math.max(0, degradation);
  }

  /**
   * Calculate throughput degradation (for throughput, lower is worse)
   */
  private calculateThroughputDegradation(
    baseline: number,
    current: number
  ): number {
    // Prevent division by zero and handle edge cases
    if (
      baseline === 0 ||
      !Number.isFinite(baseline) ||
      !Number.isFinite(current)
    ) {
      return 0;
    }

    // For very small baselines, use absolute difference instead of percentage
    if (Math.abs(baseline) < 0.001) {
      return current < baseline - 0.001 ? 100 : 0;
    }

    // For throughput, degradation is when current < baseline
    const degradation = ((baseline - current) / baseline) * 100;
    return Math.max(0, degradation);
  }

  /**
   * Calculate average of array with safety checks
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;

    // Filter out invalid values
    const validValues = values.filter(
      val => Number.isFinite(val) && !isNaN(val)
    );
    if (validValues.length === 0) return 0;

    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }

  /**
   * Log regression alert
   */
  private logAlert(alert: RegressionAlert): void {
    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';

    logger[logLevel]('Performance regression detected', {
      metric: alert.metric,
      severity: alert.severity,
      degradation: `${alert.degradation.toFixed(1)}%`,
      currentValue: alert.currentValue,
      baselineValue: alert.baselineValue,
      recommendation: alert.recommendation,
    });
  }

  /**
   * Get latency regression recommendation
   */
  private getLatencyRecommendation(degradation: number): string {
    if (degradation > 50) {
      return 'Critical latency regression - consider immediate rollback';
    } else if (degradation > 30) {
      return 'Significant latency increase - review recent optimizations';
    } else {
      return 'Monitor latency trends and investigate potential causes';
    }
  }

  /**
   * Get throughput regression recommendation
   */
  private getThroughputRecommendation(degradation: number): string {
    if (degradation > 50) {
      return 'Critical throughput drop - check for bottlenecks or rollback';
    } else if (degradation > 30) {
      return 'Throughput decreased - review connection pooling and batching';
    } else {
      return 'Monitor throughput and check for resource constraints';
    }
  }

  /**
   * Get error rate regression recommendation
   */
  private getErrorRateRecommendation(degradation: number): string {
    if (degradation > 100) {
      return 'Critical error rate increase - immediate investigation required';
    } else if (degradation > 50) {
      return 'Error rate spike - check logs and recent changes';
    } else {
      return 'Monitor error patterns and validate recent optimizations';
    }
  }

  /**
   * Get memory regression recommendation
   */
  private getMemoryRecommendation(degradation: number): string {
    if (degradation > 100) {
      return 'Critical memory usage increase - check for memory leaks';
    } else if (degradation > 50) {
      return 'High memory usage - review caching and optimization strategies';
    } else {
      return 'Monitor memory trends and optimize cache sizes if needed';
    }
  }
}

// Global regression detector instance
export const regressionDetector = new RegressionDetector();
