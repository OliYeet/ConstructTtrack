/**
 * Alert Manager
 * Centralized alert management, rules, and escalation
 */

import { NotificationService } from './notification-service';

import { getLogger } from '@/lib/logging';

// Alert severity levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

// Alert status
export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

// Alert interface
export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  category: string;
  timestamp: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  metadata: Record<string, unknown>;
  tags: string[];
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

// Alert rule interface
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: AlertCondition;
  severity: AlertSeverity;
  category: string;
  tags: string[];
  cooldownPeriod: number; // milliseconds
  escalationRules: EscalationRule[];
  notificationChannels: string[];
}

// Alert condition
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
  threshold: number | string;
  duration: number; // milliseconds - how long condition must be true
  evaluationInterval: number; // milliseconds
}

// Escalation rule
export interface EscalationRule {
  level: number;
  delay: number; // milliseconds
  channels: string[];
  condition?: 'unacknowledged' | 'unresolved';
}

// Alert manager configuration
export interface AlertManagerConfig {
  enableAlerts: boolean;
  defaultCooldownPeriod: number;
  maxActiveAlerts: number;
  retentionPeriod: number; // milliseconds
  evaluationInterval: number; // milliseconds
}

// Alert manager class
export class AlertManager {
  private config: AlertManagerConfig;
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private notificationService: NotificationService;
  private evaluationTimer?: NodeJS.Timeout;
  private lastEvaluations: Map<string, number> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout[]> = new Map();

  // Circuit breaker state
  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextRetryTime = 0;
  private readonly maxFailures = 5;

  constructor(
    config: AlertManagerConfig,
    notificationService: NotificationService
  ) {
    this.config = config;
    this.notificationService = notificationService;
  }

  // Start alert manager
  start(): void {
    if (!this.config.enableAlerts) {
      return;
    }

    this.evaluationTimer = setInterval(() => {
      this.evaluateRulesWithCircuitBreaker().catch((error: unknown) => {
        const logger = getLogger();
        logger.error(
          'Unhandled error in rule evaluation',
          error instanceof Error ? error : new Error(String(error))
        );
      });
    }, this.config.evaluationInterval);

    const logger = getLogger();
    logger.info('Alert manager started', {
      metadata: {
        rulesCount: this.rules.size,
        evaluationInterval: this.config.evaluationInterval,
      },
    });
  }

  // Stop alert manager
  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }

    const logger = getLogger();
    logger.info('Alert manager stopped');
  }

  // Add alert rule
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);

    const logger = getLogger();
    logger.info('Alert rule added', {
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
      },
    });
  }

  // Remove alert rule
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.lastEvaluations.delete(ruleId);

    const logger = getLogger();
    logger.info('Alert rule removed', {
      metadata: { ruleId },
    });
  }

  // Fire alert manually
  async fireAlert(
    title: string,
    description: string,
    severity: AlertSeverity,
    source: string,
    category: string,
    metadata: Record<string, unknown> = {},
    tags: string[] = []
  ): Promise<string> {
    const fingerprint = this.generateFingerprint(title, source, category);
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = new Date().toISOString();

    // Check if similar alert already exists
    const existingAlert = Array.from(this.alerts.values()).find(
      alert =>
        alert.fingerprint === fingerprint && alert.status === AlertStatus.ACTIVE
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.count++;
      existingAlert.lastSeen = timestamp;
      existingAlert.metadata = { ...existingAlert.metadata, ...metadata };

      const logger = getLogger();
      logger.info('Alert updated', {
        metadata: {
          alertId: existingAlert.id,
          count: existingAlert.count,
          fingerprint,
        },
      });

      return existingAlert.id;
    }

    // Create new alert
    const alert: Alert = {
      id: alertId,
      title,
      description,
      severity,
      status: AlertStatus.ACTIVE,
      source,
      category,
      timestamp,
      metadata,
      tags,
      fingerprint,
      count: 1,
      firstSeen: timestamp,
      lastSeen: timestamp,
    };

    this.alerts.set(alertId, alert);

    // Send notifications
    await this.sendNotifications(alert);

    // Log alert
    const logger = getLogger();
    logger.warn('Alert fired', {
      metadata: {
        alertId,
        title,
        severity,
        source,
        category,
      },
    });

    // Cleanup old alerts
    this.cleanup();

    return alertId;
  }

  // Acknowledge alert
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== AlertStatus.ACTIVE) {
      return false;
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = acknowledgedBy;

    const logger = getLogger();
    logger.info('Alert acknowledged', {
      metadata: {
        alertId,
        acknowledgedBy,
        title: alert.title,
      },
    });

    return true;
  }

  // Resolve alert
  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date().toISOString();

    const logger = getLogger();
    logger.info('Alert resolved', {
      metadata: {
        alertId,
        title: alert.title,
        duration:
          new Date(alert.resolvedAt).getTime() -
          new Date(alert.timestamp).getTime(),
      },
    });

    return true;
  }

  // Suppress alert
  async suppressAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = AlertStatus.SUPPRESSED;

    const logger = getLogger();
    logger.info('Alert suppressed', {
      metadata: {
        alertId,
        title: alert.title,
      },
    });

    return true;
  }

  // Evaluate alert rules with circuit breaker and exponential backoff
  private async evaluateRulesWithCircuitBreaker(): Promise<void> {
    const now = Date.now();

    // Check circuit breaker state
    if (this.circuitBreakerState === 'OPEN') {
      if (now < this.nextRetryTime) {
        return; // Circuit breaker is open, skip evaluation
      }
      // Try to transition to half-open
      this.circuitBreakerState = 'HALF_OPEN';
    }

    try {
      await this.evaluateRules();

      // Success - reset circuit breaker
      if (this.circuitBreakerState === 'HALF_OPEN') {
        this.circuitBreakerState = 'CLOSED';
        this.failureCount = 0;
      }
    } catch (error) {
      this.handleEvaluationFailure(error);
      throw error;
    }
  }

  // Handle evaluation failure with exponential backoff
  private handleEvaluationFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    const logger = getLogger();
    logger.error(
      'Rule evaluation failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        metadata: {
          failureCount: this.failureCount,
          circuitBreakerState: this.circuitBreakerState,
        },
      }
    );

    // Open circuit breaker if too many failures
    if (this.failureCount >= this.maxFailures) {
      this.circuitBreakerState = 'OPEN';

      // Calculate exponential backoff delay (base 2 seconds, max 5 minutes)
      const baseDelay = 2000; // 2 seconds
      const maxDelay = 5 * 60 * 1000; // 5 minutes
      const exponentialDelay = Math.min(
        baseDelay * Math.pow(2, this.failureCount - this.maxFailures),
        maxDelay
      );

      this.nextRetryTime = this.lastFailureTime + exponentialDelay;

      logger.warn('Circuit breaker opened due to repeated failures', {
        metadata: {
          failureCount: this.failureCount,
          nextRetryTime: new Date(this.nextRetryTime).toISOString(),
          delayMs: exponentialDelay,
        },
      });
    }
  }

  // Evaluate alert rules
  private async evaluateRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        const logger = getLogger();
        logger.error('Failed to evaluate alert rule', error, {
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
          },
        });
      }
    }
  }

  // Evaluate single rule
  private async evaluateRule(rule: AlertRule): Promise<void> {
    const now = Date.now();
    const lastEvaluation = this.lastEvaluations.get(rule.id) || 0;

    // Check if enough time has passed since last evaluation
    if (now - lastEvaluation < rule.condition.evaluationInterval) {
      return;
    }

    this.lastEvaluations.set(rule.id, now);

    // Get metric value (this would integrate with your metrics system)
    const metricValue = await this.getMetricValue(rule.condition.metric);

    if (metricValue === null) {
      return;
    }

    // Evaluate condition
    const conditionMet = this.evaluateCondition(rule.condition, metricValue);

    if (conditionMet) {
      // Check cooldown period
      const recentAlert = Array.from(this.alerts.values()).find(
        alert =>
          alert.source === `rule:${rule.id}` &&
          alert.status === AlertStatus.ACTIVE &&
          new Date(alert.timestamp).getTime() > now - rule.cooldownPeriod
      );

      if (!recentAlert) {
        await this.fireAlert(
          rule.name,
          rule.description,
          rule.severity,
          `rule:${rule.id}`,
          rule.category,
          {
            ruleId: rule.id,
            metricValue,
            threshold: rule.condition.threshold,
            operator: rule.condition.operator,
          },
          rule.tags
        );
      }
    }
  }

  // Get metric value from the metrics system
  private async getMetricValue(
    metric: string
  ): Promise<number | string | null> {
    try {
      // Import metrics modules dynamically to avoid circular dependencies
      const { performanceMonitor } = await import(
        '@/lib/monitoring/performance-monitor'
      );
      const { resourceMonitor } = await import(
        '@/lib/monitoring/resource-monitor'
      );
      const { apiMetricsTracker } = await import(
        '@/lib/monitoring/api-metrics'
      );
      const { errorReporter } = await import('@/lib/errors/error-reporter');

      // Parse metric name to determine source and specific metric
      const [source, metricName] = metric.split('.');

      switch (source) {
        case 'performance': {
          const stats = performanceMonitor.getStats();
          switch (metricName) {
            case 'averageResponseTime':
              return stats.averageResponseTime;
            case 'currentMemoryUsage':
              return stats.currentMemoryUsage;
            case 'totalMetrics':
              return stats.totalMetrics;
            default: {
              // Look for specific metric by name
              const metrics = performanceMonitor.getMetrics();
              const latestMetric = metrics
                .filter(m => m.name === metricName)
                .sort(
                  (a, b) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime()
                )[0];
              return latestMetric?.value ?? null;
            }
          }
        }

        case 'resource': {
          const current = resourceMonitor.getCurrentUsage();
          if (!current) return null;

          switch (metricName) {
            case 'memory_percentage':
              return current.memory.percentage;
            case 'memory_used':
              return current.memory.used;
            case 'cpu_usage':
              return current.cpu.usage;
            case 'heap_usage':
              return current.memory.heap
                ? (current.memory.heap.used / current.memory.heap.total) * 100
                : null;
            default:
              return null;
          }
        }

        case 'api': {
          const apiStats = apiMetricsTracker.getAggregatedMetrics();
          switch (metricName) {
            case 'totalRequests':
              return apiStats.totalRequests;
            case 'averageResponseTime':
              return apiStats.averageResponseTime;
            case 'errorRate':
              // Calculate error rate from available data
              return apiStats.totalRequests > 0
                ? apiStats.totalErrors / apiStats.totalRequests
                : 0;
            case 'requestsPerMinute':
              return apiStats.requestsPerMinute;
            default:
              return null;
          }
        }

        case 'error': {
          const errorStats = errorReporter.getStats();
          switch (metricName) {
            case 'totalErrors':
              return errorStats.totalReports; // Use correct property name
            case 'errorRate':
              // Calculate error rate based on recent errors
              return errorStats.recentErrors;
            case 'uniqueErrors':
              return errorStats.uniqueErrors;
            default:
              return null;
          }
        }

        default: {
          // Try to find metric in performance monitor by full name
          const metrics = performanceMonitor.getMetrics();
          const latestMetric = metrics
            .filter(m => m.name === metric)
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            )[0];
          return latestMetric?.value ?? null;
        }
      }
    } catch (error) {
      const logger = getLogger();
      logger.error(
        'Failed to get metric value',
        error instanceof Error ? error : new Error(String(error)),
        {
          metadata: { metric },
        }
      );
      return null;
    }
  }

  // Evaluate condition
  private evaluateCondition(
    condition: AlertCondition,
    value: number | string
  ): boolean {
    const { operator, threshold } = condition;

    if (typeof value === 'number' && typeof threshold === 'number') {
      switch (operator) {
        case 'gt':
          return value > threshold;
        case 'gte':
          return value >= threshold;
        case 'lt':
          return value < threshold;
        case 'lte':
          return value <= threshold;
        case 'eq':
          return value === threshold;
        default:
          return false;
      }
    }

    if (typeof value === 'string' && typeof threshold === 'string') {
      switch (operator) {
        case 'eq':
          return value === threshold;
        case 'contains':
          return value.includes(threshold);
        default:
          return false;
      }
    }

    return false;
  }

  // Send notifications for alert
  private async sendNotifications(alert: Alert): Promise<void> {
    // Find applicable rules
    const applicableRules = Array.from(this.rules.values()).filter(
      rule =>
        rule.category === alert.category ||
        rule.tags.some(tag => alert.tags.includes(tag))
    );

    // Send immediate notifications
    for (const rule of applicableRules) {
      for (const channel of rule.notificationChannels) {
        try {
          await this.notificationService.sendNotification(channel, {
            title: alert.title,
            message: alert.description,
            severity: alert.severity,
            metadata: alert.metadata,
          });
        } catch (error) {
          const logger = getLogger();
          logger.error('Failed to send alert notification', error, {
            metadata: {
              alertId: alert.id,
              channel,
              ruleId: rule.id,
            },
          });
        }
      }

      // Schedule escalations
      this.scheduleEscalations(alert, rule);
    }
  }

  // Schedule escalations for an alert
  private scheduleEscalations(alert: Alert, rule: AlertRule): void {
    const alertTimers: NodeJS.Timeout[] = [];

    for (const escalation of rule.escalationRules) {
      const timer = setTimeout(async () => {
        const currentAlert = this.alerts.get(alert.id);
        if (!currentAlert || currentAlert.status === AlertStatus.RESOLVED) {
          return;
        }

        // Check escalation condition
        if (
          escalation.condition === 'unacknowledged' &&
          currentAlert.status === AlertStatus.ACKNOWLEDGED
        ) {
          return;
        }

        // Send escalation notifications
        for (const channel of escalation.channels) {
          try {
            await this.notificationService.sendNotification(channel, {
              title: `ESCALATION: ${alert.title}`,
              message: `Alert has been escalated (Level ${escalation.level}): ${alert.description}`,
              severity: alert.severity,
              metadata: {
                ...alert.metadata,
                escalationLevel: escalation.level,
                originalAlertId: alert.id,
              },
            });
          } catch (error) {
            const logger = getLogger();
            logger.error(
              'Failed to send escalation notification',
              error instanceof Error ? error : new Error(String(error)),
              {
                metadata: {
                  alertId: alert.id,
                  escalationLevel: escalation.level,
                  channel,
                },
              }
            );
          }
        }
      }, escalation.delay);

      alertTimers.push(timer);
    }

    this.escalationTimers.set(alert.id, alertTimers);
  }

  // Generate alert fingerprint
  private generateFingerprint(
    title: string,
    source: string,
    category: string
  ): string {
    return `${title}|${source}|${category}`
      .toLowerCase()
      .replace(/[^a-z0-9|]/g, '');
  }

  // Cleanup old alerts
  private cleanup(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    const toDelete: string[] = [];

    this.alerts.forEach((alert, id) => {
      if (
        alert.status === AlertStatus.RESOLVED &&
        alert.resolvedAt &&
        new Date(alert.resolvedAt).getTime() < cutoff
      ) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.alerts.delete(id));

    // Limit active alerts
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.status === AlertStatus.ACTIVE)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    if (activeAlerts.length > this.config.maxActiveAlerts) {
      const toSuppress = activeAlerts.slice(this.config.maxActiveAlerts);
      toSuppress.forEach(alert => {
        alert.status = AlertStatus.SUPPRESSED;
      });
    }
  }

  // Get alerts
  getAlerts(status?: AlertStatus): Alert[] {
    const alerts = Array.from(this.alerts.values());
    return status ? alerts.filter(alert => alert.status === status) : alerts;
  }

  // Get alert by ID
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  // Get alert statistics
  getStats(): {
    totalAlerts: number;
    activeAlerts: number;
    acknowledgedAlerts: number;
    resolvedAlerts: number;
    suppressedAlerts: number;
    alertsByCategory: Record<string, number>;
    alertsBySeverity: Record<string, number>;
  } {
    const alerts = Array.from(this.alerts.values());

    const alertsByCategory: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};

    alerts.forEach(alert => {
      alertsByCategory[alert.category] =
        (alertsByCategory[alert.category] || 0) + 1;
      alertsBySeverity[alert.severity] =
        (alertsBySeverity[alert.severity] || 0) + 1;
    });

    return {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => a.status === AlertStatus.ACTIVE).length,
      acknowledgedAlerts: alerts.filter(
        a => a.status === AlertStatus.ACKNOWLEDGED
      ).length,
      resolvedAlerts: alerts.filter(a => a.status === AlertStatus.RESOLVED)
        .length,
      suppressedAlerts: alerts.filter(a => a.status === AlertStatus.SUPPRESSED)
        .length,
      alertsByCategory,
      alertsBySeverity,
    };
  }
}

// Default configuration
export const defaultAlertManagerConfig: AlertManagerConfig = {
  enableAlerts: true,
  defaultCooldownPeriod: 5 * 60 * 1000, // 5 minutes
  maxActiveAlerts: 100,
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  evaluationInterval: 30 * 1000, // 30 seconds
};
