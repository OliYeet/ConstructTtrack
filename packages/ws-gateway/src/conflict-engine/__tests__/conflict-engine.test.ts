/**
 * Conflict Engine Tests
 *
 * Tests for V1 conflict resolution following Charlie's strategic guidance:
 * - State transitions (highest priority)
 * - Progress percentages (monotonic counter)
 * - Feature flag gating
 */

import {
  ConflictEngineV1,
  createConflictEngine,
  isConflictResolutionEnabled,
} from '../index';
import type { ConflictMetadata } from '../index';

describe('ConflictEngineV1', () => {
  let engine: ConflictEngineV1;
  let mockMetadata: ConflictMetadata;

  beforeEach(() => {
    // Enable conflict resolution for tests
    process.env.ENABLE_CONFLICT_RESOLUTION = 'true';

    engine = new ConflictEngineV1({ enableConflictResolution: true });

    mockMetadata = {
      userId: 'user123',
      organizationId: 'org456',
      workOrderId: 'wo789',
      sectionId: 'section001',
      timestamp: Date.now(),
      source: 'local',
      connectionQuality: 'good',
    };
  });

  afterEach(() => {
    delete process.env.ENABLE_CONFLICT_RESOLUTION;
  });

  describe('Feature Flag', () => {
    it('should respect feature flag when disabled', async () => {
      const disabledEngine = new ConflictEngineV1({
        enableConflictResolution: false,
      });

      expect(disabledEngine.isEnabled()).toBe(false);

      const result = await disabledEngine.detectConflict({}, {}, mockMetadata);
      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should work when feature flag is enabled', async () => {
      expect(engine.isEnabled()).toBe(true);
    });

    it('should read environment variable correctly', () => {
      process.env.ENABLE_CONFLICT_RESOLUTION = 'true';
      expect(isConflictResolutionEnabled()).toBe(true);

      process.env.ENABLE_CONFLICT_RESOLUTION = 'false';
      expect(isConflictResolutionEnabled()).toBe(false);

      delete process.env.ENABLE_CONFLICT_RESOLUTION;
      expect(isConflictResolutionEnabled()).toBe(false);
    });
  });

  describe('State Transition Conflicts - Priority 1', () => {
    it('should detect invalid state transitions', async () => {
      const localState = {
        status: 'completed',
        lastModified: Date.now() - 1000,
      };

      const remoteState = {
        status: 'planned', // Invalid: completed -> planned
        lastModified: Date.now(),
      };

      const result = await engine.detectConflict(
        localState,
        remoteState,
        mockMetadata
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('state_transition');
      expect(result.conflicts[0].severity).toBe('high');
      expect(result.conflicts[0].autoResolvable).toBe(false);
    });

    it('should allow valid state transitions', async () => {
      const localState = {
        status: 'planned',
        lastModified: Date.now() - 1000,
      };

      const remoteState = {
        status: 'in_progress', // Valid: planned -> in_progress
        lastModified: Date.now(),
      };

      const result = await engine.detectConflict(
        localState,
        remoteState,
        mockMetadata
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].severity).toBe('low');
      expect(result.conflicts[0].autoResolvable).toBe(true);
    });

    it('should resolve state conflicts using precedence graph', async () => {
      const conflict = {
        id: 'test-conflict',
        type: 'state_transition' as const,
        severity: 'low' as const,
        localValue: { status: 'planned', lastModified: Date.now() - 1000 },
        remoteValue: { status: 'in_progress', lastModified: Date.now() },
        metadata: mockMetadata,
        detectedAt: Date.now(),
        autoResolvable: true,
      };

      const resolution = await engine.resolveConflict(conflict);

      expect(resolution.success).toBe(true);
      expect(resolution.strategy).toBe('precedence_graph');
      expect(resolution.confidence).toBe(0.9);
      expect((resolution.resolvedValue as any).status).toBe('in_progress'); // Higher precedence
    });
  });

  describe('Progress Percentage Conflicts - Priority 2', () => {
    it('should detect progress decrease conflicts', async () => {
      const localState = {
        progress: { percentage: 75, timestamp: Date.now() - 1000 },
      };

      const remoteState = {
        progress: { percentage: 50, timestamp: Date.now() }, // Decrease from 75% to 50%
      };

      const result = await engine.detectConflict(
        localState,
        remoteState,
        mockMetadata
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('progress_percentage');
      expect(result.conflicts[0].severity).toBe('high');
      expect(result.conflicts[0].autoResolvable).toBe(false); // Decreases require manual resolution
    });

    it('should allow normal progress increases', async () => {
      const localState = {
        progress: { percentage: 50, timestamp: Date.now() - 1000 },
      };

      const remoteState = {
        progress: { percentage: 60, timestamp: Date.now() }, // Normal 10% increase
      };

      const result = await engine.detectConflict(
        localState,
        remoteState,
        mockMetadata
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should resolve progress conflicts using monotonic counter', async () => {
      const conflict = {
        id: 'test-conflict',
        type: 'progress_percentage' as const,
        severity: 'medium' as const,
        localValue: { percentage: 60, timestamp: Date.now() - 1000 },
        remoteValue: { percentage: 75, timestamp: Date.now() },
        metadata: mockMetadata,
        detectedAt: Date.now(),
        autoResolvable: true,
      };

      const resolution = await engine.resolveConflict(conflict);

      expect(resolution.success).toBe(true);
      expect(resolution.strategy).toBe('monotonic_counter');
      expect(resolution.confidence).toBe(0.95);
      expect((resolution.resolvedValue as any).percentage).toBe(75); // Higher value wins
    });
  });

  describe('No Conflicts', () => {
    it('should return no conflicts for identical states', async () => {
      const state = {
        status: 'in_progress',
        progress: { percentage: 50, timestamp: Date.now() },
        lastModified: Date.now(),
      };

      const result = await engine.detectConflict(state, state, mockMetadata);

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.canAutoResolve).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create engine with default config', () => {
      const engine = createConflictEngine();
      expect(engine).toBeInstanceOf(ConflictEngineV1);
    });
  });
});
