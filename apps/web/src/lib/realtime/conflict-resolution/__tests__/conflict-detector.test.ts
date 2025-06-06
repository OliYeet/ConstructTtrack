/**
 * Conflict Detector Tests
 *
 * Unit tests for real-time conflict detection in fiber installation workflows.
 */

import { RealtimeConflictDetector } from '../conflict-detector';
import type {
  ConflictMetadata,
  GeoPoint,
  ProgressUpdate,
  FiberSectionState,
  RealtimeEvent,
} from '../types';

describe('RealtimeConflictDetector', () => {
  let detector: RealtimeConflictDetector;
  let mockMetadata: ConflictMetadata;

  beforeEach(() => {
    detector = new RealtimeConflictDetector({
      maxDistanceThreshold: 100, // 100 meters
      coordinateAccuracyThreshold: 10,
      allowProgressDecrease: false,
      maxProgressJump: 25,
      conflictDetectionTimeout: 50,
    });

    mockMetadata = {
      userId: 'user123',
      organizationId: 'org456',
      workOrderId: 'wo789',
      sectionId: 'section001',
      timestamp: Date.now(),
      source: 'local',
    };
  });

  describe('detectConflicts', () => {
    it('should detect geo-coordinate conflicts when distance exceeds threshold', async () => {
      const localGeo: GeoPoint = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
        timestamp: Date.now(),
        source: 'user123',
      };

      const remoteEvent: RealtimeEvent = {
        id: 'event1',
        type: 'FiberSectionStarted',
        payload: {
          startLocation: {
            latitude: 40.7228, // ~1.1km away
            longitude: -74.016,
            accuracy: 5,
          },
        },
        timestamp: Date.now(),
        userId: 'user456',
      };

      const conflicts = await detector.detectConflicts(
        localGeo,
        [remoteEvent],
        mockMetadata
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('geo_coordinate');
      expect(conflicts[0].severity).toBe('high');
    });

    it('should detect progress percentage conflicts when decrease is not allowed', async () => {
      const localProgress: ProgressUpdate = {
        percentage: 75,
        timestamp: Date.now(),
        userId: 'user123',
        verified: true,
      };

      const remoteEvent: RealtimeEvent = {
        id: 'event2',
        type: 'FiberSectionProgress',
        payload: {
          progress: 50, // Decrease from 75% to 50%
        },
        timestamp: Date.now(),
        userId: 'user456',
      };

      const conflicts = await detector.detectConflicts(
        localProgress,
        [remoteEvent],
        mockMetadata
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('progress_percentage');
      expect(conflicts[0].severity).toBe('high');
      expect(conflicts[0].autoResolvable).toBe(false);
    });

    it('should detect large progress jumps', async () => {
      const localProgress: ProgressUpdate = {
        percentage: 25,
        timestamp: Date.now(),
        userId: 'user123',
        verified: true,
      };

      const remoteEvent: RealtimeEvent = {
        id: 'event3',
        type: 'FiberSectionProgress',
        payload: {
          progress: 75, // Jump from 25% to 75% (50% jump)
        },
        timestamp: Date.now(),
        userId: 'user456',
      };

      const conflicts = await detector.detectConflicts(
        localProgress,
        [remoteEvent],
        mockMetadata
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('progress_percentage');
      expect(conflicts[0].severity).toBe('medium');
      expect(conflicts[0].autoResolvable).toBe(true);
    });

    it('should detect concurrent updates within time window', async () => {
      const now = Date.now();
      const localGeo: GeoPoint = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
        timestamp: now,
        source: 'user123',
      };

      const remoteEvent: RealtimeEvent = {
        id: 'event4',
        type: 'CablePulled',
        payload: {
          location: {
            latitude: 40.713, // Very close but different user
            longitude: -74.0062,
            accuracy: 5,
          },
        },
        timestamp: now + 2000, // 2 seconds later
        userId: 'user456',
      };

      const conflicts = await detector.detectConflicts(
        localGeo,
        [remoteEvent],
        mockMetadata
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('concurrent_update');
      expect(conflicts[0].autoResolvable).toBe(true);
    });

    it('should not detect conflicts for valid updates', async () => {
      const localProgress: ProgressUpdate = {
        percentage: 50,
        timestamp: Date.now(),
        userId: 'user123',
        verified: true,
      };

      const remoteEvent: RealtimeEvent = {
        id: 'event5',
        type: 'FiberSectionProgress',
        payload: {
          progress: 60, // Valid 10% increase
        },
        timestamp: Date.now(),
        userId: 'user456',
      };

      const conflicts = await detector.detectConflicts(
        localProgress,
        [remoteEvent],
        mockMetadata
      );

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('validateUpdate', () => {
    it('should validate progress updates correctly', async () => {
      const validUpdate = {
        id: 'update1',
        type: 'FiberSectionProgress' as const,
        localValue: { percentage: 75 },
        appliedAt: Date.now(),
        userId: 'user123',
        rollbackData: null,
        confirmed: false,
      };

      const isValid = await detector.validateUpdate(validUpdate, null);
      expect(isValid).toBe(true);
    });

    it('should reject invalid progress percentages', async () => {
      const invalidUpdate = {
        id: 'update2',
        type: 'FiberSectionProgress' as const,
        localValue: { percentage: 150 }, // Invalid: > 100%
        appliedAt: Date.now(),
        userId: 'user123',
        rollbackData: null,
        confirmed: false,
      };

      const isValid = await detector.validateUpdate(invalidUpdate, null);
      expect(isValid).toBe(false);
    });

    it('should validate geo updates correctly', async () => {
      const validUpdate = {
        id: 'update3',
        type: 'FiberSectionStarted' as const,
        localValue: {
          startLocation: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        },
        appliedAt: Date.now(),
        userId: 'user123',
        rollbackData: null,
        confirmed: false,
      };

      const isValid = await detector.validateUpdate(validUpdate, null);
      expect(isValid).toBe(true);
    });

    it('should reject invalid coordinates', async () => {
      const invalidUpdate = {
        id: 'update4',
        type: 'CablePulled' as const,
        localValue: {
          location: {
            latitude: 200, // Invalid: > 90
            longitude: -74.006,
          },
        },
        appliedAt: Date.now(),
        userId: 'user123',
        rollbackData: null,
        confirmed: false,
      };

      const isValid = await detector.validateUpdate(invalidUpdate, null);
      expect(isValid).toBe(false);
    });

    it('should reject updates with missing required fields', async () => {
      const invalidUpdate = {
        id: '', // Missing ID
        type: 'FiberSectionProgress' as const,
        localValue: { percentage: 75 },
        appliedAt: Date.now(),
        userId: 'user123',
        rollbackData: null,
        confirmed: false,
      };

      const isValid = await detector.validateUpdate(invalidUpdate, null);
      expect(isValid).toBe(false);
    });
  });

  describe('state transition validation', () => {
    it('should detect invalid state transitions', async () => {
      const localState: FiberSectionState = {
        id: 'section001',
        status: 'completed',
        progress: {
          percentage: 100,
          timestamp: Date.now(),
          userId: 'user123',
          verified: true,
        },
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 5,
          timestamp: Date.now(),
          source: 'user123',
        },
        lastModified: Date.now(),
        modifiedBy: 'user123',
      };

      const remoteEvent: RealtimeEvent = {
        id: 'event6',
        type: 'FiberSectionStarted',
        payload: {
          status: 'started', // Invalid: completed -> started
        },
        timestamp: Date.now(),
        userId: 'user456',
      };

      const conflicts = await detector.detectConflicts(
        localState,
        [remoteEvent],
        mockMetadata
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('state_transition');
      expect(conflicts[0].severity).toBe('high');
      expect(conflicts[0].autoResolvable).toBe(false);
    });
  });

  describe('performance', () => {
    it('should complete conflict detection within timeout', async () => {
      const startTime = Date.now();

      const localGeo: GeoPoint = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
        timestamp: Date.now(),
        source: 'user123',
      };

      // Create multiple events to test performance
      const events: RealtimeEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `event${i}`,
        type: 'FiberSectionStarted',
        payload: {
          startLocation: {
            latitude: 40.7128 + i * 0.001,
            longitude: -74.006 + i * 0.001,
          },
        },
        timestamp: Date.now(),
        userId: `user${i}`,
      }));

      await detector.detectConflicts(localGeo, events, mockMetadata);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100); // Should complete within 100ms
    });
  });
});
