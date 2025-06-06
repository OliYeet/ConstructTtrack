/**
 * CRDT-Style Merge Algorithms
 *
 * Conflict-free Replicated Data Type merge strategies for geo-coordinates,
 * progress percentages, and fiber section states in rural connectivity scenarios.
 */

import { getLogger } from '../../logging';

const logger = getLogger();

import type {
  CRDTMerger,
  CRDTMergeResult,
  ConflictMetadata,
  ConflictResolutionConfig,
  FiberSectionState,
  GeoPoint,
  ProgressUpdate,
  ResolutionStrategy,
} from './types';
import { DEFAULT_CONFLICT_RESOLUTION_CONFIG } from './types';

export class RealtimeCRDTMerger implements CRDTMerger {
  private config: ConflictResolutionConfig;

  constructor(config: Partial<ConflictResolutionConfig> = {}) {
    this.config = { ...DEFAULT_CONFLICT_RESOLUTION_CONFIG, ...config };
  }

  async mergeGeoCoordinates(
    local: GeoPoint,
    remote: GeoPoint,
    metadata: ConflictMetadata
  ): Promise<CRDTMergeResult> {
    try {
      logger.debug('Merging geo coordinates', { local, remote, metadata });

      // Strategy 1: Accuracy-based merge (higher accuracy wins)
      if (local.accuracy && remote.accuracy) {
        if (local.accuracy < remote.accuracy) {
          return this.createMergeResult(local, 'distance_validation', 0.9);
        } else if (remote.accuracy < local.accuracy) {
          return this.createMergeResult(remote, 'distance_validation', 0.9);
        }
      }

      // Strategy 2: Timestamp-based merge with rural connectivity consideration
      const timeDiff = Math.abs(local.timestamp - remote.timestamp);

      // If updates are very close in time, use distance validation
      if (timeDiff < 10000) {
        // 10 seconds
        const distance = this.calculateDistance(local, remote);

        // If coordinates are close, average them
        if (distance < this.config.coordinateAccuracyThreshold) {
          const averaged = this.averageCoordinates(local, remote);
          return this.createMergeResult(averaged, 'crdt_merge', 0.95);
        }

        // If far apart, use role-based priority or last writer wins
        if (this.hasHigherPriority(local.source, remote.source, metadata)) {
          return this.createMergeResult(local, 'role_based_priority', 0.8);
        } else {
          return this.createMergeResult(remote, 'role_based_priority', 0.8);
        }
      }

      // Strategy 3: Last writer wins for distant timestamps
      if (local.timestamp > remote.timestamp) {
        return this.createMergeResult(local, 'last_writer_wins', 0.7);
      } else {
        return this.createMergeResult(remote, 'last_writer_wins', 0.7);
      }
    } catch (error) {
      logger.error('Geo coordinate merge failed', { error, local, remote });
      // Fallback to local value
      return this.createMergeResult(local, 'last_writer_wins', 0.5);
    }
  }

  async mergeProgressPercentages(
    local: ProgressUpdate,
    remote: ProgressUpdate,
    metadata: ConflictMetadata
  ): Promise<CRDTMergeResult> {
    try {
      logger.debug('Merging progress percentages', { local, remote, metadata });

      // Strategy 1: Maximum value wins (progress can only increase)
      if (local.percentage !== remote.percentage) {
        const maxProgress =
          local.percentage > remote.percentage ? local : remote;

        // Validate the jump isn't too large
        const diff = Math.abs(local.percentage - remote.percentage);
        if (diff > this.config.maxProgressJump) {
          // Large jump detected - use role-based resolution
          if (this.hasHigherPriority(local.userId, remote.userId, metadata)) {
            return this.createMergeResult(local, 'role_based_priority', 0.6);
          } else {
            return this.createMergeResult(remote, 'role_based_priority', 0.6);
          }
        }

        return this.createMergeResult(maxProgress, 'max_value_wins', 0.9);
      }

      // Strategy 2: Same percentage - merge metadata
      const merged: ProgressUpdate = {
        ...local,
        verified: local.verified || remote.verified,
        milestone: local.milestone || remote.milestone,
        timestamp: Math.max(local.timestamp, remote.timestamp),
      };

      return this.createMergeResult(merged, 'crdt_merge', 0.95);
    } catch (error) {
      logger.error('Progress percentage merge failed', {
        error,
        local,
        remote,
      });
      return this.createMergeResult(local, 'last_writer_wins', 0.5);
    }
  }

  async mergeFiberSectionState(
    local: FiberSectionState,
    remote: FiberSectionState,
    metadata: ConflictMetadata
  ): Promise<CRDTMergeResult> {
    try {
      logger.debug('Merging fiber section state', { local, remote, metadata });

      // Strategy 1: State machine validation
      const localStateOrder = this.getStateOrder(local.status);
      const remoteStateOrder = this.getStateOrder(remote.status);

      // Use the more advanced state (higher order)
      if (localStateOrder !== remoteStateOrder) {
        const advancedState =
          localStateOrder > remoteStateOrder ? local : remote;
        return this.createMergeResult(advancedState, 'max_value_wins', 0.85);
      }

      // Strategy 2: Same state - merge other properties
      const mergedProgress = await this.mergeProgressPercentages(
        local.progress,
        remote.progress,
        metadata
      );

      const mergedLocation = await this.mergeGeoCoordinates(
        local.location,
        remote.location,
        metadata
      );

      const merged: FiberSectionState = {
        ...local,
        progress: mergedProgress.mergedValue as ProgressUpdate,
        location: mergedLocation.mergedValue as GeoPoint,
        lastModified: Math.max(local.lastModified, remote.lastModified),
        modifiedBy:
          local.lastModified > remote.lastModified
            ? local.modifiedBy
            : remote.modifiedBy,
      };

      return this.createMergeResult(merged, 'crdt_merge', 0.9);
    } catch (error) {
      logger.error('Fiber section state merge failed', {
        error,
        local,
        remote,
      });
      return this.createMergeResult(local, 'last_writer_wins', 0.5);
    }
  }

  // Helper methods
  private createMergeResult(
    mergedValue: unknown,
    strategy: ResolutionStrategy,
    confidence: number
  ): CRDTMergeResult {
    return {
      mergedValue,
      conflicts: [], // No conflicts if successfully merged
      confidence,
      strategy,
    };
  }

  private calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    // Haversine formula
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private averageCoordinates(point1: GeoPoint, point2: GeoPoint): GeoPoint {
    return {
      latitude: (point1.latitude + point2.latitude) / 2,
      longitude: (point1.longitude + point2.longitude) / 2,
      accuracy: Math.min(point1.accuracy || 10, point2.accuracy || 10),
      timestamp: Math.max(point1.timestamp, point2.timestamp),
      source: `merged_${point1.source}_${point2.source}`,
    };
  }

  private hasHigherPriority(
    user1: string,
    user2: string,
    metadata: ConflictMetadata
  ): boolean {
    // In a real implementation, you'd look up user roles
    // For now, use a simple heuristic based on user ID or metadata

    // If we have role information in metadata
    if (metadata.source === 'authoritative') {
      return false; // Remote is authoritative
    }

    // Default to local having priority (optimistic updates)
    return true;
  }

  private getStateOrder(status: string): number {
    const stateOrder: Record<string, number> = {
      planned: 0,
      started: 1,
      in_progress: 2,
      completed: 3,
      failed: -1, // Special case - can transition back
    };

    return stateOrder[status] ?? 0;
  }

  // Advanced CRDT operations for future enhancement
  private createVectorClock(
    userId: string,
    timestamp: number
  ): Record<string, number> {
    return { [userId]: timestamp };
  }

  private mergeVectorClocks(
    clock1: Record<string, number>,
    clock2: Record<string, number>
  ): Record<string, number> {
    const merged = { ...clock1 };

    for (const [userId, timestamp] of Object.entries(clock2)) {
      merged[userId] = Math.max(merged[userId] || 0, timestamp);
    }

    return merged;
  }

  private compareVectorClocks(
    clock1: Record<string, number>,
    clock2: Record<string, number>
  ): 'before' | 'after' | 'concurrent' {
    let clock1Ahead = false;
    let clock2Ahead = false;

    const allUsers = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    for (const userId of allUsers) {
      const time1 = clock1[userId] || 0;
      const time2 = clock2[userId] || 0;

      if (time1 > time2) clock1Ahead = true;
      if (time2 > time1) clock2Ahead = true;
    }

    if (clock1Ahead && !clock2Ahead) return 'after';
    if (clock2Ahead && !clock1Ahead) return 'before';
    return 'concurrent';
  }

  // Rural connectivity optimizations
  private shouldUseOfflineMode(metadata: ConflictMetadata): boolean {
    return (
      metadata.connectionQuality === 'poor' ||
      metadata.connectionQuality === 'offline' ||
      this.config.lowConnectivityMode
    );
  }

  private applyOfflineOptimizations(
    local: unknown,
    remote: unknown,
    metadata: ConflictMetadata
  ): unknown {
    // In offline mode, prefer local changes (optimistic updates)
    if (this.shouldUseOfflineMode(metadata)) {
      logger.debug('Applying offline optimizations - preferring local state');
      return local;
    }

    return remote;
  }
}
