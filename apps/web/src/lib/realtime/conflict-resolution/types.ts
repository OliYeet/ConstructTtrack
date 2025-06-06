/**
 * Real-time Conflict Resolution Types
 *
 * TypeScript interfaces and types for conflict detection and resolution
 * in ConstructTrack's fiber installation workflows.
 */

import type { EventType } from '../../../../../src/types/realtime-protocol';

// Core conflict resolution types
export interface ConflictMetadata {
  userId: string;
  organizationId: string;
  workOrderId: string;
  sectionId?: string;
  timestamp: number;
  source: 'local' | 'remote' | 'authoritative';
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'offline';
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
  timestamp: number;
  source: string; // user ID or system
}

export interface ProgressUpdate {
  percentage: number;
  milestone?: string;
  timestamp: number;
  userId: string;
  verified: boolean;
}

export interface FiberSectionState {
  id: string;
  status: 'planned' | 'started' | 'in_progress' | 'completed' | 'failed';
  progress: ProgressUpdate;
  location: GeoPoint;
  lastModified: number;
  modifiedBy: string;
}

// Conflict detection types
export interface Conflict {
  id: string;
  type:
    | 'geo_coordinate'
    | 'progress_percentage'
    | 'state_transition'
    | 'concurrent_update';
  severity: 'low' | 'medium' | 'high' | 'critical';
  localValue: unknown;
  remoteValue: unknown;
  metadata: ConflictMetadata;
  detectedAt: number;
  autoResolvable: boolean;
}

export interface ConflictResolution {
  conflictId: string;
  strategy: ResolutionStrategy;
  resolvedValue: unknown;
  confidence: number; // 0-1
  appliedAt: number;
  appliedBy: string; // user ID or 'system'
  rollbackPossible: boolean;
}

export type ResolutionStrategy =
  | 'last_writer_wins'
  | 'max_value_wins'
  | 'distance_validation'
  | 'role_based_priority'
  | 'manual_resolution'
  | 'crdt_merge';

// CRDT (Conflict-free Replicated Data Type) interfaces
export interface CRDTState {
  value: unknown;
  vectorClock: Record<string, number>;
  timestamp: number;
}

export interface CRDTMergeResult {
  mergedValue: unknown;
  conflicts: Conflict[];
  confidence: number;
  strategy: ResolutionStrategy;
}

// Optimistic update types
export interface OptimisticUpdate {
  id: string;
  type: EventType;
  localValue: unknown;
  appliedAt: number;
  userId: string;
  rollbackData?: unknown;
  confirmed: boolean;
}

export interface ReconciliationResult {
  success: boolean;
  conflictsDetected: Conflict[];
  conflictsResolved: ConflictResolution[];
  rollbacksRequired: string[]; // optimistic update IDs
  finalState: unknown;
}

// Integration interfaces
export interface ConflictDetector {
  detectConflicts(
    localState: unknown,
    remoteEvents: RealtimeEvent[],
    metadata: ConflictMetadata
  ): Promise<Conflict[]>;

  validateUpdate(
    update: OptimisticUpdate,
    currentState: unknown
  ): Promise<boolean>;
}

export interface CRDTMerger {
  mergeGeoCoordinates(
    local: GeoPoint,
    remote: GeoPoint,
    metadata: ConflictMetadata
  ): Promise<CRDTMergeResult>;

  mergeProgressPercentages(
    local: ProgressUpdate,
    remote: ProgressUpdate,
    metadata: ConflictMetadata
  ): Promise<CRDTMergeResult>;

  mergeFiberSectionState(
    local: FiberSectionState,
    remote: FiberSectionState,
    metadata: ConflictMetadata
  ): Promise<CRDTMergeResult>;
}

export interface OptimisticReconciler {
  applyOptimisticUpdate(update: OptimisticUpdate): Promise<void>;

  reconcileWithAuthoritative(
    authoritativeState: unknown,
    pendingUpdates: OptimisticUpdate[]
  ): Promise<ReconciliationResult>;

  rollbackOptimisticUpdates(updateIds: string[]): Promise<void>;
}

// Event types for conflict resolution
export interface RealtimeEvent {
  id: string;
  type: EventType;
  payload: unknown;
  timestamp: number;
  userId: string;
  metadata?: Record<string, unknown>;
}

// Configuration types
export interface ConflictResolutionConfig {
  // Geo-coordinate conflict settings
  maxDistanceThreshold: number; // meters
  coordinateAccuracyThreshold: number; // meters

  // Progress conflict settings
  allowProgressDecrease: boolean;
  maxProgressJump: number; // percentage

  // Performance settings
  conflictDetectionTimeout: number; // ms
  resolutionTimeout: number; // ms
  maxConcurrentConflicts: number;

  // Rural connectivity settings
  offlineGracePeriod: number; // ms
  lowConnectivityMode: boolean;

  // Role-based priorities
  rolePriorities: Record<string, number>;
}

// Error types
export class ConflictResolutionError extends Error {
  constructor(
    message: string,
    public conflictId?: string,
    public strategy?: ResolutionStrategy,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ConflictResolutionError';
  }
}

export class CRDTMergeError extends Error {
  constructor(
    message: string,
    public localValue?: unknown,
    public remoteValue?: unknown,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'CRDTMergeError';
  }
}

// Default configuration
export const DEFAULT_CONFLICT_RESOLUTION_CONFIG: ConflictResolutionConfig = {
  maxDistanceThreshold: 100, // 100 meters
  coordinateAccuracyThreshold: 10, // 10 meters
  allowProgressDecrease: false,
  maxProgressJump: 25, // 25%
  conflictDetectionTimeout: 50, // 50ms
  resolutionTimeout: 100, // 100ms
  maxConcurrentConflicts: 10,
  offlineGracePeriod: 30000, // 30 seconds
  lowConnectivityMode: true,
  rolePriorities: {
    admin: 100,
    foreman: 80,
    technician: 60,
    observer: 20,
  },
};
