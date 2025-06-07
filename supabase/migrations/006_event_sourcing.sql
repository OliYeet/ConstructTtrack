-- Migration: Event Sourcing System
-- Description: Creates infrastructure for event sourcing and audit trail
-- Created: 2025-06-06
-- Task: LUM-588 - Implement event sourcing system

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create event sourcing table for real-time events
CREATE TABLE realtime_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE NOT NULL, -- From protocol BaseEvent.id
    event_type TEXT NOT NULL, -- FiberSectionStarted, CablePulled, etc.
    version TEXT NOT NULL DEFAULT 'v1.alpha',
    aggregate_id UUID NOT NULL, -- work_order_id or fiber_section_id
    aggregate_type TEXT NOT NULL, -- 'work_order' | 'fiber_section' | 'project'
    sequence_number BIGINT NOT NULL,
    event_data JSONB NOT NULL, -- Full RealtimeEvent payload
    metadata JSONB DEFAULT '{}',
    user_id UUID NOT NULL REFERENCES profiles(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Per-aggregate sequence numbers are handled by get_next_sequence_number() function
-- No global sequence needed as each aggregate maintains its own sequence

-- Add constraints and indexes for performance and data integrity
ALTER TABLE realtime_events ADD CONSTRAINT unique_aggregate_sequence 
    UNIQUE (aggregate_id, sequence_number);

-- Indexes for efficient querying (optimized to avoid redundancy)
CREATE INDEX idx_realtime_events_aggregate_type ON realtime_events(aggregate_type);
CREATE INDEX idx_realtime_events_event_type ON realtime_events(event_type);
CREATE INDEX idx_realtime_events_timestamp ON realtime_events(timestamp);
CREATE INDEX idx_realtime_events_organization_id ON realtime_events(organization_id);
CREATE INDEX idx_realtime_events_user_id ON realtime_events(user_id);

-- Composite indexes for common query patterns
-- Note: unique_aggregate_sequence constraint already covers (aggregate_id, sequence_number)
CREATE INDEX idx_realtime_events_type_timestamp ON realtime_events(event_type, timestamp);
CREATE INDEX idx_realtime_events_org_timestamp ON realtime_events(organization_id, timestamp);

-- Enable Row Level Security
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant security
CREATE POLICY "Users can view events from their organization" ON realtime_events
    FOR SELECT USING (organization_id = auth.user_organization_id());

CREATE POLICY "Users can insert events for their organization" ON realtime_events
    FOR INSERT WITH CHECK (
        organization_id = auth.user_organization_id() 
        AND user_id = auth.uid()
    );

-- Events are immutable - no updates or deletes allowed
CREATE POLICY "Events are immutable" ON realtime_events
    FOR UPDATE USING (false);

CREATE POLICY "Events cannot be deleted" ON realtime_events
    FOR DELETE USING (false);

-- Function to get next sequence number for an aggregate
-- Fixed: Added advisory locking to prevent race conditions even for new aggregates
CREATE OR REPLACE FUNCTION get_next_sequence_number(aggregate_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
    next_seq BIGINT;
    lock_key BIGINT;
BEGIN
    -- Create a deterministic lock key from the aggregate UUID using hashtext()
    lock_key := hashtext(aggregate_uuid::text);

    -- Take advisory lock on this aggregate to prevent concurrent sequence generation
    PERFORM pg_advisory_xact_lock(lock_key);

    -- Now safely compute next sequence number
    SELECT COALESCE(MAX(sequence_number), 0) + 1
    INTO next_seq
    FROM realtime_events
    WHERE aggregate_id = aggregate_uuid;

    RETURN next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to append events to the event store
CREATE OR REPLACE FUNCTION append_realtime_event(
    p_event_id TEXT,
    p_event_type TEXT,
    p_version TEXT,
    p_aggregate_id UUID,
    p_aggregate_type TEXT,
    p_event_data JSONB,
    p_metadata JSONB DEFAULT '{}',
    p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    event_uuid UUID;
    next_seq BIGINT;
BEGIN
    -- Get next sequence number for this aggregate
    next_seq := get_next_sequence_number(p_aggregate_id);
    
    -- Insert the event
    INSERT INTO realtime_events (
        event_id,
        event_type,
        version,
        aggregate_id,
        aggregate_type,
        sequence_number,
        event_data,
        metadata,
        user_id,
        organization_id,
        timestamp
    ) VALUES (
        p_event_id,
        p_event_type,
        p_version,
        p_aggregate_id,
        p_aggregate_type,
        next_seq,
        p_event_data,
        p_metadata,
        auth.uid(),
        auth.user_organization_id(),
        p_timestamp
    ) RETURNING id INTO event_uuid;
    
    RETURN event_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get events for an aggregate
CREATE OR REPLACE FUNCTION get_aggregate_events(
    aggregate_uuid UUID,
    from_sequence BIGINT DEFAULT 1
)
RETURNS TABLE (
    id UUID,
    event_id TEXT,
    event_type TEXT,
    version TEXT,
    sequence_number BIGINT,
    event_data JSONB,
    metadata JSONB,
    timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        re.id,
        re.event_id,
        re.event_type,
        re.version,
        re.sequence_number,
        re.event_data,
        re.metadata,
        re.timestamp
    FROM realtime_events re
    WHERE re.aggregate_id = aggregate_uuid
        AND re.sequence_number >= from_sequence
        AND re.organization_id = auth.user_organization_id()
    ORDER BY re.sequence_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get events by type with optional filters
CREATE OR REPLACE FUNCTION get_events_by_type(
    p_event_type TEXT,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0,
    p_from_timestamp TIMESTAMPTZ DEFAULT NULL,
    p_to_timestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    event_id TEXT,
    event_type TEXT,
    aggregate_id UUID,
    aggregate_type TEXT,
    sequence_number BIGINT,
    event_data JSONB,
    metadata JSONB,
    user_id UUID,
    timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        re.id,
        re.event_id,
        re.event_type,
        re.aggregate_id,
        re.aggregate_type,
        re.sequence_number,
        re.event_data,
        re.metadata,
        re.user_id,
        re.timestamp
    FROM realtime_events re
    WHERE re.event_type = p_event_type
        AND re.organization_id = auth.user_organization_id()
        AND (p_from_timestamp IS NULL OR re.timestamp >= p_from_timestamp)
        AND (p_to_timestamp IS NULL OR re.timestamp <= p_to_timestamp)
    ORDER BY re.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get event statistics
CREATE OR REPLACE FUNCTION get_event_statistics(
    p_from_timestamp TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    p_to_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    event_type TEXT,
    event_count BIGINT,
    unique_aggregates BIGINT,
    first_event TIMESTAMPTZ,
    last_event TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        re.event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT re.aggregate_id) as unique_aggregates,
        MIN(re.timestamp) as first_event,
        MAX(re.timestamp) as last_event
    FROM realtime_events re
    WHERE re.organization_id = auth.user_organization_id()
        AND re.timestamp >= p_from_timestamp
        AND re.timestamp <= p_to_timestamp
    GROUP BY re.event_type
    ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for event stream monitoring
CREATE OR REPLACE VIEW event_stream_summary AS
SELECT 
    re.event_type,
    re.aggregate_type,
    COUNT(*) as total_events,
    COUNT(DISTINCT re.aggregate_id) as unique_aggregates,
    COUNT(DISTINCT re.user_id) as unique_users,
    MIN(re.timestamp) as first_event,
    MAX(re.timestamp) as last_event,
    AVG(EXTRACT(EPOCH FROM (re.created_at - re.timestamp))) as avg_processing_delay_seconds
FROM realtime_events re
WHERE re.organization_id = auth.user_organization_id()
    AND re.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY re.event_type, re.aggregate_type
ORDER BY total_events DESC;

-- Add trigger to update migration tracking (idempotent)
INSERT INTO schema_migrations (
    filename,
    checksum,
    applied_at,
    applied_by,
    success,
    metadata
) VALUES (
    '006_event_sourcing.sql',
    'event-sourcing-v1',
    NOW(),
    current_user,
    true,
    '{"description": "Event sourcing system for real-time infrastructure", "task": "LUM-588"}'
) ON CONFLICT (filename) DO NOTHING;
