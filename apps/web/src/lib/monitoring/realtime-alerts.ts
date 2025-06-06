/**
 * Real-time Alert Manager
 *
 * Handles alerting for real-time performance monitoring based on Charlie's
 * strategic requirements:
 * - Alert if error ratio >1%
 * - Alert if average latency >500ms for 5 min
 * - P90/P99 latency monitoring with <250ms goal
 */

import { getLogger } from '../logging';

import { RealtimeAlert, RealtimeAlertConfig } from './realtime-metrics';

export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack' | 'console';
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface AlertNotification {
  alert: RealtimeAlert;
  channel: AlertChannel;
  timestamp: number;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

export class RealtimeAlertManager {
  private config: RealtimeAlertConfig;
  private alertChannels: Map<string, AlertChannel> = new Map();
  private notifications: AlertNotification[] = [];
  private maxNotificationHistory = 1000;

  constructor(config: RealtimeAlertConfig) {
    this.config = config;
    this.setupDefaultChannels();
  }

  // Setup default alert channels
  private setupDefaultChannels(): void {
    // Console logging (always enabled for development)
    this.alertChannels.set('console', {
      type: 'console',
      config: {},
      enabled: true,
    });

    // Email channels
    if (this.config.channels.email) {
      this.config.channels.email.forEach((email, index) => {
        this.alertChannels.set(`email_${index}`, {
          type: 'email',
          config: { recipient: email },
          enabled: true,
        });
      });
    }

    // Webhook channels
    if (this.config.channels.webhook) {
      this.config.channels.webhook.forEach((webhook, index) => {
        this.alertChannels.set(`webhook_${index}`, {
          type: 'webhook',
          config: { url: webhook },
          enabled: true,
        });
      });
    }

    // Slack channels
    if (this.config.channels.slack) {
      this.config.channels.slack.forEach((slack, index) => {
        this.alertChannels.set(`slack_${index}`, {
          type: 'slack',
          config: { webhook: slack },
          enabled: true,
        });
      });
    }
  }

  // Send alert through all configured channels
  async sendAlert(alert: RealtimeAlert): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const logger = getLogger();
    logger.info('Sending real-time alert', {
      metadata: { alert },
    });

    // Send to all enabled channels
    const sendPromises = Array.from(this.alertChannels.values())
      .filter(channel => channel.enabled)
      .map(channel => this.sendToChannel(alert, channel));

    await Promise.allSettled(sendPromises);
  }

  // Send alert to a specific channel
  private async sendToChannel(
    alert: RealtimeAlert,
    channel: AlertChannel
  ): Promise<void> {
    const notification: AlertNotification = {
      alert,
      channel,
      timestamp: Date.now(),
      status: 'pending',
    };

    try {
      switch (channel.type) {
        case 'console':
          await this.sendToConsole(alert);
          break;
        case 'email':
          await this.sendToEmail(alert, channel.config);
          break;
        case 'webhook':
          await this.sendToWebhook(alert, channel.config);
          break;
        case 'slack':
          await this.sendToSlack(alert, channel.config);
          break;
        default:
          throw new Error(`Unknown alert channel type: ${channel.type}`);
      }

      notification.status = 'sent';
    } catch (error) {
      notification.status = 'failed';
      notification.error =
        error instanceof Error ? error.message : 'Unknown error';

      const logger = getLogger();
      logger.error('Failed to send alert to channel', {
        metadata: {
          alert: alert.id,
          channel: channel.type,
          error: notification.error,
        },
      });
    }

    this.notifications.push(notification);
    this.cleanupNotifications();
  }

  // Send alert to console (for development and logging)
  private async sendToConsole(alert: RealtimeAlert): Promise<void> {
    const logger = getLogger();

    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
    logger[logLevel](`🚨 REAL-TIME ALERT [${alert.severity.toUpperCase()}]`, {
      metadata: {
        id: alert.id,
        type: alert.type,
        message: alert.message,
        details: alert.details,
        timestamp: new Date(alert.timestamp).toISOString(),
      },
    });
  }

  // Send alert via email (placeholder - implement with your email service)
  private async sendToEmail(
    alert: RealtimeAlert,
    config: Record<string, unknown>
  ): Promise<void> {
    const recipient = config.recipient as string;

    // TODO: Implement email sending with your preferred service (SendGrid, AWS SES, etc.)
    const logger = getLogger();
    logger.info('Email alert would be sent', {
      metadata: {
        recipient,
        alert: {
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
        },
      },
    });

    // For now, just log that we would send an email
    // In production, replace this with actual email sending logic
  }

  // Send alert via webhook
  private async sendToWebhook(
    alert: RealtimeAlert,
    config: Record<string, unknown>
  ): Promise<void> {
    const webhookUrl = config.url as string;

    const payload = {
      alert: {
        id: alert.id,
        timestamp: alert.timestamp,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        details: alert.details,
      },
      source: 'constructtrack-realtime-monitor',
      environment: process.env.NODE_ENV || 'development',
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ConstructTrack-RealtimeMonitor/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook request failed: ${response.status} ${response.statusText}`
      );
    }
  }

  // Send alert to Slack
  private async sendToSlack(
    alert: RealtimeAlert,
    config: Record<string, unknown>
  ): Promise<void> {
    const webhookUrl = config.webhook as string;

    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';

    const payload = {
      text: `${emoji} Real-time Performance Alert`,
      attachments: [
        {
          color,
          title: `${alert.type.toUpperCase()} Alert - ${alert.severity.toUpperCase()}`,
          text: alert.message,
          fields: [
            {
              title: 'Alert ID',
              value: alert.id,
              short: true,
            },
            {
              title: 'Timestamp',
              value: new Date(alert.timestamp).toISOString(),
              short: true,
            },
            {
              title: 'Details',
              value: JSON.stringify(alert.details, null, 2),
              short: false,
            },
          ],
          footer: 'ConstructTrack Real-time Monitor',
          ts: Math.floor(alert.timestamp / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Slack webhook request failed: ${response.status} ${response.statusText}`
      );
    }
  }

  // Check if alert should be sent based on cooldown and deduplication
  shouldSendAlert(alert: RealtimeAlert, lastAlertTime?: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Check cooldown period
    if (lastAlertTime) {
      const timeSinceLastAlert = alert.timestamp - lastAlertTime;
      if (timeSinceLastAlert < this.config.cooldownPeriod) {
        return false;
      }
    }

    return true;
  }

  // Get notification history
  getNotificationHistory(limit = 100): AlertNotification[] {
    return this.notifications
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // Get notification statistics
  getNotificationStats(): {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    successRate: number;
  } {
    const total = this.notifications.length;
    const sent = this.notifications.filter(n => n.status === 'sent').length;
    const failed = this.notifications.filter(n => n.status === 'failed').length;
    const pending = this.notifications.filter(
      n => n.status === 'pending'
    ).length;
    const successRate = total > 0 ? sent / total : 1;

    return {
      total,
      sent,
      failed,
      pending,
      successRate,
    };
  }

  // Add or update alert channel
  addChannel(id: string, channel: AlertChannel): void {
    this.alertChannels.set(id, channel);
  }

  // Remove alert channel
  removeChannel(id: string): void {
    this.alertChannels.delete(id);
  }

  // Enable/disable alert channel
  setChannelEnabled(id: string, enabled: boolean): void {
    const channel = this.alertChannels.get(id);
    if (channel) {
      channel.enabled = enabled;
    }
  }

  // Update alert configuration
  updateConfig(config: Partial<RealtimeAlertConfig>): void {
    this.config = { ...this.config, ...config };
    this.setupDefaultChannels();
  }

  // Cleanup old notifications
  private cleanupNotifications(): void {
    if (this.notifications.length > this.maxNotificationHistory) {
      this.notifications = this.notifications.slice(
        -this.maxNotificationHistory
      );
    }
  }
}

// Create alert message formatters for different alert types
export const AlertFormatters = {
  latency: (alert: RealtimeAlert): string => {
    const details = alert.details as any;
    if (details.p99Latency) {
      return `P99 latency is ${details.p99Latency.toFixed(2)}ms (threshold: ${details.threshold}ms) over ${details.sampleSize} events`;
    }
    return `End-to-end latency is ${details.latency}ms (threshold: ${details.threshold}ms) for event ${details.eventId}`;
  },

  error_rate: (alert: RealtimeAlert): string => {
    const details = alert.details as any;
    return `Error rate is ${(details.errorRate * 100).toFixed(2)}% (threshold: ${(details.threshold * 100).toFixed(2)}%) with ${details.totalErrors} errors out of ${details.totalEvents} events`;
  },

  connection: (alert: RealtimeAlert): string => {
    const details = alert.details as any;
    if (details.connectionTime) {
      return `Connection time is ${details.connectionTime}ms (threshold: ${details.threshold}ms) for connection ${details.connectionId}`;
    }
    if (details.reconnectionAttempts) {
      return `${details.reconnectionAttempts} reconnection attempts (threshold: ${details.threshold}) for connection ${details.connectionId}`;
    }
    if (details.successRate !== undefined) {
      return `Connection success rate is ${(details.successRate * 100).toFixed(1)}% (threshold: ${(details.threshold * 100).toFixed(1)}%)`;
    }
    return alert.message;
  },

  throughput: (alert: RealtimeAlert): string => {
    const details = alert.details as any;
    return `Throughput issue: ${JSON.stringify(details)}`;
  },
};
