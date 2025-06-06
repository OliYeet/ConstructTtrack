/**
 * Optimistic Update Reconciliation
 *
 * Handles optimistic local updates and reconciliation with authoritative state
 * for ConstructTrack's real-time fiber installation workflows.
 */

import { logger } from '../../logging';

import { RealtimeConflictDetector } from './conflict-detector';
import { RealtimeCRDTMerger } from './crdt-merger';
import type {
  OptimisticReconciler,
  OptimisticUpdate,
  ReconciliationResult,
  ConflictMetadata,
  ConflictResolutionConfig,
  RealtimeEvent,
  ProgressUpdate,
  GeoPoint,
  DEFAULT_CONFLICT_RESOLUTION_CONFIG,
} from './types';

export class RealtimeOptimisticReconciler implements OptimisticReconciler {
  private config: ConflictResolutionConfig;
  private conflictDetector: RealtimeConflictDetector;
  private crdtMerger: RealtimeCRDTMerger;
  private pendingUpdates: Map<string, OptimisticUpdate> = new Map();
  private appliedUpdates: Map<string, unknown> = new Map(); // Store rollback data

  constructor(config: Partial<ConflictResolutionConfig> = {}) {
    this.config = { ...DEFAULT_CONFLICT_RESOLUTION_CONFIG, ...config };
    this.conflictDetector = new RealtimeConflictDetector(config);
    this.crdtMerger = new RealtimeCRDTMerger(config);
  }

  async applyOptimisticUpdate(update: OptimisticUpdate): Promise<void> {
    try {
      logger.debug('Applying optimistic update', {
        updateId: update.id,
        type: update.type,
      });

      // Validate the update
      const isValid = await this.conflictDetector.validateUpdate(
        update,
        update.localValue
      );
      if (!isValid) {
        throw new Error(`Invalid optimistic update: ${update.id}`);
      }

      // Store the update for later reconciliation
      this.pendingUpdates.set(update.id, update);

      // Apply the update locally (this would integrate with your state management)
      await this.applyUpdateToLocalState(update);

      logger.debug('Optimistic update applied successfully', {
        updateId: update.id,
      });
    } catch (error) {
      logger.error('Failed to apply optimistic update', { error, update });
      throw error;
    }
  }

  async reconcileWithAuthoritative(
    authoritativeState: unknown,
    pendingUpdates: OptimisticUpdate[]
  ): Promise<ReconciliationResult> {
    const startTime = Date.now();

    try {
      logger.debug('Starting reconciliation with authoritative state', {
        pendingUpdatesCount: pendingUpdates.length,
      });

      const result: ReconciliationResult = {
        success: false,
        conflictsDetected: [],
        conflictsResolved: [],
        rollbacksRequired: [],
        finalState: authoritativeState,
      };

      // Check if we have any pending updates to reconcile
      if (pendingUpdates.length === 0) {
        result.success = true;
        result.finalState = authoritativeState;
        return result;
      }

      // Group updates by type and timestamp for efficient processing
      const groupedUpdates = this.groupUpdatesByType(pendingUpdates);

      // Process each group of updates
      for (const [_updateType, updates] of groupedUpdates) {
        const groupResult = await this.reconcileUpdateGroup(
          _updateType,
          updates,
          authoritativeState
        );

        result.conflictsDetected.push(...groupResult.conflictsDetected);
        result.conflictsResolved.push(...groupResult.conflictsResolved);
        result.rollbacksRequired.push(...groupResult.rollbacksRequired);

        // Update the final state with resolved conflicts
        if (groupResult.finalState) {
          result.finalState = groupResult.finalState;
        }
      }

      // Check for timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.resolutionTimeout) {
        logger.warn('Reconciliation timeout exceeded', {
          elapsed,
          threshold: this.config.resolutionTimeout,
        });

        // Mark remaining updates for rollback
        const remainingUpdates = pendingUpdates
          .filter(u => !result.rollbacksRequired.includes(u.id))
          .map(u => u.id);
        result.rollbacksRequired.push(...remainingUpdates);
      }

      result.success =
        result.conflictsDetected.length === result.conflictsResolved.length;

      logger.debug('Reconciliation completed', {
        success: result.success,
        conflictsDetected: result.conflictsDetected.length,
        conflictsResolved: result.conflictsResolved.length,
        rollbacksRequired: result.rollbacksRequired.length,
        elapsed,
      });

      return result;
    } catch (error) {
      logger.error('Reconciliation failed', { error, authoritativeState });

      // Return a safe fallback result
      return {
        success: false,
        conflictsDetected: [],
        conflictsResolved: [],
        rollbacksRequired: pendingUpdates.map(u => u.id),
        finalState: authoritativeState,
      };
    }
  }

  async rollbackOptimisticUpdates(updateIds: string[]): Promise<void> {
    try {
      logger.debug('Rolling back optimistic updates', { updateIds });

      for (const updateId of updateIds) {
        const update = this.pendingUpdates.get(updateId);
        if (!update) {
          logger.warn('Update not found for rollback', { updateId });
          continue;
        }

        // Restore the previous state if we have rollback data
        if (update.rollbackData) {
          await this.restorePreviousState(update, update.rollbackData);
        }

        // Remove from pending updates
        this.pendingUpdates.delete(updateId);
        this.appliedUpdates.delete(updateId);

        logger.debug('Optimistic update rolled back', { updateId });
      }
    } catch (error) {
      logger.error('Failed to rollback optimistic updates', {
        error,
        updateIds,
      });
      throw error;
    }
  }

  // Helper methods
  private groupUpdatesByType(
    updates: OptimisticUpdate[]
  ): Map<string, OptimisticUpdate[]> {
    const grouped = new Map<string, OptimisticUpdate[]>();

    for (const update of updates) {
      const existing = grouped.get(update.type) || [];
      existing.push(update);
      grouped.set(update.type, existing);
    }

    // Sort each group by timestamp
    for (const typeUpdates of grouped.values()) {
      typeUpdates.sort((a, b) => a.appliedAt - b.appliedAt);
    }

    return grouped;
  }

  private async reconcileUpdateGroup(
    updateType: string,
    updates: OptimisticUpdate[],
    authoritativeState: unknown
  ): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      success: false,
      conflictsDetected: [],
      conflictsResolved: [],
      rollbacksRequired: [],
      finalState: authoritativeState,
    };

    try {
      // Create metadata for conflict detection
      const metadata: ConflictMetadata = {
        userId: updates[0]?.userId || 'unknown',
        organizationId: 'default', // Would be extracted from context
        workOrderId: 'default', // Would be extracted from update
        timestamp: Date.now(),
        source: 'local',
      };

      // Detect conflicts between local updates and authoritative state
      for (const update of updates) {
        const conflicts = await this.conflictDetector.detectConflicts(
          update.localValue,
          [this.createEventFromUpdate(update)],
          metadata
        );

        result.conflictsDetected.push(...conflicts);

        // Try to resolve conflicts using CRDT merge
        if (conflicts.length > 0) {
          const resolutionResult = await this.resolveUpdateConflicts(
            update,
            authoritativeState,
            metadata
          );

          if (resolutionResult.success) {
            result.conflictsResolved.push(
              ...resolutionResult.conflictsResolved
            );
            result.finalState = resolutionResult.finalState;
          } else {
            result.rollbacksRequired.push(update.id);
          }
        } else {
          // No conflicts - update can be confirmed
          update.confirmed = true;
          result.finalState = this.applyUpdateToState(
            result.finalState,
            update
          );
        }
      }

      result.success =
        result.conflictsDetected.length === result.conflictsResolved.length;
      return result;
    } catch (error) {
      logger.error('Failed to reconcile update group', { error, updateType });

      // Mark all updates for rollback on error
      result.rollbacksRequired = updates.map(u => u.id);
      return result;
    }
  }

  private async resolveUpdateConflicts(
    update: OptimisticUpdate,
    authoritativeState: unknown,
    metadata: ConflictMetadata
  ): Promise<ReconciliationResult> {
    try {
      // Use CRDT merger based on update type
      let mergeResult;

      switch (update.type) {
        case 'FiberSectionProgress': {
          // Extract progress data and merge
          const localProgress = this.extractProgressFromUpdate(update);
          const remoteProgress =
            this.extractProgressFromState(authoritativeState);

          if (localProgress && remoteProgress) {
            mergeResult = await this.crdtMerger.mergeProgressPercentages(
              localProgress,
              remoteProgress,
              metadata
            );
          }
          break;
        }

        case 'FiberSectionStarted':
        case 'CablePulled':
        case 'SpliceCompleted': {
          // Extract geo data and merge
          const localGeo = this.extractGeoFromUpdate(update);
          const remoteGeo = this.extractGeoFromState(authoritativeState);

          if (localGeo && remoteGeo) {
            mergeResult = await this.crdtMerger.mergeGeoCoordinates(
              localGeo,
              remoteGeo,
              metadata
            );
          }
          break;
        }

        default:
          // For unknown types, prefer authoritative state
          mergeResult = {
            mergedValue: authoritativeState,
            conflicts: [],
            confidence: 0.5,
            strategy: 'last_writer_wins' as const,
          };
      }

      if (mergeResult && mergeResult.confidence > 0.7) {
        return {
          success: true,
          conflictsDetected: [],
          conflictsResolved: [
            {
              conflictId: `resolved_${update.id}`,
              strategy: mergeResult.strategy,
              resolvedValue: mergeResult.mergedValue,
              confidence: mergeResult.confidence,
              appliedAt: Date.now(),
              appliedBy: 'system',
              rollbackPossible: true,
            },
          ],
          rollbacksRequired: [],
          finalState: mergeResult.mergedValue,
        };
      }

      // Low confidence - require rollback
      return {
        success: false,
        conflictsDetected: [],
        conflictsResolved: [],
        rollbacksRequired: [update.id],
        finalState: authoritativeState,
      };
    } catch (error) {
      logger.error('Failed to resolve update conflicts', { error, update });
      return {
        success: false,
        conflictsDetected: [],
        conflictsResolved: [],
        rollbacksRequired: [update.id],
        finalState: authoritativeState,
      };
    }
  }

  private async applyUpdateToLocalState(
    update: OptimisticUpdate
  ): Promise<void> {
    // Store rollback data before applying
    const currentState = await this.getCurrentLocalState(update);
    update.rollbackData = currentState;

    // Apply the update (this would integrate with your state management system)
    this.appliedUpdates.set(update.id, update.localValue);

    // In a real implementation, this would update your React state, Redux store, etc.
    logger.debug('Update applied to local state', { updateId: update.id });
  }

  private async restorePreviousState(
    update: OptimisticUpdate,
    _rollbackData: unknown
  ): Promise<void> {
    // Restore the previous state (integrate with your state management)
    logger.debug('Restoring previous state', { updateId: update.id });

    // In a real implementation, this would restore your React state, Redux store, etc.
  }

  private async getCurrentLocalState(
    _update: OptimisticUpdate
  ): Promise<unknown> {
    // Get current local state for rollback purposes
    // This would integrate with your state management system
    return null;
  }

  private createEventFromUpdate(update: OptimisticUpdate): RealtimeEvent {
    return {
      id: update.id,
      type: update.type,
      payload: update.localValue,
      timestamp: update.appliedAt,
      userId: update.userId,
      metadata: {},
    };
  }

  private applyUpdateToState(
    state: unknown,
    update: OptimisticUpdate
  ): unknown {
    // Apply update to state - this would be specific to your data structure
    return update.localValue;
  }

  private extractProgressFromUpdate(
    update: OptimisticUpdate
  ): ProgressUpdate | null {
    const payload = update.localValue as Record<string, unknown>;
    const progress = payload?.progress as Record<string, unknown> | undefined;

    if (progress && typeof progress.percentage === 'number') {
      return {
        percentage: progress.percentage,
        milestone:
          typeof progress.milestone === 'string'
            ? progress.milestone
            : undefined,
        timestamp:
          typeof progress.timestamp === 'number'
            ? progress.timestamp
            : Date.now(),
        userId:
          typeof progress.userId === 'string' ? progress.userId : update.userId,
        verified: Boolean(progress.verified),
      };
    }
    return null;
  }

  private extractProgressFromState(state: unknown): ProgressUpdate | null {
    const stateObj = state as Record<string, unknown>;
    const progress = stateObj?.progress as Record<string, unknown> | undefined;

    if (progress && typeof progress.percentage === 'number') {
      return {
        percentage: progress.percentage,
        milestone:
          typeof progress.milestone === 'string'
            ? progress.milestone
            : undefined,
        timestamp:
          typeof progress.timestamp === 'number'
            ? progress.timestamp
            : Date.now(),
        userId:
          typeof progress.userId === 'string' ? progress.userId : 'unknown',
        verified: Boolean(progress.verified),
      };
    }
    return null;
  }

  private extractGeoFromUpdate(update: OptimisticUpdate): GeoPoint | null {
    const payload = update.localValue as Record<string, unknown>;
    const location = (payload?.location || payload?.startLocation) as
      | Record<string, unknown>
      | undefined;

    if (
      location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number'
    ) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy:
          typeof location.accuracy === 'number' ? location.accuracy : undefined,
        timestamp:
          typeof location.timestamp === 'number'
            ? location.timestamp
            : Date.now(),
        source:
          typeof location.source === 'string' ? location.source : update.userId,
      };
    }
    return null;
  }

  private extractGeoFromState(state: unknown): GeoPoint | null {
    const stateObj = state as Record<string, unknown>;
    const location = stateObj?.location as Record<string, unknown> | undefined;

    if (
      location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number'
    ) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy:
          typeof location.accuracy === 'number' ? location.accuracy : undefined,
        timestamp:
          typeof location.timestamp === 'number'
            ? location.timestamp
            : Date.now(),
        source:
          typeof location.source === 'string' ? location.source : 'unknown',
      };
    }
    return null;
  }

  // Public methods for managing pending updates
  public getPendingUpdates(): OptimisticUpdate[] {
    return Array.from(this.pendingUpdates.values());
  }

  public clearConfirmedUpdates(): void {
    for (const [id, update] of this.pendingUpdates) {
      if (update.confirmed) {
        this.pendingUpdates.delete(id);
        this.appliedUpdates.delete(id);
      }
    }
  }

  public getUpdateCount(): number {
    return this.pendingUpdates.size;
  }
}
