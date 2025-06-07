/**
 * Conflict Engine Service - V1 Implementation
 *
 * Thin conflict resolution layer following Charlie's strategic guidance:
 * - Parallel development with LUM-588 (Event Sourcing)
 * - Focus on state transitions and progress percentages first
 * - Designed to delegate to event-sourcing engine when ready
 * - Feature flag gated for gradual rollout
 */

import { randomUUID } from 'crypto';

// Core interfaces designed for event-sourcing compatibility
export interface ConflictEngine {
  detectConflict(
    localState: unknown,
    remoteState: unknown,
    metadata: ConflictMetadata
  ): Promise<ConflictResult>;
  resolveConflict(conflict: Conflict): Promise<ResolutionResult>;
  isEnabled(): boolean;
}

export interface ConflictMetadata {
  userId: string;
  organizationId: string;
  workOrderId: string;
  sectionId?: string;
  timestamp: number;
  source: 'local' | 'remote' | 'authoritative';
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'offline';
}

export interface Conflict {
  id: string;
  type: 'state_transition' | 'progress_percentage' | 'geo_coordinate';
  severity: 'low' | 'medium' | 'high';
  localValue: unknown;
  remoteValue: unknown;
  metadata: ConflictMetadata;
  detectedAt: number;
  autoResolvable: boolean;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Conflict[];
  canAutoResolve: boolean;
}

export interface ResolutionResult {
  success: boolean;
  resolvedValue: unknown;
  strategy: 'precedence_graph' | 'monotonic_counter' | 'last_writer_wins';
  confidence: number; // 0-1
  appliedAt: number;
}

// V1 Implementation - Simple but extensible
export class ConflictEngineV1 implements ConflictEngine {
  private enabled: boolean;

  constructor(
    private config: {
      enableConflictResolution: boolean;
      largeProgressDiffThreshold?: number;
      allowProgressDecrease?: boolean;
    } = {
      enableConflictResolution: isConflictResolutionEnabled(),
    }
  ) {
    this.enabled = config.enableConflictResolution;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async detectConflict(
    localState: unknown,
    remoteState: unknown,
    metadata: ConflictMetadata
  ): Promise<ConflictResult> {
    if (!this.enabled) {
      return { hasConflict: false, conflicts: [], canAutoResolve: true };
    }

    const conflicts: Conflict[] = [];

    // Priority 1: State transitions (highest business risk)
    const stateConflict = this.detectStateTransitionConflict(
      localState,
      remoteState,
      metadata
    );
    if (stateConflict) {
      conflicts.push(stateConflict);
    }

    // Priority 2: Progress percentages (numeric, monotonic)
    const progressConflict = this.detectProgressConflict(
      localState,
      remoteState,
      metadata
    );
    if (progressConflict) {
      conflicts.push(progressConflict);
    }

    // Priority 3: Geo-coordinates (deferred for now per Charlie's guidance)
    // Will implement after state + progress are stable

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      canAutoResolve: conflicts.every(c => c.autoResolvable),
    };
  }

  async resolveConflict(conflict: Conflict): Promise<ResolutionResult> {
    if (!this.enabled) {
      throw new Error('Conflict resolution is disabled');
    }

    switch (conflict.type) {
      case 'state_transition':
        return this.resolveStateTransition(conflict);
      case 'progress_percentage':
        return this.resolveProgressPercentage(conflict);
      default:
        throw new Error(`Unsupported conflict type: ${conflict.type}`);
    }
  }

  // State transition resolution using precedence graph
  private detectStateTransitionConflict(
    localState: unknown,
    remoteState: unknown,
    metadata: ConflictMetadata
  ): Conflict | null {
    const local = this.extractState(localState);
    const remote = this.extractState(remoteState);

    if (!local || !remote || local.status === remote.status) {
      return null;
    }

    // Check if transition is valid according to precedence graph
    const isValidTransition = this.isValidStateTransition(
      local.status,
      remote.status
    );

    // Return null for valid transitions - no conflict
    if (isValidTransition) {
      return null;
    }

    return {
      id: randomUUID(),
      type: 'state_transition',
      severity: 'high',
      localValue: local,
      remoteValue: remote,
      metadata,
      detectedAt: Date.now(),
      autoResolvable: false,
    };
  }

  private resolveStateTransition(conflict: Conflict): ResolutionResult {
    const local = this.extractState(conflict.localValue);
    const remote = this.extractState(conflict.remoteValue);

    if (!local || !remote) {
      throw new Error('Invalid state data in conflict resolution');
    }

    // Precedence graph: PLANNED < IN_PROGRESS < DONE
    const precedence = {
      planned: 1,
      in_progress: 2,
      done: 3,
      completed: 3, // synonym for done
      failed: 0,
    } as const;

    const localPrecedence =
      precedence[local.status as keyof typeof precedence] ?? 0;
    const remotePrecedence =
      precedence[remote.status as keyof typeof precedence] ?? 0;

    // Higher precedence wins, timestamp breaks ties
    let resolvedValue: unknown;
    if (localPrecedence > remotePrecedence) {
      resolvedValue = local;
    } else if (remotePrecedence > localPrecedence) {
      resolvedValue = remote;
    } else {
      // Same precedence - use timestamp (last writer wins)
      resolvedValue = local.lastModified > remote.lastModified ? local : remote;
    }

    return {
      success: true,
      resolvedValue,
      strategy: 'precedence_graph',
      confidence: 0.9,
      appliedAt: Date.now(),
    };
  }

  // Progress percentage resolution using monotonic counter
  private detectProgressConflict(
    localState: unknown,
    remoteState: unknown,
    metadata: ConflictMetadata
  ): Conflict | null {
    const local = this.extractProgress(localState);
    const remote = this.extractProgress(remoteState);

    if (!local || !remote || local.percentage === remote.percentage) {
      return null;
    }

    // Check for invalid progress decrease (only if remote is newer)
    const isRemoteNewer = remote.timestamp > local.timestamp;
    const hasDecrease = isRemoteNewer && remote.percentage < local.percentage;
    const LARGE_PROGRESS_DIFF_THRESHOLD =
      this.config.largeProgressDiffThreshold ?? 25;
    const largeDiff =
      Math.abs(local.percentage - remote.percentage) >
      LARGE_PROGRESS_DIFF_THRESHOLD;

    if (!hasDecrease && !largeDiff) {
      return null; // Valid progress increase
    }

    return {
      id: randomUUID(),
      type: 'progress_percentage',
      severity: hasDecrease ? 'high' : 'medium',
      localValue: local,
      remoteValue: remote,
      metadata,
      detectedAt: Date.now(),
      autoResolvable: !hasDecrease, // Can auto-resolve increases, not decreases
    };
  }

  private resolveProgressPercentage(conflict: Conflict): ResolutionResult {
    const local = this.extractProgress(conflict.localValue);
    const remote = this.extractProgress(conflict.remoteValue);

    if (!local || !remote) {
      throw new Error('Invalid progress data in conflict resolution');
    }

    // Check if progress decreases are allowed
    const allowProgressDecrease = this.config.allowProgressDecrease ?? false;

    if (!allowProgressDecrease) {
      // Enforce monotonic increase - higher percentage wins
      const resolvedValue =
        local.percentage > remote.percentage ? local : remote;
      return {
        success: true,
        resolvedValue,
        strategy: 'monotonic_counter',
        confidence: 0.95,
        appliedAt: Date.now(),
      };
    } else {
      // Allow decreases - use timestamp to determine most recent
      const resolvedValue = local.timestamp > remote.timestamp ? local : remote;
      return {
        success: true,
        resolvedValue,
        strategy: 'last_writer_wins',
        confidence: 0.85,
        appliedAt: Date.now(),
      };
    }
  }

  // Helper methods for extracting typed data
  private extractState(
    state: unknown
  ): { status: string; lastModified: number } | null {
    if (typeof state === 'object' && state !== null) {
      const obj = state as Record<string, unknown>;
      if (
        typeof obj.status === 'string' &&
        typeof obj.lastModified === 'number'
      ) {
        return { status: obj.status, lastModified: obj.lastModified };
      }
    }
    return null;
  }

  private extractProgress(
    state: unknown
  ): { percentage: number; timestamp: number } | null {
    if (typeof state === 'object' && state !== null) {
      const obj = state as Record<string, unknown>;
      const progress = obj.progress as Record<string, unknown> | undefined;
      if (
        progress &&
        typeof progress.percentage === 'number' &&
        typeof progress.timestamp === 'number'
      ) {
        return {
          percentage: progress.percentage,
          timestamp: progress.timestamp,
        };
      }
    }
    return null;
  }

  private isValidStateTransition(from: string, to: string): boolean {
    const validTransitions: Record<string, string[]> = {
      planned: ['in_progress'],
      in_progress: ['done', 'completed', 'failed'],
      done: [], // Terminal state
      completed: [], // Terminal state (synonym for done)
      failed: ['planned'], // Can restart
    };

    return validTransitions[from]?.includes(to) ?? false;
  }
}

// Factory function for dependency injection compatibility
export function createConflictEngine(config?: {
  enableConflictResolution: boolean;
  largeProgressDiffThreshold?: number;
  allowProgressDecrease?: boolean;
}): ConflictEngine {
  return new ConflictEngineV1(config);
}

// Feature flag helper
export function isConflictResolutionEnabled(): boolean {
  return process.env.ENABLE_CONFLICT_RESOLUTION === 'true';
}

// Export for event-sourcing integration (future)
export interface EventSourcingConflictEngine extends ConflictEngine {
  replayEvents(events: unknown[]): Promise<unknown>;
  getEventLog(entityId: string): Promise<unknown[]>;
}

// Placeholder for future event-sourcing integration
export class EventSourcingConflictEngineAdapter
  implements EventSourcingConflictEngine
{
  constructor(
    private baseEngine: ConflictEngine,
    private eventStore: unknown
  ) {}

  async detectConflict(
    localState: unknown,
    remoteState: unknown,
    metadata: ConflictMetadata
  ): Promise<ConflictResult> {
    // Delegate to base engine for now, enhance with event sourcing later
    return this.baseEngine.detectConflict(localState, remoteState, metadata);
  }

  async resolveConflict(conflict: Conflict): Promise<ResolutionResult> {
    // Delegate to base engine for now, enhance with event sourcing later
    return this.baseEngine.resolveConflict(conflict);
  }

  isEnabled(): boolean {
    return this.baseEngine.isEnabled();
  }

  async replayEvents(_events: unknown[]): Promise<unknown> {
    // TODO: Implement when LUM-588 is ready
    throw new Error('Event sourcing not yet implemented');
  }

  async getEventLog(_entityId: string): Promise<unknown[]> {
    // TODO: Implement when LUM-588 is ready
    throw new Error('Event sourcing not yet implemented');
  }
}

export default ConflictEngineV1;
