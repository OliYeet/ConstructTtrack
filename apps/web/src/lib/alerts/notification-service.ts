/**
 * Notification Service
 * Handles delivery of notifications via multiple channels
 */

import { getLogger } from '@/lib/logging';
import { AlertSeverity } from './alert-manager';

// Notification message interface
export interface NotificationMessage {
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, unknown>;
}

// Base notification channel interface
interface BaseNotificationChannel {
  id: string;
  name: string;
  enabled: boolean;
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

// Discriminated union for notification channels
export type NotificationChannel =
  | (BaseNotificationChannel & { type: 'email'; config: EmailConfig })
  | (BaseNotificationChannel & { type: 'sms'; config: SmsConfig })
  | (BaseNotificationChannel & { type: 'webhook'; config: WebhookConfig })
  | (BaseNotificationChannel & { type: 'slack'; config: SlackConfig })
  | (BaseNotificationChannel & { type: 'discord'; config: WebhookConfig });

// Email configuration
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
}

// SMS configuration
export interface SmsConfig {
  provider: 'twilio' | 'aws-sns';
  accountSid?: string;
  authToken?: string;
  fromNumber: string;
  toNumbers: string[];
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// Webhook configuration
export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  timeout: number;
}

// Slack configuration
export interface SlackConfig {
  webhookUrl: string;
  channel: string;
  username?: string;
  iconEmoji?: string;
}

// Notification service class
export class NotificationService {
  private channels: Map<string, NotificationChannel> = new Map();

  // Add notification channel
  addChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
    
    const logger = getLogger();
    logger.info('Notification channel added', {
      metadata: {
        channelId: channel.id,
        channelType: channel.type,
        channelName: channel.name,
      },
    });
  }

  // Remove notification channel
  removeChannel(channelId: string): void {
    this.channels.delete(channelId);
    
    const logger = getLogger();
    logger.info('Notification channel removed', {
      metadata: { channelId },
    });
  }

  // Send notification
  async sendNotification(channelId: string, message: NotificationMessage): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel || !channel.enabled) {
      return false;
    }

    let attempt = 0;
    while (attempt <= channel.retryAttempts) {
      try {
        await this.sendToChannel(channel, message);
        
        const logger = getLogger();
        logger.info('Notification sent successfully', {
          metadata: {
            channelId,
            channelType: channel.type,
            title: message.title,
            severity: message.severity,
            attempt: attempt + 1,
          },
        });

        return true;
      } catch (error) {
        attempt++;
        
        const logger = getLogger();
        logger.warn('Notification send failed', {
          metadata: {
            channelId,
            channelType: channel.type,
            title: message.title,
            attempt,
            maxAttempts: channel.retryAttempts + 1,
            error: error instanceof Error ? error.message : String(error),
          },
        });
 let attempt = 0;
 while (attempt < channel.retryAttempts) {
    …
   if (attempt < channel.retryAttempts) {
     // Exponential back-off with ±10 % jitter
     const backoff = channel.retryDelay * 2 ** (attempt - 1);
     const jitter  = backoff * 0.1 * (Math.random() - 0.5);
     await this.delay(backoff + jitter);
    }
 }
    return false;
  }

  // Send to specific channel type
  private async sendToChannel(channel: NotificationChannel, message: NotificationMessage): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmail(channel.config, message);
        break;
      case 'sms':
        await this.sendSms(channel.config, message);
        break;
      case 'webhook':
        await this.sendWebhook(channel.config, message);
        break;
      case 'slack':
        await this.sendSlack(channel.config, message);
        break;
      case 'discord':
        await this.sendDiscord(channel.config, message);
        break;
      default:
        // TypeScript will ensure this is never reached due to exhaustive checking
        const _exhaustiveCheck: never = channel;
        throw new Error(`Unsupported channel type: ${(_exhaustiveCheck as any).type}`);
    }
  }

  // Send email notification
  private async sendEmail(config: EmailConfig, message: NotificationMessage): Promise<void> {
    // This would integrate with an email service like nodemailer
    // For now, we'll simulate the email sending
    
    const emailBody = this.formatEmailBody(message);
    
    // Simulate email sending
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email notification (simulated):');
      console.log(`To: ${config.to.join(', ')}`);
      console.log(`Subject: [${message.severity.toUpperCase()}] ${message.title}`);
      console.log(`Body: ${emailBody}`);
      return;
    }

    // In production, you would use a real email service:
    /*
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });

    await transporter.sendMail({
      from: config.from,
      to: config.to.join(', '),
      subject: `[${message.severity.toUpperCase()}] ${message.title}`,
      html: emailBody,
    });
    */
  }

  // Send SMS notification
  private async sendSms(config: SmsConfig, message: NotificationMessage): Promise<void> {
    const smsBody = this.formatSmsBody(message);

    // Simulate SMS sending
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 SMS notification (simulated):');
      console.log(`To: ${config.toNumbers.join(', ')}`);
      console.log(`Body: ${smsBody}`);
      return;
    }

    // In production, you would use a real SMS service:
    /*
    if (config.provider === 'twilio') {
      const twilio = require('twilio');
      const client = twilio(config.accountSid, config.authToken);
      
      for (const toNumber of config.toNumbers) {
        await client.messages.create({
          body: smsBody,
          from: config.fromNumber,
          to: toNumber,
        });
      }
    }
    */
  }

  // Send webhook notification
  private async sendWebhook(config: WebhookConfig, message: NotificationMessage): Promise<void> {
    const payload = {
      title: message.title,
      message: message.message,
      severity: message.severity,
      timestamp: new Date().toISOString(),
      metadata: message.metadata,
    };

    const response = await fetch(config.url, {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  // Send Slack notification
  private async sendSlack(config: SlackConfig, message: NotificationMessage): Promise<void> {
    const color = this.getSeverityColor(message.severity);
    
    const payload = {
      channel: config.channel,
      username: config.username || 'ConstructTrack Alerts',
      icon_emoji: config.iconEmoji || ':warning:',
      attachments: [
        {
          color,
          title: message.title,
          text: message.message,
          fields: [
            {
              title: 'Severity',
              value: message.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Timestamp',
              value: new Date().toISOString(),
              short: true,
            },
          ],
          footer: 'ConstructTrack',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
    }
  }

  // Send Discord notification
  private async sendDiscord(config: WebhookConfig, message: NotificationMessage): Promise<void> {
    const color = this.getSeverityColorHex(message.severity);
    
    const payload = {
      embeds: [
        {
          title: message.title,
          description: message.message,
          color: parseInt(color.replace('#', ''), 16),
          fields: [
            {
              name: 'Severity',
              value: message.severity.toUpperCase(),
              inline: true,
            },
            {
              name: 'Timestamp',
              value: new Date().toISOString(),
              inline: true,
            },
          ],
          footer: {
            text: 'ConstructTrack',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord notification failed: ${response.status} ${response.statusText}`);
    }
  }

  // Format email body
  private formatEmailBody(message: NotificationMessage): string {
    return `
      <html>
        <body>
          <h2 style="color: ${this.getSeverityColorHex(message.severity)};">
            ${message.title}
          </h2>
          <p><strong>Severity:</strong> ${message.severity.toUpperCase()}</p>
          <p><strong>Message:</strong></p>
          <p>${message.message}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          ${message.metadata ? `
            <p><strong>Additional Information:</strong></p>
            <pre>${JSON.stringify(message.metadata, null, 2)}</pre>
          ` : ''}
          <hr>
          <p><small>This alert was generated by ConstructTrack monitoring system.</small></p>
        </body>
      </html>
    `;
  }

  // Format SMS body
  private formatSmsBody(message: NotificationMessage): string {
    return `[${message.severity.toUpperCase()}] ${message.title}: ${message.message}`;
  }

  // Get severity color for Slack
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO:
        return 'good';
      case AlertSeverity.WARNING:
        return 'warning';
      case AlertSeverity.CRITICAL:
        return 'danger';
      case AlertSeverity.EMERGENCY:
        return 'danger';
      default:
        return 'warning';
    }
  }

  // Get severity color hex
  private getSeverityColorHex(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO:
        return '#36a64f';
      case AlertSeverity.WARNING:
        return '#ff9500';
      case AlertSeverity.CRITICAL:
        return '#ff0000';
      case AlertSeverity.EMERGENCY:
        return '#8b0000';
      default:
        return '#ff9500';
    }
  }

  // Delay utility
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test notification channel
  async testChannel(channelId: string): Promise<boolean> {
    const testMessage: NotificationMessage = {
      title: 'Test Notification',
      message: 'This is a test notification from ConstructTrack monitoring system.',
      severity: AlertSeverity.INFO,
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    };

    return await this.sendNotification(channelId, testMessage);
  }

  // Get all channels
  getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  // Get channel by ID
  getChannel(channelId: string): NotificationChannel | undefined {
    return this.channels.get(channelId);
  }

  // Update channel
  updateChannel(channelId: string, updates: Partial<NotificationChannel>): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return false;
    }

    Object.assign(channel, updates);
    return true;
  }
}

// Global notification service instance
export const notificationService = new NotificationService();
