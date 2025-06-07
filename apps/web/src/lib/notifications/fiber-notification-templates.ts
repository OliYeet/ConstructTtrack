/**
 * Fiber Installation Notification Templates
 *
 * Pre-defined notification templates for fiber installation workflow events.
 * Templates support variable substitution and role-based customization.
 */

import type { EventType } from '../../../../../src/types/realtime-protocol';

import type {
  NotificationRule,
  NotificationTemplate,
  UserRole,
  NotificationPriority,
} from './realtime-notification-manager';

// Template variable helpers
const COMMON_VARIABLES = [
  'workOrderId',
  'userId',
  'timestamp',
  'metadata.customerName',
  'metadata.address',
];

const SECTION_VARIABLES = [
  ...COMMON_VARIABLES,
  'payload.sectionId',
  'payload.assignedTechnician',
  'payload.startLocation.address',
];

// Simplified notification templates for key events
export const FIBER_NOTIFICATION_TEMPLATES: Record<
  EventType,
  Record<UserRole, NotificationTemplate>
> = {
  FiberSectionStarted: {
    foreman: {
      title: 'Fiber Section Started - {payload.sectionId}',
      message:
        'Technician {payload.assignedTechnician} has started work on fiber section {payload.sectionId} at {payload.startLocation.address}.',
      variables: [...SECTION_VARIABLES, 'payload.plannedCompletionTime'],
    },
    technician: {
      title: 'Section Assignment - {payload.sectionId}',
      message:
        'You have been assigned to fiber section {payload.sectionId} at {payload.startLocation.address}. Please confirm start of work.',
      variables: SECTION_VARIABLES,
    },
    supervisor: {
      title: 'Work Order Progress - {workOrderId}',
      message:
        'Fiber section {payload.sectionId} has been started by {payload.assignedTechnician} for work order {workOrderId}.',
      variables: SECTION_VARIABLES,
    },
    admin: {
      title: 'System Update - Fiber Section Started',
      message:
        'Section {payload.sectionId} started in work order {workOrderId} by technician {payload.assignedTechnician}.',
      variables: SECTION_VARIABLES,
    },
    customer: {
      title: 'Installation Update - Work Started',
      message:
        "Good news! Our technician has started the fiber installation at {payload.startLocation.address}. We'll keep you updated on progress.",
      variables: SECTION_VARIABLES,
    },
  },

  CablePulled: {
    foreman: {
      title: 'Cable Pulled - Section {payload.sectionId}',
      message:
        'Cable pulling completed for section {payload.sectionId}. Length: {payload.cableLength}m, Type: {payload.cableType}.',
      variables: [
        ...SECTION_VARIABLES,
        'payload.cableLength',
        'payload.cableType',
      ],
    },
    technician: {
      title: 'Cable Pull Complete - {payload.sectionId}',
      message:
        'Cable pulling completed successfully. Please proceed with splice preparation for section {payload.sectionId}.',
      variables: SECTION_VARIABLES,
    },
    supervisor: {
      title: 'Progress Update - Cable Pulled',
      message:
        'Cable pulling completed for section {payload.sectionId} in work order {workOrderId}.',
      variables: [...SECTION_VARIABLES, 'payload.cableLength'],
    },
    admin: {
      title: 'System Update - Cable Pulled',
      message:
        'Cable pull event recorded for section {payload.sectionId}, length {payload.cableLength}m.',
      variables: [...SECTION_VARIABLES, 'payload.cableLength'],
    },
    customer: {
      title: 'Installation Progress Update',
      message:
        'Cable installation is progressing well at {payload.startLocation.address}. Our technician has completed the cable pulling phase.',
      variables: SECTION_VARIABLES,
    },
  },

  SpliceCompleted: {
    foreman: {
      title: 'Splice Complete - {payload.sectionId}',
      message:
        'Splice completed for section {payload.sectionId}. Loss: {payload.spliceLoss}dB, Quality: {payload.spliceQuality}.',
      variables: [
        ...SECTION_VARIABLES,
        'payload.spliceLoss',
        'payload.spliceQuality',
      ],
    },
    technician: {
      title: 'Splice Success - {payload.sectionId}',
      message:
        'Splice completed with {payload.spliceLoss}dB loss. Please proceed with optical testing for section {payload.sectionId}.',
      variables: [...SECTION_VARIABLES, 'payload.spliceLoss'],
    },
    supervisor: {
      title: 'Quality Update - Splice Complete',
      message:
        'High-quality splice completed for section {payload.sectionId}. Loss: {payload.spliceLoss}dB.',
      variables: [...SECTION_VARIABLES, 'payload.spliceLoss'],
    },
    admin: {
      title: 'System Update - Splice Complete',
      message:
        'Splice event recorded for section {payload.sectionId}, loss {payload.spliceLoss}dB.',
      variables: [...SECTION_VARIABLES, 'payload.spliceLoss'],
    },
    customer: {
      title: 'Installation Progress - Connection Complete',
      message:
        'Great progress! The fiber connections have been completed at {payload.startLocation.address}.',
      variables: SECTION_VARIABLES,
    },
  },

  InspectionPassed: {
    foreman: {
      title: 'Inspection Passed - {payload.sectionId}',
      message:
        'Section {payload.sectionId} passed {payload.inspectionType} inspection by {payload.inspector}.',
      variables: [
        ...SECTION_VARIABLES,
        'payload.inspectionType',
        'payload.inspector',
      ],
    },
    technician: {
      title: 'Inspection Success - {payload.sectionId}',
      message:
        'Congratulations! Section {payload.sectionId} passed inspection. You may proceed to section closure.',
      variables: SECTION_VARIABLES,
    },
    supervisor: {
      title: 'Quality Assurance - Inspection Passed',
      message:
        'Section {payload.sectionId} successfully passed {payload.inspectionType} inspection.',
      variables: [...SECTION_VARIABLES, 'payload.inspectionType'],
    },
    admin: {
      title: 'System Update - Inspection Passed',
      message:
        'Inspection passed for section {payload.sectionId}, type {payload.inspectionType}.',
      variables: [...SECTION_VARIABLES, 'payload.inspectionType'],
    },
    customer: {
      title: 'Quality Assurance Complete',
      message:
        'Excellent news! Your fiber installation at {payload.startLocation.address} has passed all quality inspections.',
      variables: SECTION_VARIABLES,
    },
  },

  SectionClosed: {
    foreman: {
      title: 'Section Complete - {payload.sectionId}',
      message: 'Section {payload.sectionId} has been completed and closed.',
      variables: SECTION_VARIABLES,
    },
    technician: {
      title: 'Section Complete - {payload.sectionId}',
      message:
        'Well done! Section {payload.sectionId} has been successfully completed and closed.',
      variables: SECTION_VARIABLES,
    },
    supervisor: {
      title: 'Work Order Progress - Section Complete',
      message:
        'Section {payload.sectionId} completed successfully. Work order {workOrderId} progress updated.',
      variables: SECTION_VARIABLES,
    },
    admin: {
      title: 'System Update - Section Closed',
      message: 'Section {payload.sectionId} closed successfully.',
      variables: SECTION_VARIABLES,
    },
    customer: {
      title: 'Installation Complete - Section Finished',
      message:
        'Great news! The fiber installation section at {payload.startLocation.address} has been completed successfully.',
      variables: SECTION_VARIABLES,
    },
  },

  WorkOrderUpdated: {
    foreman: {
      title: 'Work Order Update - {workOrderId}',
      message:
        'Work order {workOrderId} has been updated. Status: {payload.status}.',
      variables: [...COMMON_VARIABLES, 'payload.status'],
    },
    technician: {
      title: 'Assignment Update - {workOrderId}',
      message:
        'Your work order {workOrderId} has been updated. Please check for any new instructions.',
      variables: COMMON_VARIABLES,
    },
    supervisor: {
      title: 'Work Order Status - {workOrderId}',
      message: 'Work order {workOrderId} updated to {payload.status}.',
      variables: [...COMMON_VARIABLES, 'payload.status'],
    },
    admin: {
      title: 'System Update - Work Order Modified',
      message:
        'Work order {workOrderId} updated by {userId}. New status: {payload.status}.',
      variables: [...COMMON_VARIABLES, 'payload.status'],
    },
    customer: {
      title: 'Installation Update',
      message:
        "Your fiber installation order has been updated. We'll notify you of any significant changes.",
      variables: COMMON_VARIABLES,
    },
  },

  FiberSectionProgress: {
    foreman: {
      title: 'Progress Update - {payload.sectionId}',
      message:
        'Section {payload.sectionId} is {payload.progressPercentage}% complete.',
      variables: [...SECTION_VARIABLES, 'payload.progressPercentage'],
    },
    technician: {
      title: 'Progress Milestone - {payload.sectionId}',
      message:
        'Section {payload.sectionId} progress: {payload.progressPercentage}% complete. Keep up the great work!',
      variables: [...SECTION_VARIABLES, 'payload.progressPercentage'],
    },
    supervisor: {
      title: 'Progress Tracking - {payload.sectionId}',
      message:
        'Section {payload.sectionId} progress update: {payload.progressPercentage}% complete.',
      variables: [...SECTION_VARIABLES, 'payload.progressPercentage'],
    },
    admin: {
      title: 'System Update - Progress Recorded',
      message:
        'Progress update for section {payload.sectionId}: {payload.progressPercentage}% complete.',
      variables: [...SECTION_VARIABLES, 'payload.progressPercentage'],
    },
    customer: {
      title: 'Installation Progress Update',
      message:
        'Your fiber installation is {payload.progressPercentage}% complete.',
      variables: [...SECTION_VARIABLES, 'payload.progressPercentage'],
    },
  },

  // Error event templates
  FiberSectionFailed: {
    foreman: {
      title: 'URGENT: Section Failed - {payload.sectionId}',
      message:
        'Section {payload.sectionId} has failed. Reason: {payload.failureReason}. Immediate attention required.',
      variables: [...SECTION_VARIABLES, 'payload.failureReason'],
    },
    technician: {
      title: 'Section Issue - {payload.sectionId}',
      message:
        'Section {payload.sectionId} requires attention. Issue: {payload.failureReason}. Please contact supervisor.',
      variables: [...SECTION_VARIABLES, 'payload.failureReason'],
    },
    supervisor: {
      title: 'CRITICAL: Section Failure - {payload.sectionId}',
      message:
        'URGENT: Section {payload.sectionId} has failed. Reason: {payload.failureReason}. Technician support needed.',
      variables: [...SECTION_VARIABLES, 'payload.failureReason'],
    },
    admin: {
      title: 'System Alert - Section Failure',
      message:
        'Section failure recorded for {payload.sectionId}. Reason: {payload.failureReason}.',
      variables: [...SECTION_VARIABLES, 'payload.failureReason'],
    },
    customer: {
      title: 'Installation Update - Temporary Delay',
      message:
        "We've encountered a technical issue with your installation. Our team is working to resolve it quickly.",
      variables: SECTION_VARIABLES,
    },
  },

  SpliceFailed: {
    foreman: {
      title: 'Splice Failure - {payload.sectionId}',
      message:
        'Splice failed for section {payload.sectionId}. Loss: {payload.actualLoss}dB. Retry required.',
      variables: [...SECTION_VARIABLES, 'payload.actualLoss'],
    },
    technician: {
      title: 'Splice Retry Required - {payload.sectionId}',
      message:
        'Splice for section {payload.sectionId} needs retry. Current loss {payload.actualLoss}dB exceeds target.',
      variables: [...SECTION_VARIABLES, 'payload.actualLoss'],
    },
    supervisor: {
      title: 'Quality Issue - Splice Failed',
      message:
        'Splice failure in section {payload.sectionId}. Loss {payload.actualLoss}dB exceeds specification.',
      variables: [...SECTION_VARIABLES, 'payload.actualLoss'],
    },
    admin: {
      title: 'System Alert - Splice Failure',
      message:
        'Splice failure recorded for section {payload.sectionId}. Loss: {payload.actualLoss}dB.',
      variables: [...SECTION_VARIABLES, 'payload.actualLoss'],
    },
    customer: {
      title: 'Installation Update - Quality Check',
      message:
        'Our technician is performing additional quality checks to ensure the best connection.',
      variables: SECTION_VARIABLES,
    },
  },

  InspectionFailed: {
    foreman: {
      title: 'URGENT: Inspection Failed - {payload.sectionId}',
      message:
        'Section {payload.sectionId} failed {payload.inspectionType} inspection. Immediate action required.',
      variables: [...SECTION_VARIABLES, 'payload.inspectionType'],
    },
    technician: {
      title: 'Inspection Issues - {payload.sectionId}',
      message:
        'Section {payload.sectionId} requires rework. Failed {payload.inspectionType} inspection.',
      variables: [...SECTION_VARIABLES, 'payload.inspectionType'],
    },
    supervisor: {
      title: 'CRITICAL: Inspection Failure - {payload.sectionId}',
      message:
        'URGENT: Section {payload.sectionId} failed inspection. Type: {payload.inspectionType}.',
      variables: [...SECTION_VARIABLES, 'payload.inspectionType'],
    },
    admin: {
      title: 'System Alert - Inspection Failed',
      message:
        'Inspection failure for section {payload.sectionId}. Type: {payload.inspectionType}.',
      variables: [...SECTION_VARIABLES, 'payload.inspectionType'],
    },
    customer: {
      title: 'Installation Update - Quality Assurance',
      message:
        'Our quality assurance process has identified areas for improvement. Our team is addressing these.',
      variables: SECTION_VARIABLES,
    },
  },

  // Notification system events (simplified)
  NotificationSent: {
    admin: {
      title: 'Notification Sent',
      message:
        'Notification sent to {payload.recipientId} via {payload.channel}.',
      variables: ['payload.recipientId', 'payload.channel'],
    },
    foreman: { title: '', message: '', variables: [] },
    technician: { title: '', message: '', variables: [] },
    supervisor: { title: '', message: '', variables: [] },
    customer: { title: '', message: '', variables: [] },
  },

  NotificationDelivered: {
    admin: {
      title: 'Notification Delivered',
      message:
        'Notification delivered to {payload.recipientId} via {payload.channel}.',
      variables: ['payload.recipientId', 'payload.channel'],
    },
    foreman: { title: '', message: '', variables: [] },
    technician: { title: '', message: '', variables: [] },
    supervisor: { title: '', message: '', variables: [] },
    customer: { title: '', message: '', variables: [] },
  },

  NotificationFailed: {
    admin: {
      title: 'ALERT: Notification Failed',
      message:
        'Failed to deliver notification to {payload.recipientId} via {payload.channel}.',
      variables: ['payload.recipientId', 'payload.channel'],
    },
    foreman: { title: '', message: '', variables: [] },
    technician: { title: '', message: '', variables: [] },
    supervisor: { title: '', message: '', variables: [] },
    customer: { title: '', message: '', variables: [] },
  },

  NotificationAcknowledged: {
    admin: {
      title: 'Notification Acknowledged',
      message: 'Notification acknowledged by {payload.recipientId}.',
      variables: ['payload.recipientId'],
    },
    foreman: { title: '', message: '', variables: [] },
    technician: { title: '', message: '', variables: [] },
    supervisor: { title: '', message: '', variables: [] },
    customer: { title: '', message: '', variables: [] },
  },
};

// Priority mapping for each event type and role
export const FIBER_NOTIFICATION_PRIORITIES: Record<
  EventType,
  Record<UserRole, NotificationPriority>
> = {
  FiberSectionStarted: {
    foreman: 'normal',
    technician: 'high',
    supervisor: 'normal',
    admin: 'low',
    customer: 'normal',
  },
  CablePulled: {
    foreman: 'normal',
    technician: 'normal',
    supervisor: 'low',
    admin: 'low',
    customer: 'normal',
  },
  SpliceCompleted: {
    foreman: 'normal',
    technician: 'normal',
    supervisor: 'low',
    admin: 'low',
    customer: 'normal',
  },
  InspectionPassed: {
    foreman: 'normal',
    technician: 'normal',
    supervisor: 'normal',
    admin: 'low',
    customer: 'high',
  },
  SectionClosed: {
    foreman: 'normal',
    technician: 'normal',
    supervisor: 'normal',
    admin: 'low',
    customer: 'high',
  },
  WorkOrderUpdated: {
    foreman: 'normal',
    technician: 'normal',
    supervisor: 'normal',
    admin: 'low',
    customer: 'normal',
  },
  FiberSectionProgress: {
    foreman: 'low',
    technician: 'low',
    supervisor: 'low',
    admin: 'low',
    customer: 'normal',
  },
  // Error events are always high/critical priority
  FiberSectionFailed: {
    foreman: 'critical',
    technician: 'high',
    supervisor: 'critical',
    admin: 'high',
    customer: 'normal',
  },
  SpliceFailed: {
    foreman: 'high',
    technician: 'high',
    supervisor: 'high',
    admin: 'normal',
    customer: 'low',
  },
  InspectionFailed: {
    foreman: 'critical',
    technician: 'high',
    supervisor: 'critical',
    admin: 'high',
    customer: 'normal',
  },
  // Notification system events
  NotificationSent: {
    admin: 'low',
    foreman: 'low',
    technician: 'low',
    supervisor: 'low',
    customer: 'low',
  },
  NotificationDelivered: {
    admin: 'low',
    foreman: 'low',
    technician: 'low',
    supervisor: 'low',
    customer: 'low',
  },
  NotificationFailed: {
    admin: 'high',
    foreman: 'low',
    technician: 'low',
    supervisor: 'low',
    customer: 'low',
  },
  NotificationAcknowledged: {
    admin: 'low',
    foreman: 'low',
    technician: 'low',
    supervisor: 'low',
    customer: 'low',
  },
};

/**
 * Get notification template for specific event type and user role
 */
export function getNotificationTemplate(
  eventType: EventType,
  role: UserRole
): NotificationTemplate {
  return FIBER_NOTIFICATION_TEMPLATES[eventType][role];
}

/**
 * Get notification priority for specific event type and user role
 */
export function getNotificationPriority(
  eventType: EventType,
  role: UserRole
): NotificationPriority {
  return FIBER_NOTIFICATION_PRIORITIES[eventType][role];
}

/**
 * Create notification rule for event type and role combination
 */
export function createFiberNotificationRule(
  eventType: EventType,
  role: UserRole,
  channels: string[],
  ruleId?: string
): NotificationRule {
  const template = getNotificationTemplate(eventType, role);
  const priority = getNotificationPriority(eventType, role);

  return {
    id: ruleId || `${eventType}-${role}`,
    name: `${eventType} notifications for ${role}`,
    eventTypes: [eventType],
    roles: [role],
    channels,
    template,
    priority,
    enabled: true,
  };
}
