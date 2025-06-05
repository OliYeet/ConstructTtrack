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

// Union type for all events
export type RealtimeEvent =
  | FiberSectionStartedEvent
  | CablePulledEvent
  | SpliceCompletedEvent
  | InspectionPassedEvent
  | SectionClosedEvent
  | WorkOrderUpdatedEvent
  | FiberSectionProgressEvent;

// WebSocket Message Envelope
export interface WebSocketMessage {
  messageId: string;
  timestamp: string; // ISO 8601
  type: 'event' | 'command' | 'query' | 'error';
  payload: RealtimeEvent | WebSocketCommand | WebSocketQuery | WebSocketError;
}

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

// Add more type guards as needed...
