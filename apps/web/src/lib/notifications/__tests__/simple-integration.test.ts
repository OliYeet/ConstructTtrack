/**
 * Simple Integration Test for Real-time Notification System
 *
 * Tests the core functionality with a simplified approach
 */

import {
  RealtimeNotificationManager,
  type NotificationRule,
  type NotificationRecipient,
} from '../realtime-notification-manager';
import type { RealtimeEvent } from '../../../../../../src/types/realtime-protocol';

// Mock dependencies
jest.mock('@/lib/logging', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/monitoring/realtime-index', () => ({
  RealtimeMonitoring: {
    trackEvent: jest.fn(() => 'test-event-id'),
    eventReceived: jest.fn(),
  },
}));

jest.mock('@/lib/alerts/notification-service', () => ({
  notificationService: {
    sendNotification: jest.fn(),
  },
}));

describe('Real-time Notification Manager', () => {
  let manager: RealtimeNotificationManager;
  let mockWebSocketGateway: {
    sendToUser: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    manager = new RealtimeNotificationManager({
      enableWebSocket: true,
      enableBatching: false,
      batchWindow: 1000,
      maxBatchSize: 5,
      enableEscalation: false,
      escalationDelay: 60000,
    });

    mockWebSocketGateway = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    manager.setWebSocketGateway(mockWebSocketGateway);
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should process fiber section started event and send WebSocket notification', async () => {
    // Setup notification rule
    const rule: NotificationRule = {
      id: 'test-fiber-started',
      name: 'Fiber Section Started Test',
      eventTypes: ['FiberSectionStarted'],
      roles: ['technician'],
      channels: ['websocket'],
      template: {
        title: 'Section Started - {payload.sectionId}',
        message: 'You have been assigned to section {payload.sectionId}',
        variables: ['payload.sectionId'],
      },
      priority: 'high',
      enabled: true,
    };

    manager.addRule(rule);

    // Create test event
    const event: RealtimeEvent = {
      id: 'test-event-1',
      type: 'FiberSectionStarted',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: 'WO-TEST-001',
      userId: 'foreman-1',
      payload: {
        sectionId: 'SEC-TEST-001',
        startLocation: {
          latitude: 40.7128,
          longitude: -74.006,
        },
        estimatedLength: 1000,
        assignedTechnician: 'tech-1',
        plannedCompletionTime: new Date(Date.now() + 3600000).toISOString(),
      },
    };

    // Create recipients
    const recipients: NotificationRecipient[] = [
      {
        userId: 'tech-1',
        role: 'technician',
        channels: ['websocket'],
        isOnline: true,
      },
    ];

    // Process event
    await manager.processEvent(event, recipients);

    // Verify WebSocket notification was sent
    expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
      'tech-1',
      expect.objectContaining({
        id: expect.any(String),
        type: 'notification',
        event,
        notification: expect.objectContaining({
          title: 'Section Started - SEC-TEST-001',
          message: 'You have been assigned to section SEC-TEST-001',
          priority: 'high',
        }),
      })
    );
  });

  it('should handle critical notifications immediately', async () => {
    const rule: NotificationRule = {
      id: 'test-critical',
      name: 'Critical Failure Test',
      eventTypes: ['FiberSectionFailed'],
      roles: ['supervisor'],
      channels: ['websocket'],
      template: {
        title: 'CRITICAL: Section Failed - {payload.sectionId}',
        message:
          'Section {payload.sectionId} has failed: {payload.failureReason}',
        variables: ['payload.sectionId', 'payload.failureReason'],
      },
      priority: 'critical',
      enabled: true,
    };

    manager.addRule(rule);

    const event: RealtimeEvent = {
      id: 'test-critical-event',
      type: 'FiberSectionFailed',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: 'WO-CRITICAL',
      userId: 'tech-1',
      payload: {
        sectionId: 'SEC-CRITICAL',
        failureReason: 'Cable damage detected',
        failureLocation: {
          latitude: 40.7589,
          longitude: -73.9851,
        },
        errorCode: 'CABLE_DAMAGE',
        recoveryActions: ['Replace damaged section', 'Re-route cable'],
      },
    };

    const recipients: NotificationRecipient[] = [
      {
        userId: 'supervisor-1',
        role: 'supervisor',
        channels: ['websocket'],
        isOnline: true,
      },
    ];

    await manager.processEvent(event, recipients);

    expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
      'supervisor-1',
      expect.objectContaining({
        notification: expect.objectContaining({
          title: 'CRITICAL: Section Failed - SEC-CRITICAL',
          message: 'Section SEC-CRITICAL has failed: Cable damage detected',
          priority: 'critical',
        }),
      })
    );
  });

  it('should filter recipients by role', async () => {
    const rule: NotificationRule = {
      id: 'test-role-filter',
      name: 'Role Filter Test',
      eventTypes: ['SpliceCompleted'],
      roles: ['foreman'], // Only foreman should receive this
      channels: ['websocket'],
      template: {
        title: 'Splice Complete - {payload.sectionId}',
        message: 'Splice completed for section {payload.sectionId}',
        variables: ['payload.sectionId'],
      },
      priority: 'normal',
      enabled: true,
    };

    manager.addRule(rule);

    const event: RealtimeEvent = {
      id: 'test-splice-event',
      type: 'SpliceCompleted',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: 'WO-SPLICE',
      userId: 'tech-1',
      payload: {
        sectionId: 'SEC-SPLICE',
        spliceId: 'SPLICE-001',
        spliceLocation: {
          latitude: 40.7505,
          longitude: -73.9934,
        },
        spliceType: 'fusion',
        fiberCount: 12,
        testResults: {
          loss: 0.12,
          reflectance: -45,
          passed: true,
        },
      },
    };

    const recipients: NotificationRecipient[] = [
      {
        userId: 'foreman-1',
        role: 'foreman', // Should receive notification
        channels: ['websocket'],
        isOnline: true,
      },
      {
        userId: 'tech-1',
        role: 'technician', // Should NOT receive notification
        channels: ['websocket'],
        isOnline: true,
      },
    ];

    await manager.processEvent(event, recipients);

    // Only foreman should receive the notification
    expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledTimes(1);
    expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
      'foreman-1',
      expect.any(Object)
    );
  });

  it('should handle offline users by skipping WebSocket delivery', async () => {
    const rule: NotificationRule = {
      id: 'test-offline',
      name: 'Offline User Test',
      eventTypes: ['InspectionPassed'],
      roles: ['customer'],
      channels: ['email'], // Traditional channel
      template: {
        title: 'Inspection Passed',
        message: 'Your installation has passed inspection',
        variables: [],
      },
      priority: 'normal',
      enabled: true,
    };

    manager.addRule(rule);

    const event: RealtimeEvent = {
      id: 'test-offline-event',
      type: 'InspectionPassed',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: 'WO-OFFLINE',
      userId: 'inspector-1',
      payload: {
        sectionId: 'SEC-OFFLINE',
        inspectionType: 'optical',
        inspector: 'inspector-1',
        results: {
          passed: true,
          notes: 'Inspection passed with excellent quality',
          photos: [],
        },
      },
    };

    const recipients: NotificationRecipient[] = [
      {
        userId: 'customer-1',
        role: 'customer',
        channels: ['email'],
        isOnline: false, // Customer is offline
      },
    ];

    await manager.processEvent(event, recipients);

    // WebSocket should not be called for offline users
    expect(mockWebSocketGateway.sendToUser).not.toHaveBeenCalled();

    // Traditional notification service should be called
    const notificationServiceModule = await import(
      '@/lib/alerts/notification-service'
    );
    expect(
      notificationServiceModule.notificationService.sendNotification
    ).toHaveBeenCalled();
  });

  it('should handle template variable substitution', async () => {
    const rule: NotificationRule = {
      id: 'test-variables',
      name: 'Variable Substitution Test',
      eventTypes: ['FiberSectionProgress'],
      roles: ['supervisor'],
      channels: ['websocket'],
      template: {
        title: 'Progress Update - {payload.sectionId}',
        message:
          'Section {payload.sectionId} is {payload.progressPercentage}% complete',
        variables: ['payload.sectionId', 'payload.progressPercentage'],
      },
      priority: 'normal',
      enabled: true,
    };

    manager.addRule(rule);

    const event: RealtimeEvent = {
      id: 'test-progress-event',
      type: 'FiberSectionProgress',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: 'WO-PROGRESS',
      userId: 'tech-1',
      payload: {
        sectionId: 'SEC-PROGRESS',
        overallProgress: 75,
        currentPhase: 'testing',
        location: {
          latitude: 40.7128,
          longitude: -74.006,
        },
        estimatedTimeRemaining: 30,
      },
    };

    const recipients: NotificationRecipient[] = [
      {
        userId: 'supervisor-1',
        role: 'supervisor',
        channels: ['websocket'],
        isOnline: true,
      },
    ];

    await manager.processEvent(event, recipients);

    expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
      'supervisor-1',
      expect.objectContaining({
        notification: expect.objectContaining({
          title: 'Progress Update - SEC-PROGRESS',
          message: 'Section SEC-PROGRESS is 75% complete',
        }),
      })
    );
  });

  it('should handle WebSocket delivery errors gracefully', async () => {
    // Make WebSocket gateway fail
    mockWebSocketGateway.sendToUser.mockRejectedValue(
      new Error('Connection lost')
    );

    const rule: NotificationRule = {
      id: 'test-error',
      name: 'Error Handling Test',
      eventTypes: ['WorkOrderUpdated'],
      roles: ['admin'],
      channels: ['websocket', 'email'],
      template: {
        title: 'Work Order Update',
        message: 'Work order has been updated',
        variables: [],
      },
      priority: 'normal',
      enabled: true,
    };

    manager.addRule(rule);

    const event: RealtimeEvent = {
      id: 'test-error-event',
      type: 'WorkOrderUpdated',
      version: 'v1.alpha',
      timestamp: new Date().toISOString(),
      workOrderId: 'WO-ERROR',
      userId: 'admin-1',
      payload: {
        status: 'in_progress',
        priority: 'medium',
        notes: 'Test error handling scenario',
      },
    };

    const recipients: NotificationRecipient[] = [
      {
        userId: 'admin-1',
        role: 'admin',
        channels: ['websocket', 'email'],
        isOnline: true,
      },
    ];

    // Should not throw despite WebSocket failure
    await expect(
      manager.processEvent(event, recipients)
    ).resolves.not.toThrow();

    // Should still attempt WebSocket delivery
    expect(mockWebSocketGateway.sendToUser).toHaveBeenCalled();

    // Should fallback to traditional channels
    const notificationServiceModule = await import(
      '@/lib/alerts/notification-service'
    );
    expect(
      notificationServiceModule.notificationService.sendNotification
    ).toHaveBeenCalled();
  });
});
