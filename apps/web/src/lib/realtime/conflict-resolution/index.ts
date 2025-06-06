/**
 * Real-time Conflict Resolution - Main Export
 *
 * Comprehensive conflict resolution system for ConstructTrack's fiber installation workflows.
 * Provides CRDT-style merge algorithms, optimistic update reconciliation, and rural connectivity optimizations.
 */

// Core implementations
export { RealtimeConflictDetector } from './conflict-detector';
export { RealtimeCRDTMerger } from './crdt-merger';
export { RealtimeOptimisticReconciler } from './optimistic-reconciler';

// Types and interfaces
export type {
  // Core types
  Conflict,
  ConflictMetadata,
  ConflictResolution,
  ConflictResolutionConfig,

  // Data types
  GeoPoint,
  ProgressUpdate,
  FiberSectionState,

  // CRDT types
  CRDTState,
  CRDTMergeResult,

  // Optimistic update types
  OptimisticUpdate,
  ReconciliationResult,

  // Strategy types
  ResolutionStrategy,

  // Interface types
  ConflictDetector,
  CRDTMerger,
  OptimisticReconciler,

  // Event types
  RealtimeEvent,

  // Error types
  ConflictResolutionError,
  CRDTMergeError,
} from './types';

// Default configuration
export { DEFAULT_CONFLICT_RESOLUTION_CONFIG } from './types';

import { logger } from '../../logging';

import { RealtimeConflictDetector } from './conflict-detector';
import { RealtimeCRDTMerger } from './crdt-merger';
import { RealtimeOptimisticReconciler } from './optimistic-reconciler';
import type {
  ConflictResolutionConfig,
  ConflictMetadata,
  OptimisticUpdate,
  ReconciliationResult,
} from './types';
import { DEFAULT_CONFLICT_RESOLUTION_CONFIG } from './types';

/**
 * Main Conflict Resolution Manager
 *
 * Orchestrates conflict detection, CRDT merging, and optimistic reconciliation
 * for real-time fiber installation workflows.
 */
export class ConflictResolutionManager {
  private detector: RealtimeConflictDetector;
  private merger: RealtimeCRDTMerger;
  private reconciler: RealtimeOptimisticReconciler;
  private config: ConflictResolutionConfig;
  private isInitialized = false;

  constructor(config: Partial<ConflictResolutionConfig> = {}) {
    this.config = { ...DEFAULT_CONFLICT_RESOLUTION_CONFIG, ...config };
    this.detector = new RealtimeConflictDetector(this.config);
    this.merger = new RealtimeCRDTMerger(this.config);
    this.reconciler = new RealtimeOptimisticReconciler(this.config);
  }

  /**
   * Initialize the conflict resolution system
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing conflict resolution system', {
        config: this.config,
      });

      // Perform any necessary setup
      await this.validateConfiguration();

      this.isInitialized = true;
      logger.info('Conflict resolution system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize conflict resolution system', {
        error,
      });
      throw error;
    }
  }

  /**
   * Shutdown the conflict resolution system
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down conflict resolution system');

      // Clean up any pending operations
      await this.reconciler.rollbackOptimisticUpdates(
        this.reconciler.getPendingUpdates().map(u => u.id)
      );

      this.isInitialized = false;
      logger.info('Conflict resolution system shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown conflict resolution system', { error });
      throw error;
    }
  }

  /**
   * Apply an optimistic update
   */
  async applyOptimisticUpdate(update: OptimisticUpdate): Promise<void> {
    this.ensureInitialized();
    return this.reconciler.applyOptimisticUpdate(update);
  }

  /**
   * Reconcile with authoritative state
   */
  async reconcileWithAuthoritative(
    authoritativeState: unknown,
    _metadata: ConflictMetadata
  ): Promise<ReconciliationResult> {
    this.ensureInitialized();

    const pendingUpdates = this.reconciler.getPendingUpdates();
    return this.reconciler.reconcileWithAuthoritative(
      authoritativeState,
      pendingUpdates
    );
  }

  /**
   * Get current system status
   */
  getStatus(): {
    initialized: boolean;
    pendingUpdates: number;
    config: ConflictResolutionConfig;
  } {
    return {
      initialized: this.isInitialized,
      pendingUpdates: this.reconciler.getUpdateCount(),
      config: this.config,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConflictResolutionConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Recreate components with new config
    this.detector = new RealtimeConflictDetector(this.config);
    this.merger = new RealtimeCRDTMerger(this.config);
    this.reconciler = new RealtimeOptimisticReconciler(this.config);

    logger.info('Conflict resolution configuration updated', {
      config: this.config,
    });
  }

  /**
   * Get pending optimistic updates
   */
  getPendingUpdates(): OptimisticUpdate[] {
    return this.reconciler.getPendingUpdates();
  }

  /**
   * Clear confirmed updates
   */
  clearConfirmedUpdates(): void {
    this.reconciler.clearConfirmedUpdates();
  }

  // Private helper methods
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        'Conflict resolution system not initialized. Call initialize() first.'
      );
    }
  }

  private async validateConfiguration(): Promise<void> {
    // Validate configuration values
    if (this.config.maxDistanceThreshold <= 0) {
      throw new Error('maxDistanceThreshold must be positive');
    }

    if (this.config.conflictDetectionTimeout <= 0) {
      throw new Error('conflictDetectionTimeout must be positive');
    }

    if (this.config.resolutionTimeout <= 0) {
      throw new Error('resolutionTimeout must be positive');
    }

    logger.debug('Configuration validation passed');
  }
}

/**
 * Singleton instance for global use
 */
let globalConflictResolutionManager: ConflictResolutionManager | null = null;

/**
 * Get or create the global conflict resolution manager
 */
export function getConflictResolutionManager(
  config?: Partial<ConflictResolutionConfig>
): ConflictResolutionManager {
  if (!globalConflictResolutionManager) {
    globalConflictResolutionManager = new ConflictResolutionManager(config);
  }

  return globalConflictResolutionManager;
}

/**
 * Initialize the global conflict resolution system
 */
export async function initializeConflictResolution(
  config?: Partial<ConflictResolutionConfig>
): Promise<ConflictResolutionManager> {
  const manager = getConflictResolutionManager(config);
  await manager.initialize();
  return manager;
}

/**
 * Shutdown the global conflict resolution system
 */
export async function shutdownConflictResolution(): Promise<void> {
  if (globalConflictResolutionManager) {
    await globalConflictResolutionManager.shutdown();
    globalConflictResolutionManager = null;
  }
}

// Convenience exports for common operations
export const ConflictResolution = {
  // Initialize system
  initialize: initializeConflictResolution,
  shutdown: shutdownConflictResolution,

  // Get manager instance
  getManager: getConflictResolutionManager,

  // Quick access to components
  createDetector: (config?: Partial<ConflictResolutionConfig>) =>
    new RealtimeConflictDetector(config),
  createMerger: (config?: Partial<ConflictResolutionConfig>) =>
    new RealtimeCRDTMerger(config),
  createReconciler: (config?: Partial<ConflictResolutionConfig>) =>
    new RealtimeOptimisticReconciler(config),
};

// Default export
export default ConflictResolution;
