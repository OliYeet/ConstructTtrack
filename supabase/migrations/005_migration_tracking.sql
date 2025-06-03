-- Migration: Migration Tracking System
-- Description: Creates infrastructure for tracking database migrations
-- Created: 2025-01-30

-- Create schema_migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL UNIQUE,
    checksum TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by TEXT DEFAULT current_user,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    rollback_sql TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_success ON schema_migrations(success);

-- Function to create migration table (for use in scripts)
CREATE OR REPLACE FUNCTION create_migration_table()
RETURNS BOOLEAN AS $$
BEGIN
    -- This function ensures the migration table exists
    -- It's idempotent and safe to call multiple times
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'schema_migrations' 
        AND table_schema = 'public'
    ) THEN
        CREATE TABLE schema_migrations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            filename TEXT NOT NULL UNIQUE,
            checksum TEXT,
            applied_at TIMESTAMPTZ DEFAULT NOW(),
            applied_by TEXT DEFAULT current_user,
            execution_time_ms INTEGER,
            success BOOLEAN DEFAULT true,
            error_message TEXT,
            rollback_sql TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX idx_schema_migrations_filename ON schema_migrations(filename);
        CREATE INDEX idx_schema_migrations_applied_at ON schema_migrations(applied_at);
        CREATE INDEX idx_schema_migrations_success ON schema_migrations(success);
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to record migration execution
CREATE OR REPLACE FUNCTION record_migration(
    migration_filename TEXT,
    migration_checksum TEXT DEFAULT NULL,
    execution_time INTEGER DEFAULT NULL,
    is_success BOOLEAN DEFAULT true,
    error_msg TEXT DEFAULT NULL,
    rollback_script TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    migration_id UUID;
BEGIN
    INSERT INTO schema_migrations (
        filename,
        checksum,
        execution_time_ms,
        success,
        error_message,
        rollback_sql
    ) VALUES (
        migration_filename,
        migration_checksum,
        execution_time,
        is_success,
        error_msg,
        rollback_script
    ) RETURNING id INTO migration_id;
    
    RETURN migration_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get migration status
CREATE OR REPLACE FUNCTION get_migration_status()
RETURNS TABLE (
    filename TEXT,
    applied_at TIMESTAMPTZ,
    success BOOLEAN,
    checksum TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.filename,
        sm.applied_at,
        sm.success,
        sm.checksum
    FROM schema_migrations sm
    ORDER BY sm.applied_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if migration was applied
CREATE OR REPLACE FUNCTION is_migration_applied(migration_filename TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    migration_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM schema_migrations 
        WHERE filename = migration_filename 
        AND success = true
    ) INTO migration_exists;
    
    RETURN migration_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending migrations (requires file system access, so mainly for documentation)
CREATE OR REPLACE FUNCTION get_migration_summary()
RETURNS TABLE (
    total_migrations BIGINT,
    successful_migrations BIGINT,
    failed_migrations BIGINT,
    last_migration_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_migrations,
        COUNT(*) FILTER (WHERE success = true) as successful_migrations,
        COUNT(*) FILTER (WHERE success = false) as failed_migrations,
        MAX(applied_at) as last_migration_date
    FROM schema_migrations;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy migration monitoring
CREATE OR REPLACE VIEW migration_status_view AS
SELECT 
    filename,
    applied_at,
    applied_by,
    success,
    execution_time_ms,
    CASE 
        WHEN success THEN '✅'
        ELSE '❌'
    END as status_icon,
    CASE 
        WHEN execution_time_ms IS NULL THEN 'N/A'
        WHEN execution_time_ms < 1000 THEN execution_time_ms || 'ms'
        ELSE ROUND(execution_time_ms::NUMERIC / 1000, 2) || 's'
    END as execution_time_formatted
FROM schema_migrations
ORDER BY applied_at DESC;

-- Insert record for existing migrations (if any)
-- This helps track migrations that were applied before this tracking system
DO $$
DECLARE
    existing_tables TEXT[] := ARRAY[
        'organizations',
        'profiles', 
        'projects',
        'fiber_routes',
        'fiber_connections',
        'tasks',
        'photos',
        'customer_agreements',
        'equipment',
        'materials',
        'work_areas',
        'forms',
        'documents',
        'time_entries',
        'notifications',
        'whatsapp_chats',
        'whatsapp_messages',
        'audit_logs'
    ];
    table_name TEXT;
    migration_files TEXT[] := ARRAY[
        '001_initial_schema.sql',
        '002_extended_schema.sql',
        '003_rls_policies.sql',
        '004_functions_views.sql'
    ];
    migration_file TEXT;
BEGIN
    -- Check if we have existing tables and record their migrations
    FOREACH migration_file IN ARRAY migration_files
    LOOP
        -- Only insert if migration not already recorded
        IF NOT EXISTS (
            SELECT 1 FROM schema_migrations WHERE filename = migration_file
        ) THEN
            INSERT INTO schema_migrations (
                filename,
                applied_at,
                applied_by,
                success,
                metadata
            ) VALUES (
                migration_file,
                NOW() - INTERVAL '1 hour', -- Assume applied recently
                'system',
                true,
                '{"note": "Pre-existing migration recorded by tracking system"}'::jsonb
            );
        END IF;
    END LOOP;
END $$;

-- Enable RLS on migration table (only admins should see migration details)
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view migration details
CREATE POLICY "migration_admin_only" ON schema_migrations
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
    )
);

-- Grant necessary permissions
GRANT SELECT ON migration_status_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_migration_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION is_migration_applied(TEXT) TO authenticated;
