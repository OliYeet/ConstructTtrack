/**
 * Conflict Detection System
 *
 * Identifies concurrent update conflicts in real-time fiber installation workflows.
 * Focuses on geo-coordinates, progress percentages, and state transitions.
 */

import { logger } from '../../logging';

import type {
  Conflict,
  ConflictDetector,
  ConflictMetadata,
  ConflictResolutionConfig,
  FiberSectionState,
  GeoPoint,
  OptimisticUpdate,
  ProgressUpdate,
  RealtimeEvent,
  DEFAULT_CONFLICT_RESOLUTION_CONFIG,
} from './types';

export class RealtimeConflictDetector implements ConflictDetector {
  private config: ConflictResolutionConfig;

  constructor(config: Partial<ConflictResolutionConfig> = {}) {
    this.config = { ...DEFAULT_CONFLICT_RESOLUTION_CONFIG, ...config };
  }

  async detectConflicts(
    localState: unknown,
    remoteEvents: RealtimeEvent[],
    metadata: ConflictMetadata
  ): Promise<Conflict[]> {
    const startTime = Date.now();
    const conflicts: Conflict[] = [];

    try {
      // Group events by type for efficient processing
      const eventsByType = this.groupEventsByType(remoteEvents);

      // Detect geo-coordinate conflicts
      if (this.isGeoPoint(localState)) {
        const geoConflicts = await this.detectGeoConflicts(
          localState,
          eventsByType,
          metadata
        );
        conflicts.push(...geoConflicts);
      }

      // Detect progress percentage conflicts
      if (this.isProgressUpdate(localState)) {
        const progressConflicts = await this.detectProgressConflicts(
          localState,
          eventsByType,
          metadata
        );
        conflicts.push(...progressConflicts);
      }

      // Detect state transition conflicts
      if (this.isFiberSectionState(localState)) {
        const stateConflicts = await this.detectStateConflicts(
          localState,
          eventsByType,
          metadata
        );
        conflicts.push(...stateConflicts);
      }

      // Check for timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.conflictDetectionTimeout) {
        logger.warn('Conflict detection timeout exceeded', {
          elapsed,
          threshold: this.config.conflictDetectionTimeout,
          conflictsFound: conflicts.length,
        });
      }

      logger.debug('Conflict detection completed', {
        conflictsFound: conflicts.length,
        elapsed,
        metadata,
      });

      return conflicts;
    } catch (error) {
      logger.error('Conflict detection failed', { error, metadata });
      throw error;
    }
  }

  async validateUpdate(
    update: OptimisticUpdate,
    currentState: unknown
  ): Promise<boolean> {
    try {
      // Basic validation rules
      if (!update.id || !update.type || !update.userId) {
        return false;
      }

      // Validate based on update type
      switch (update.type) {
        case 'FiberSectionProgress':
          return this.validateProgressUpdate(update, currentState);
        case 'FiberSectionStarted':
        case 'CablePulled':
        case 'SpliceCompleted':
          return this.validateGeoUpdate(update, currentState);
        default:
          return true; // Allow unknown types for now
      }
    } catch (error) {
      logger.error('Update validation failed', { error, update });
      return false;
    }
  }

  private groupEventsByType(
    events: RealtimeEvent[]
  ): Map<string, RealtimeEvent[]> {
    const grouped = new Map<string, RealtimeEvent[]>();

    for (const event of events) {
      const existing = grouped.get(event.type) || [];
      existing.push(event);
      grouped.set(event.type, existing);
    }

    return grouped;
  }

  private async detectGeoConflicts(
    localGeo: GeoPoint,
    eventsByType: Map<string, RealtimeEvent[]>,
    metadata: ConflictMetadata
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const geoEvents = [
      ...(eventsByType.get('FiberSectionStarted') || []),
      ...(eventsByType.get('CablePulled') || []),
      ...(eventsByType.get('SpliceCompleted') || []),
    ];

    for (const event of geoEvents) {
      const remoteGeo = this.extractGeoFromEvent(event);
      if (!remoteGeo) continue;

      // Check for distance-based conflicts
      const distance = this.calculateDistance(localGeo, remoteGeo);
      if (distance > this.config.maxDistanceThreshold) {
        conflicts.push({
          id: `geo_${event.id}_${Date.now()}`,
          type: 'geo_coordinate',
          severity:
            distance > this.config.maxDistanceThreshold * 2 ? 'high' : 'medium',
          localValue: localGeo,
          remoteValue: remoteGeo,
          metadata,
          detectedAt: Date.now(),
          autoResolvable: distance < this.config.maxDistanceThreshold * 1.5,
        });
      }

      // Check for timestamp-based conflicts (concurrent updates)
      const timeDiff = Math.abs(localGeo.timestamp - remoteGeo.timestamp);
      if (timeDiff < 5000 && localGeo.source !== remoteGeo.source) {
        // 5 second window
        conflicts.push({
          id: `concurrent_geo_${event.id}_${Date.now()}`,
          type: 'concurrent_update',
          severity: 'medium',
          localValue: localGeo,
          remoteValue: remoteGeo,
          metadata,
          detectedAt: Date.now(),
          autoResolvable: true,
        });
      }
    }

    return conflicts;
  }

  private async detectProgressConflicts(
    localProgress: ProgressUpdate,
    eventsByType: Map<string, RealtimeEvent[]>,
    metadata: ConflictMetadata
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const progressEvents = eventsByType.get('FiberSectionProgress') || [];

    for (const event of progressEvents) {
      const remoteProgress = this.extractProgressFromEvent(event);
      if (!remoteProgress) continue;

      // Check for progress decrease (usually not allowed)
      if (
        !this.config.allowProgressDecrease &&
        remoteProgress.percentage < localProgress.percentage
      ) {
        conflicts.push({
          id: `progress_decrease_${event.id}_${Date.now()}`,
          type: 'progress_percentage',
          severity: 'high',
          localValue: localProgress,
          remoteValue: remoteProgress,
          metadata,
          detectedAt: Date.now(),
          autoResolvable: false,
        });
      }

      // Check for large progress jumps
      const progressDiff = Math.abs(
        remoteProgress.percentage - localProgress.percentage
      );
      if (progressDiff > this.config.maxProgressJump) {
        conflicts.push({
          id: `progress_jump_${event.id}_${Date.now()}`,
          type: 'progress_percentage',
          severity: 'medium',
          localValue: localProgress,
          remoteValue: remoteProgress,
          metadata,
          detectedAt: Date.now(),
          autoResolvable: true,
        });
      }
    }

    return conflicts;
  }

  private async detectStateConflicts(
    localState: FiberSectionState,
    eventsByType: Map<string, RealtimeEvent[]>,
    metadata: ConflictMetadata
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const stateEvents = [
      ...(eventsByType.get('FiberSectionStarted') || []),
      ...(eventsByType.get('SectionClosed') || []),
      ...(eventsByType.get('FiberSectionFailed') || []),
    ];

    for (const event of stateEvents) {
      const remoteState = this.extractStateFromEvent(event);
      if (!remoteState) continue;

      // Check for invalid state transitions
      if (!this.isValidStateTransition(localState.status, remoteState.status)) {
        conflicts.push({
          id: `state_transition_${event.id}_${Date.now()}`,
          type: 'state_transition',
          severity: 'high',
          localValue: localState,
          remoteValue: remoteState,
          metadata,
          detectedAt: Date.now(),
          autoResolvable: false,
        });
      }
    }

    return conflicts;
  }

  // Helper methods
  private isGeoPoint(value: unknown): value is GeoPoint {
    return (
      typeof value === 'object' &&
      value !== null &&
      'latitude' in value &&
      'longitude' in value &&
      'timestamp' in value
    );
  }

  private isProgressUpdate(value: unknown): value is ProgressUpdate {
    return (
      typeof value === 'object' &&
      value !== null &&
      'percentage' in value &&
      'timestamp' in value &&
      'userId' in value
    );
  }

  private isFiberSectionState(value: unknown): value is FiberSectionState {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'status' in value &&
      'progress' in value
    );
  }

  private extractGeoFromEvent(event: RealtimeEvent): GeoPoint | null {
    // Extract geo coordinates from event payload
    const payload = event.payload as Record<string, unknown>;
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
        timestamp: event.timestamp,
        source: event.userId,
      };
    }
    return null;
  }

  private extractProgressFromEvent(
    event: RealtimeEvent
  ): ProgressUpdate | null {
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload?.progress === 'number') {
      return {
        percentage: payload.progress,
        milestone:
          typeof payload.milestone === 'string' ? payload.milestone : undefined,
        timestamp: event.timestamp,
        userId: event.userId,
        verified: Boolean(payload.verified),
      };
    }
    return null;
  }

  private extractStateFromEvent(
    event: RealtimeEvent
  ): Partial<FiberSectionState> | null {
    const payload = event.payload as Record<string, unknown>;
    return {
      status: payload?.status,
      lastModified: event.timestamp,
      modifiedBy: event.userId,
    };
  }

  private calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    // Haversine formula for distance calculation
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

  private validateProgressUpdate(
    update: OptimisticUpdate,
    _currentState: unknown
  ): boolean {
    const payload = update.localValue as Record<string, unknown>;
    if (typeof payload?.percentage !== 'number') return false;

    return payload.percentage >= 0 && payload.percentage <= 100;
  }

  private validateGeoUpdate(
    update: OptimisticUpdate,
    _currentState: unknown
  ): boolean {
    const payload = update.localValue as Record<string, unknown>;
    const location = (payload?.location || payload?.startLocation) as
      | Record<string, unknown>
      | undefined;

    if (!location) return false;

    return (
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      Math.abs(location.latitude) <= 90 &&
      Math.abs(location.longitude) <= 180
    );
  }

  private isValidStateTransition(from: string, to: string): boolean {
    const validTransitions: Record<string, string[]> = {
      planned: ['started'],
      started: ['in_progress', 'failed'],
      in_progress: ['completed', 'failed'],
      completed: [], // Terminal state
      failed: ['started'], // Can restart
    };

    return validTransitions[from]?.includes(to) || false;
  }
}
