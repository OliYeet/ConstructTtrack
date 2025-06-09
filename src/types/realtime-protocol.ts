/**
 * ConstructTrack Real-time Protocol v1.alpha
 *
 * Defines message shapes and event types for real-time communication
 * in fiber installation workflows.
 *
 * Based on strategic plan by @charlie (LUM-582)
 */

// Protocol Version
export const PROTOCOL_VERSION = 'v1.alpha' as const;

/**
 * All allowed event type literals for the v1.alpha protocol.
 * Keeping the list in a single readonly tuple guarantees
 * compile-time exhaustiveness and enables fast runtime validation.
 */
export const EVENT_TYPES = [
  'FiberSectionStarted',
  'CablePulled',
  'SpliceCompleted',
  'InspectionPassed',
  'SectionClosed',
  'WorkOrderUpdated',
  'FiberSectionProgress',
  // Error events for Phase 2
  'FiberSectionFailed',
  'SpliceFailed',
  'InspectionFailed',
] as const;

/** Union of every event `type` literal. */
export type EventType = (typeof EVENT_TYPES)[number];

// Base Event Structure
export interface BaseEvent {
  id: string;
  type: EventType;
  version: typeof PROTOCOL_VERSION;
  timestamp: string; // ISO 8601
  workOrderId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

// Fiber Installation Domain Events
export interface FiberSectionStartedEvent extends BaseEvent {
  type: 'FiberSectionStarted';
  payload: {
    sectionId: string;
    startLocation: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    estimatedLength: number; // meters
    assignedTechnician: string;
    plannedCompletionTime: string; // ISO 8601
  };
}

export interface CablePulledEvent extends BaseEvent {
  type: 'CablePulled';
  payload: {
    sectionId: string;
    cableType: 'fiber' | 'coax' | 'copper';
    lengthPulled: number; // meters
    currentLocation: {
      latitude: number;
      longitude: number;
    };
    progressPercentage: number; // 0-100
  };
}

export interface SpliceCompletedEvent extends BaseEvent {
  type: 'SpliceCompleted';
  payload: {
    sectionId: string;
    spliceId: string;
    spliceLocation: {
      latitude: number;
      longitude: number;
    };
    spliceType: 'fusion' | 'mechanical';
    fiberCount: number;
    testResults: {
      loss: number; // dB
      reflectance: number; // dB
      passed: boolean;
    };
  };
}

export interface InspectionPassedEvent extends BaseEvent {
  type: 'InspectionPassed';
  payload: {
    sectionId: string;
    inspectionType: 'visual' | 'optical' | 'electrical';
    inspector: string;
    results: {
      passed: boolean;
      notes?: string;
      photos?: string[]; // URLs
    };
  };
}

export interface SectionClosedEvent extends BaseEvent {
  type: 'SectionClosed';
  payload: {
    sectionId: string;
    completionTime: string; // ISO 8601
    finalLocation: {
      latitude: number;
      longitude: number;
    };
    totalLength: number; // meters
    qualityScore: number; // 0-100
    documentation: {
      photos: string[]; // URLs
      reports: string[]; // URLs
      customerSignature?: string; // URL
    };
  };
}

export interface WorkOrderUpdatedEvent extends BaseEvent {
  type: 'WorkOrderUpdated';
  payload: {
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    estimatedCompletion?: string; // ISO 8601
    assignedTeam?: string[];
    notes?: string;
  };
}

export interface FiberSectionProgressEvent extends BaseEvent {
  type: 'FiberSectionProgress';
  payload: {
    sectionId: string;
    overallProgress: number; // 0-100
    currentPhase:
      | 'planning'
      | 'pulling'
      | 'splicing'
      | 'testing'
      | 'documentation';
    location: {
      latitude: number;
      longitude: number;
    };
    estimatedTimeRemaining: number; // minutes
  };
}

// Error Events for Phase 2
export interface FiberSectionFailedEvent extends BaseEvent {
  type: 'FiberSectionFailed';
  payload: {
    sectionId: string;
    failureReason: string;
    failureLocation?: {
      latitude: number;
      longitude: number;
    };
    errorCode: string;
    recoveryActions?: string[];
  };
}

export interface SpliceFailedEvent extends BaseEvent {
  type: 'SpliceFailed';
  payload: {
    sectionId: string;
    spliceId: string;
    failureReason: string;
    testResults?: {
      loss: number; // dB
      reflectance: number; // dB
      passed: false;
    };
    retryAttempts: number;
  };
}

export interface InspectionFailedEvent extends BaseEvent {
  type: 'InspectionFailed';
  payload: {
    sectionId: string;
    inspectionType: 'visual' | 'optical' | 'electrical';
    inspector: string;
    failureReasons: string[];
    requiredActions: string[];
    photos?: string[]; // URLs
  };
}

// Union type for all events
export type RealtimeEvent =
  | FiberSectionStartedEvent
  | CablePulledEvent
  | SpliceCompletedEvent
  | InspectionPassedEvent
  | SectionClosedEvent
  | WorkOrderUpdatedEvent
  | FiberSectionProgressEvent
  | FiberSectionFailedEvent
  | SpliceFailedEvent
  | InspectionFailedEvent;

// WebSocket Message Envelope - Discriminated Union for Type Safety
export type WebSocketMessage =
  | {
      messageId: string;
      timestamp: string; // ISO 8601
      type: 'event';
      payload: RealtimeEvent;
    }
  | {
      messageId: string;
      timestamp: string; // ISO 8601
      type: 'command';
      payload: WebSocketCommand;
    }
  | {
      messageId: string;
      timestamp: string; // ISO 8601
      type: 'query';
      payload: WebSocketQuery;
    }
  | {
      messageId: string;
      timestamp: string; // ISO 8601
      type: 'error';
      payload: WebSocketError;
    };

// WebSocket Commands (client -> server)
export interface WebSocketCommand {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  payload: {
    channels?: string[]; // e.g., ['workOrder:123', 'section:456']
    filters?: Record<string, unknown>;
  };
}

// WebSocket Queries (client -> server)
export interface WebSocketQuery {
  type: 'getHistory' | 'getStatus';
  payload: {
    entityId: string;
    entityType: 'workOrder' | 'section';
    since?: string; // ISO 8601
    limit?: number;
  };
}

// WebSocket Errors
export interface WebSocketError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Channel Subscription Patterns
export const CHANNEL_PATTERNS = {
  WORK_ORDER: (workOrderId: string) => `workOrder:${workOrderId}`,
  SECTION: (sectionId: string) => `section:${sectionId}`,
  USER: (userId: string) => `user:${userId}`,
  TEAM: (teamId: string) => `team:${teamId}`,
  GLOBAL: 'global',
} as const;

// Enhanced Validation Utilities
export const isValidISO8601 = (timestamp: string): boolean => {
  try {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && timestamp === date.toISOString();
  } catch {
    return false;
  }
};

export const validateEventPayload = (event: RealtimeEvent): boolean => {
  switch (event.type) {
    case 'CablePulled':
      return (
        event.payload.progressPercentage >= 0 &&
        event.payload.progressPercentage <= 100
      );
    case 'SpliceCompleted':
      return (
        event.payload.testResults.loss >= 0 &&
        event.payload.testResults.reflectance >= 0
      );
    case 'SectionClosed':
      return (
        event.payload.qualityScore >= 0 && event.payload.qualityScore <= 100
      );
    case 'FiberSectionProgress':
      return (
        event.payload.overallProgress >= 0 &&
        event.payload.overallProgress <= 100 &&
        event.payload.estimatedTimeRemaining >= 0
      );
    default:
      return true; // Other events don't have specific validation rules yet
  }
};

// Event Type Guards
export const isRealtimeEvent = (obj: unknown): obj is RealtimeEvent => {
  if (typeof obj !== 'object' || obj === null) return false;

  const candidate = obj as Record<string, unknown>;

  // Validate mandatory base fields and their types
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.type !== 'string' ||
    typeof candidate.version !== 'string' ||
    typeof candidate.timestamp !== 'string' ||
    typeof candidate.workOrderId !== 'string' ||
    typeof candidate.userId !== 'string'
  ) {
    return false;
  }

  // Enhanced timestamp validation
  if (!isValidISO8601(candidate.timestamp)) return false;

  // Ensure protocol version and event type are recognised
  if (candidate.version !== PROTOCOL_VERSION) return false;
  if (!EVENT_TYPES.includes(candidate.type as EventType)) return false;

  return true;
};

export const isFiberSectionStartedEvent = (
  event: RealtimeEvent
): event is FiberSectionStartedEvent => {
  return event.type === 'FiberSectionStarted';
};

export const isCablePulledEvent = (
  event: RealtimeEvent
): event is CablePulledEvent => {
  return event.type === 'CablePulled';
};

export const isSpliceCompletedEvent = (
  event: RealtimeEvent
): event is SpliceCompletedEvent => {
  return event.type === 'SpliceCompleted';
};

export const isInspectionPassedEvent = (
  event: RealtimeEvent
): event is InspectionPassedEvent => {
  return event.type === 'InspectionPassed';
};

export const isSectionClosedEvent = (
  event: RealtimeEvent
): event is SectionClosedEvent => {
  return event.type === 'SectionClosed';
};

export const isWorkOrderUpdatedEvent = (
  event: RealtimeEvent
): event is WorkOrderUpdatedEvent => {
  return event.type === 'WorkOrderUpdated';
};

export const isFiberSectionProgressEvent = (
  event: RealtimeEvent
): event is FiberSectionProgressEvent => {
  return event.type === 'FiberSectionProgress';
};

// Error Event Type Guards
export const isFiberSectionFailedEvent = (
  event: RealtimeEvent
): event is FiberSectionFailedEvent => {
  return event.type === 'FiberSectionFailed';
};

export const isSpliceFailedEvent = (
  event: RealtimeEvent
): event is SpliceFailedEvent => {
  return event.type === 'SpliceFailed';
};

export const isInspectionFailedEvent = (
  event: RealtimeEvent
): event is InspectionFailedEvent => {
  return event.type === 'InspectionFailed';
};
