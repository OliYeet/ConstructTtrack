/**
 * Basic tests for event sourcing types
 */

import type { UUID, StoredEvent } from '../types';

describe('Event Sourcing Types', () => {
  it('should have UUID type alias', () => {
    const uuid: UUID = 'test-uuid-123';
    expect(typeof uuid).toBe('string');
  });

  it('should create StoredEvent with UUID id', () => {
    const event: Partial<StoredEvent> = {
      id: 'test-uuid-123' as UUID,
      eventId: 'event-123',
      eventType: 'FiberSectionStarted',
    };

    expect(event.id).toBe('test-uuid-123');
    expect(event.eventType).toBe('FiberSectionStarted');
  });
});
