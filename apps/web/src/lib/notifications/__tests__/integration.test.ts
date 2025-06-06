/**
 * Integration Tests for Real-time Notification System
 *
 * Tests the complete notification flow from event processing to delivery
 */

import { NotificationAPI, notificationSystem } from '../index';
import type { RealtimeEvent, NotificationRecipient } from '../index';
import { createFiberNotificationRule } from '../fiber-notification-templates';

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
    getChannels: jest.fn(() => []),
  },
}));

describe('Real-time Notification System Integration', () => {
  let mockWebSocketGateway: {
    sendToUser: jest.Mock;
    sendToChannel: jest.Mock;
    isUserOnline: jest.Mock;
    getOnlineUsers: jest.Mock;
    getUserConnections: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create mock WebSocket gateway
    mockWebSocketGateway = {
      sendToUser: jest
        .fn()
        .mockResolvedValue([{ success: true, clientId: 'test-client' }]),
      sendToChannel: jest
        .fn()
        .mockResolvedValue([{ success: true, clientId: 'test-channel' }]),
      isUserOnline: jest.fn().mockReturnValue(true),
      getOnlineUsers: jest.fn().mockReturnValue(['tech-1', 'foreman-1']),
      getUserConnections: jest.fn().mockReturnValue([]),
    };

    // Initialize notification system
    await NotificationAPI.initialize({
      enableWebSocket: true,
      enableBatching: false, // Disable for simpler testing
      autoSetupFiberRules: false, // We'll set up rules manually
    });

    // Connect mock WebSocket gateway
    NotificationAPI.connectWebSocket(mockWebSocketGateway);
  });

  afterEach(() => {
    notificationSystem.shutdown();
  });

  describe('Fiber Installation Workflow', () => {
    it('should process FiberSectionStarted event and send notifications', async () => {
      // Setup notification rule
      const rule = createFiberNotificationRule(
        'FiberSectionStarted',
        'technician',
        ['websocket'],
        'test-fiber-started-tech'
      );
      notificationSystem.addRule(rule);

      // Create test event
      const event: RealtimeEvent = {
        id: 'test-fiber-started-1',
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
            address: '123 Test Street, New York, NY',
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
      await NotificationAPI.processFiberEvent(event, recipients);

      // Verify WebSocket notification was sent
      expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
        'tech-1',
        expect.objectContaining({
          id: expect.any(String),
          type: 'notification',
          event,
          notification: expect.objectContaining({
            title: expect.stringContaining('SEC-TEST-001'),
            message: expect.stringContaining('tech-1'),
            priority: 'high',
          }),
        })
      );
    });

    it('should handle critical notifications immediately', async () => {
      // Setup critical notification rule
      const rule = createFiberNotificationRule(
        'FiberSectionFailed',
        'supervisor',
        ['websocket', 'email'],
        'test-fiber-failed-supervisor'
      );
      notificationSystem.addRule(rule);

      // Create critical failure event
      const event: RealtimeEvent = {
        id: 'test-fiber-failed-1',
        type: 'FiberSectionFailed',
        version: 'v1.alpha',
        timestamp: new Date().toISOString(),
        workOrderId: 'WO-TEST-002',
        userId: 'tech-2',
        payload: {
          sectionId: 'SEC-TEST-002',
          failureReason: 'Cable damage detected during installation',
          failureLocation: {
            latitude: 40.7589,
            longitude: -73.9851,
            address: '456 Emergency Lane, New York, NY',
          },
          reportedBy: 'tech-2',
          severity: 'high',
        },
      };

      const recipients: NotificationRecipient[] = [
        {
          userId: 'supervisor-1',
          role: 'supervisor',
          channels: ['websocket', 'email'],
          isOnline: true,
        },
      ];

      // Process critical event
      await NotificationAPI.processFiberEvent(event, recipients);

      // Verify immediate WebSocket delivery for critical notification
      expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
        'supervisor-1',
        expect.objectContaining({
          notification: expect.objectContaining({
            title: expect.stringContaining('CRITICAL'),
            priority: 'critical',
          }),
        })
      );
    });

    it('should filter notifications by user role', async () => {
      // Setup rules for different roles
      const technicianRule = createFiberNotificationRule(
        'SpliceCompleted',
        'technician',
        ['websocket'],
        'test-splice-technician'
      );

      const foremanRule = createFiberNotificationRule(
        'SpliceCompleted',
        'foreman',
        ['websocket'],
        'test-splice-foreman'
      );

      notificationSystem.addRule(technicianRule);
      notificationSystem.addRule(foremanRule);

      // Create splice completed event
      const event: RealtimeEvent = {
        id: 'test-splice-completed-1',
        type: 'SpliceCompleted',
        version: 'v1.alpha',
        timestamp: new Date().toISOString(),
        workOrderId: 'WO-TEST-003',
        userId: 'tech-3',
        payload: {
          sectionId: 'SEC-TEST-003',
          spliceLocation: {
            latitude: 40.7505,
            longitude: -73.9934,
            address: '789 Splice Point, New York, NY',
          },
          spliceLoss: 0.12,
          spliceQuality: 'excellent',
          completedBy: 'tech-3',
        },
      };

      const recipients: NotificationRecipient[] = [
        {
          userId: 'tech-3',
          role: 'technician',
          channels: ['websocket'],
          isOnline: true,
        },
        {
          userId: 'foreman-1',
          role: 'foreman',
          channels: ['websocket'],
          isOnline: true,
        },
        {
          userId: 'customer-1',
          role: 'customer', // Should not receive notification (no rule for customer)
          channels: ['email'],
          isOnline: false,
        },
      ];

      // Process event
      await NotificationAPI.processFiberEvent(event, recipients);

      // Verify both technician and foreman received notifications
      expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledTimes(2);
      expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
        'tech-3',
        expect.any(Object)
      );
      expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
        'foreman-1',
        expect.any(Object)
      );
    });

    it('should handle offline users with traditional channels', async () => {
      // Setup rule for offline user
      const rule = createFiberNotificationRule(
        'InspectionPassed',
        'customer',
        ['email'],
        'test-inspection-customer'
      );
      notificationSystem.addRule(rule);

      const event: RealtimeEvent = {
        id: 'test-inspection-passed-1',
        type: 'InspectionPassed',
        version: 'v1.alpha',
        timestamp: new Date().toISOString(),
        workOrderId: 'WO-TEST-004',
        userId: 'inspector-1',
        payload: {
          sectionId: 'SEC-TEST-004',
          inspectionType: 'optical',
          inspector: 'inspector-1',
          qualityScore: 95,
          testResults: {
            powerLoss: 0.08,
            reflectance: -45,
            continuity: true,
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

      // Process event
      await NotificationAPI.processFiberEvent(event, recipients);

      // Verify no WebSocket call was made (user offline)
      expect(mockWebSocketGateway.sendToUser).not.toHaveBeenCalled();

      // Traditional notification service should have been called
      const notificationServiceModule = await import(
        '@/lib/alerts/notification-service'
      );
      expect(
        notificationServiceModule.notificationService.sendNotification
      ).toHaveBeenCalled();
    });
  });

  describe('Direct Notifications', () => {
    it('should send direct notifications', async () => {
      const recipients: NotificationRecipient[] = [
        {
          userId: 'admin-1',
          role: 'admin',
          channels: ['websocket'],
          isOnline: true,
        },
      ];

      await NotificationAPI.sendNotification(
        'System Maintenance',
        'Scheduled maintenance will begin in 30 minutes',
        recipients,
        'high'
      );

      expect(mockWebSocketGateway.sendToUser).toHaveBeenCalledWith(
        'admin-1',
        expect.objectContaining({
          notification: expect.objectContaining({
            title: 'System Maintenance',
            message: 'Scheduled maintenance will begin in 30 minutes',
            priority: 'high',
          }),
        })
      );
    });
  });

  describe('WebSocket Client Management', () => {
    it('should register and track WebSocket clients', () => {
      const client = {
        id: 'client-1',
        userId: 'tech-1',
        connectionId: 'conn-1',
        isConnected: true,
        subscriptions: ['workOrder:WO-001', 'section:SEC-001'],
      };

      NotificationAPI.registerClient(client);

      expect(NotificationAPI.isUserOnline('tech-1')).toBe(true);

      NotificationAPI.unregisterClient('conn-1');

      // Note: This test would need the actual WebSocket bridge implementation
      // to verify the user is no longer online
    });
  });

  describe('System Statistics', () => {
    it('should provide system statistics', () => {
      const stats = NotificationAPI.getStats();

      expect(stats).toHaveProperty('webSocket');
      expect(stats).toHaveProperty('traditional');
      expect(stats.webSocket).toHaveProperty('totalClients');
      expect(stats.webSocket).toHaveProperty('totalUsers');
      expect(stats.traditional).toHaveProperty('totalChannels');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket delivery failures gracefully', async () => {
      // Make WebSocket gateway fail
      mockWebSocketGateway.sendToUser.mockRejectedValue(
        new Error('Connection lost')
      );

      const rule = createFiberNotificationRule(
        'WorkOrderUpdated',
        'technician',
        ['websocket', 'email'],
        'test-error-handling'
      );
      notificationSystem.addRule(rule);

      const event: RealtimeEvent = {
        id: 'test-error-1',
        type: 'WorkOrderUpdated',
        version: 'v1.alpha',
        timestamp: new Date().toISOString(),
        workOrderId: 'WO-ERROR-001',
        userId: 'admin-1',
        payload: {
          status: 'in_progress',
          progressPercentage: 50,
          updatedFields: ['status', 'progressPercentage'],
          previousValues: { status: 'pending', progressPercentage: 0 },
          newValues: { status: 'in_progress', progressPercentage: 50 },
        },
      };

      const recipients: NotificationRecipient[] = [
        {
          userId: 'tech-1',
          role: 'technician',
          channels: ['websocket', 'email'],
          isOnline: true,
        },
      ];

      // Should not throw despite WebSocket failure
      await expect(
        NotificationAPI.processFiberEvent(event, recipients)
      ).resolves.not.toThrow();

      // Should fallback to traditional channels
      const notificationServiceModule = await import(
        '@/lib/alerts/notification-service'
      );
      expect(
        notificationServiceModule.notificationService.sendNotification
      ).toHaveBeenCalled();
    });
  });
});
