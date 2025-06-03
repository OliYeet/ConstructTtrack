/**
 * Alert Rules Configuration
 * Predefined alert rules and rule management
 */

import { AlertRule, AlertSeverity, AlertCondition, EscalationRule } from './alert-manager';

// Default alert rules for ConstructTrack
export const defaultAlertRules: AlertRule[] = [
  // Performance-related alerts
  {
    id: 'high-response-time',
    name: 'High API Response Time',
    description: 'API response time is consistently high',
    enabled: true,
    condition: {
      metric: 'api_response_time_avg',
      operator: 'gt',
      threshold: 2000, // 2 seconds
      duration: 5 * 60 * 1000, // 5 minutes
      evaluationInterval: 60 * 1000, // 1 minute
    },
    severity: AlertSeverity.WARNING,
    category: 'performance',
    tags: ['api', 'performance', 'response-time'],
    cooldownPeriod: 10 * 60 * 1000, // 10 minutes
    escalationRules: [
      {
        level: 1,
        delay: 15 * 60 * 1000, // 15 minutes
        channels: ['email-ops'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-alerts'],
  },

  {
    id: 'critical-response-time',
    name: 'Critical API Response Time',
    description: 'API response time is critically high',
    enabled: true,
    condition: {
      metric: 'api_response_time_avg',
      operator: 'gt',
      threshold: 5000, // 5 seconds
      duration: 2 * 60 * 1000, // 2 minutes
      evaluationInterval: 30 * 1000, // 30 seconds
    },
    severity: AlertSeverity.CRITICAL,
    category: 'performance',
    tags: ['api', 'performance', 'response-time', 'critical'],
    cooldownPeriod: 5 * 60 * 1000, // 5 minutes
    escalationRules: [
      {
        level: 1,
        delay: 5 * 60 * 1000, // 5 minutes
        channels: ['email-ops', 'sms-oncall'],
        condition: 'unacknowledged',
      },
      {
        level: 2,
        delay: 15 * 60 * 1000, // 15 minutes
        channels: ['email-management'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-alerts', 'email-ops'],
  },

  // Memory-related alerts
  {
    id: 'high-memory-usage',
    name: 'High Memory Usage',
    description: 'System memory usage is high',
    enabled: true,
    condition: {
      metric: 'memory_usage_percent',
      operator: 'gt',
      threshold: 80, // 80%
      duration: 5 * 60 * 1000, // 5 minutes
      evaluationInterval: 60 * 1000, // 1 minute
    },
    severity: AlertSeverity.WARNING,
    category: 'resources',
    tags: ['memory', 'resources', 'system'],
    cooldownPeriod: 15 * 60 * 1000, // 15 minutes
    escalationRules: [
      {
        level: 1,
        delay: 30 * 60 * 1000, // 30 minutes
        channels: ['email-ops'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-alerts'],
  },

  {
    id: 'critical-memory-usage',
    name: 'Critical Memory Usage',
    description: 'System memory usage is critically high',
    enabled: true,
    condition: {
      metric: 'memory_usage_percent',
      operator: 'gt',
      threshold: 95, // 95%
      duration: 2 * 60 * 1000, // 2 minutes
      evaluationInterval: 30 * 1000, // 30 seconds
    },
    severity: AlertSeverity.CRITICAL,
    category: 'resources',
    tags: ['memory', 'resources', 'system', 'critical'],
    cooldownPeriod: 5 * 60 * 1000, // 5 minutes
    escalationRules: [
      {
        level: 1,
        delay: 5 * 60 * 1000, // 5 minutes
        channels: ['email-ops', 'sms-oncall'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-alerts', 'email-ops'],
  },

  // Error rate alerts
  {
    id: 'high-error-rate',
    name: 'High API Error Rate',
    description: 'API error rate is elevated',
    enabled: true,
    condition: {
      metric: 'api_error_rate_percent',
      operator: 'gt',
      threshold: 5, // 5%
      duration: 5 * 60 * 1000, // 5 minutes
      evaluationInterval: 60 * 1000, // 1 minute
    },
    severity: AlertSeverity.WARNING,
    category: 'errors',
    tags: ['api', 'errors', 'reliability'],
    cooldownPeriod: 10 * 60 * 1000, // 10 minutes
    escalationRules: [
      {
        level: 1,
        delay: 20 * 60 * 1000, // 20 minutes
        channels: ['email-ops'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-alerts'],
  },

  {
    id: 'critical-error-rate',
    name: 'Critical API Error Rate',
    description: 'API error rate is critically high',
    enabled: true,
    condition: {
      metric: 'api_error_rate_percent',
      operator: 'gt',
      threshold: 15, // 15%
      duration: 2 * 60 * 1000, // 2 minutes
      evaluationInterval: 30 * 1000, // 30 seconds
    },
    severity: AlertSeverity.CRITICAL,
    category: 'errors',
    tags: ['api', 'errors', 'reliability', 'critical'],
    cooldownPeriod: 5 * 60 * 1000, // 5 minutes
    escalationRules: [
      {
        level: 1,
        delay: 5 * 60 * 1000, // 5 minutes
        channels: ['email-ops', 'sms-oncall'],
        condition: 'unacknowledged',
      },
      {
        level: 2,
        delay: 15 * 60 * 1000, // 15 minutes
        channels: ['email-management'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-alerts', 'email-ops'],
  },

  // Database-related alerts
  {
    id: 'database-connection-errors',
    name: 'Database Connection Errors',
    description: 'Multiple database connection errors detected',
    enabled: true,
    condition: {
      metric: 'database_connection_errors',
      operator: 'gt',
      threshold: 5, // 5 errors
      duration: 5 * 60 * 1000, // 5 minutes
      evaluationInterval: 60 * 1000, // 1 minute
    },
    severity: AlertSeverity.CRITICAL,
    category: 'database',
    tags: ['database', 'connectivity', 'critical'],
    cooldownPeriod: 10 * 60 * 1000, // 10 minutes
    escalationRules: [
      {
        level: 1,
        delay: 10 * 60 * 1000, // 10 minutes
        channels: ['email-ops', 'sms-oncall'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-alerts', 'email-ops'],
  },

  // Security-related alerts
  {
    id: 'authentication-failures',
    name: 'High Authentication Failure Rate',
    description: 'Unusual number of authentication failures detected',
    enabled: true,
    condition: {
      metric: 'auth_failure_rate',
      operator: 'gt',
      threshold: 10, // 10 failures per minute
      duration: 5 * 60 * 1000, // 5 minutes
      evaluationInterval: 60 * 1000, // 1 minute
    },
    severity: AlertSeverity.WARNING,
    category: 'security',
    tags: ['security', 'authentication', 'suspicious'],
    cooldownPeriod: 15 * 60 * 1000, // 15 minutes
    escalationRules: [
      {
        level: 1,
        delay: 30 * 60 * 1000, // 30 minutes
        channels: ['email-security'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-security'],
  },

  // Business logic alerts
  {
    id: 'fiber-installation-failures',
    name: 'High Fiber Installation Failure Rate',
    description: 'Unusual number of fiber installation failures',
    enabled: true,
    condition: {
      metric: 'fiber_installation_failure_rate',
      operator: 'gt',
      threshold: 20, // 20%
      duration: 30 * 60 * 1000, // 30 minutes
      evaluationInterval: 5 * 60 * 1000, // 5 minutes
    },
    severity: AlertSeverity.WARNING,
    category: 'business',
    tags: ['fiber', 'installation', 'operations'],
    cooldownPeriod: 60 * 60 * 1000, // 1 hour
    escalationRules: [
      {
        level: 1,
        delay: 2 * 60 * 60 * 1000, // 2 hours
        channels: ['email-operations'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-operations'],
  },

  // System health alerts
  {
    id: 'service-unavailable',
    name: 'Service Unavailable',
    description: 'Core service is not responding',
    enabled: true,
    condition: {
      metric: 'service_health_check',
      operator: 'eq',
      threshold: 'down',
      duration: 2 * 60 * 1000, // 2 minutes
      evaluationInterval: 30 * 1000, // 30 seconds
    },
    severity: AlertSeverity.EMERGENCY,
    category: 'availability',
    tags: ['service', 'availability', 'emergency'],
    cooldownPeriod: 2 * 60 * 1000, // 2 minutes
    escalationRules: [
      {
        level: 1,
        delay: 2 * 60 * 1000, // 2 minutes
        channels: ['email-ops', 'sms-oncall'],
        condition: 'unacknowledged',
      },
      {
        level: 2,
        delay: 5 * 60 * 1000, // 5 minutes
        channels: ['email-management', 'sms-management'],
        condition: 'unacknowledged',
      },
    ],
    notificationChannels: ['slack-alerts', 'email-ops', 'sms-oncall'],
  },
];

// Rule templates for easy creation
export const alertRuleTemplates = {
  // Performance template
  performance: (metric: string, threshold: number, severity: AlertSeverity): Partial<AlertRule> => ({
    condition: {
      metric,
      operator: 'gt',
      threshold,
      duration: 5 * 60 * 1000,
      evaluationInterval: 60 * 1000,
    },
    severity,
    category: 'performance',
    tags: ['performance', metric.split('_')[0]],
    cooldownPeriod: 10 * 60 * 1000,
    notificationChannels: ['slack-alerts'],
  }),

  // Resource template
  resource: (metric: string, threshold: number, severity: AlertSeverity): Partial<AlertRule> => ({
    condition: {
      metric,
      operator: 'gt',
      threshold,
      duration: 5 * 60 * 1000,
      evaluationInterval: 60 * 1000,
    },
    severity,
    category: 'resources',
    tags: ['resources', metric.split('_')[0]],
    cooldownPeriod: 15 * 60 * 1000,
    notificationChannels: ['slack-alerts'],
  }),

  // Error template
  error: (metric: string, threshold: number, severity: AlertSeverity): Partial<AlertRule> => ({
    condition: {
      metric,
      operator: 'gt',
      threshold,
      duration: 5 * 60 * 1000,
      evaluationInterval: 60 * 1000,
    },
    severity,
    category: 'errors',
    tags: ['errors', 'reliability'],
    cooldownPeriod: 10 * 60 * 1000,
    notificationChannels: ['slack-alerts'],
  }),
};

// Helper function to create custom alert rule
export function createAlertRule(
  id: string,
  name: string,
  description: string,
  condition: AlertCondition,
  severity: AlertSeverity,
  category: string,
  options: {
    tags?: string[];
    cooldownPeriod?: number;
    escalationRules?: EscalationRule[];
    notificationChannels?: string[];
    enabled?: boolean;
  } = {}
): AlertRule {
  return {
    id,
    name,
    description,
    enabled: options.enabled ?? true,
    condition,
    severity,
    category,
    tags: options.tags || [],
    cooldownPeriod: options.cooldownPeriod || 10 * 60 * 1000,
    escalationRules: options.escalationRules || [],
    notificationChannels: options.notificationChannels || ['slack-alerts'],
  };
}

// Validate alert rule
export function validateAlertRule(rule: AlertRule): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule.id || rule.id.trim() === '') {
    errors.push('Rule ID is required');
  }

  if (!rule.name || rule.name.trim() === '') {
    errors.push('Rule name is required');
  }

  if (!rule.condition.metric || rule.condition.metric.trim() === '') {
    errors.push('Condition metric is required');
  }

  if (typeof rule.condition.threshold === 'undefined') {
    errors.push('Condition threshold is required');
  }

  if (rule.condition.duration <= 0) {
    errors.push('Condition duration must be positive');
  }

  if (rule.condition.evaluationInterval <= 0) {
    errors.push('Evaluation interval must be positive');
  }

  if (rule.cooldownPeriod < 0) {
    errors.push('Cooldown period cannot be negative');
  }

  if (!Object.values(AlertSeverity).includes(rule.severity)) {
    errors.push('Invalid alert severity');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
