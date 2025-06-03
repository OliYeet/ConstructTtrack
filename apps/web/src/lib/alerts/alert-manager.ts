/**
 * Alert Manager
 * Centralized alert management, rules, and escalation
 */

import { getLogger } from '@/lib/logging';
import { NotificationService } from './notification-service';

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

  constructor(config: AlertManagerConfig, notificationService: NotificationService) {
    this.config = config;
    this.notificationService = notificationService;
  }

  // Start alert evaluation
  start(): void {
    if (!this.config.enableAlerts) {
      return;
    }

    this.evaluationTimer = setInterval(() => {
      this.evaluateRules();
    }, this.config.evaluationInterval);

    const logger = getLogger();
    logger.info('Alert manager started', {
      metadata: {
        rulesCount: this.rules.size,
        evaluationInterval: this.config.evaluationInterval,
      },
    });
  }

  // Stop alert evaluation
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
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Check if similar alert already exists
    const existingAlert = Array.from(this.alerts.values()).find(
      alert => alert.fingerprint === fingerprint && alert.status === AlertStatus.ACTIVE
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
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
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
        duration: alert.resolvedAt ? 
          new Date(alert.resolvedAt).getTime() - new Date(alert.timestamp).getTime() :
          0,
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

  // Get metric value (placeholder - would integrate with actual metrics)
  private async getMetricValue(metric: string): Promise<number | string | null> {
    // This would integrate with your actual metrics system
    // For now, return null to indicate metric not found
    return null;
  }

  // Evaluate condition
  private evaluateCondition(condition: AlertCondition, value: number | string): boolean {
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
      rule => rule.category === alert.category || rule.tags.some(tag => alert.tags.includes(tag))
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

  // Schedule escalation notifications
  private scheduleEscalations(alert: Alert, rule: AlertRule): void {
    for (const escalation of rule.escalationRules) {
      setTimeout(async () => {
        const currentAlert = this.alerts.get(alert.id);
        if (!currentAlert || currentAlert.status === AlertStatus.RESOLVED) {
          return;
        }

        // Check escalation condition
        if (escalation.condition === 'unacknowledged' && 
            currentAlert.status === AlertStatus.ACKNOWLEDGED) {
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
            logger.error('Failed to send escalation notification', error, {
              metadata: {
                alertId: alert.id,
                escalationLevel: escalation.level,
                channel,
              },
            });
          }
        }
      }, escalation.delay);
    }
  }

  // Generate alert fingerprint
  private generateFingerprint(title: string, source: string, category: string): string {
    return `${title}|${source}|${category}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
  }

  // Cleanup old alerts
  private cleanup(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    const toDelete: string[] = [];

    this.alerts.forEach((alert, id) => {
      if (alert.status === AlertStatus.RESOLVED && 
          new Date(alert.resolvedAt!).getTime() < cutoff) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.alerts.delete(id));

    // Limit active alerts
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.status === AlertStatus.ACTIVE)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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
      alertsByCategory[alert.category] = (alertsByCategory[alert.category] || 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    });

    return {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => a.status === AlertStatus.ACTIVE).length,
      acknowledgedAlerts: alerts.filter(a => a.status === AlertStatus.ACKNOWLEDGED).length,
      resolvedAlerts: alerts.filter(a => a.status === AlertStatus.RESOLVED).length,
      suppressedAlerts: alerts.filter(a => a.status === AlertStatus.SUPPRESSED).length,
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
