-- Performance Monitoring Migration
-- Sets up database performance monitoring and query analytics

-- =============================================================================
-- QUERY PERFORMANCE TRACKING
-- =============================================================================

-- Enable pg_stat_statements extension for query performance tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create table to track slow queries
CREATE TABLE IF NOT EXISTS slow_query_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash TEXT NOT NULL,
    query_text TEXT NOT NULL,
    execution_time_ms NUMERIC NOT NULL,
    calls INTEGER DEFAULT 1,
    mean_time_ms NUMERIC,
    rows_affected INTEGER,
    database_name TEXT DEFAULT current_database(),
    user_name TEXT DEFAULT current_user,
    organization_id UUID,
    table_names TEXT[],
    query_type TEXT, -- SELECT, INSERT, UPDATE, DELETE
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_slow_query_log_execution_time ON slow_query_log(execution_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_slow_query_log_logged_at ON slow_query_log(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_slow_query_log_query_hash ON slow_query_log(query_hash);
CREATE INDEX IF NOT EXISTS idx_slow_query_log_organization ON slow_query_log(organization_id);

-- =============================================================================
-- TABLE SIZE AND GROWTH MONITORING
-- =============================================================================

-- Create table to track table sizes over time
CREATE TABLE IF NOT EXISTS table_size_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    row_count BIGINT,
    index_size_bytes BIGINT,
    total_size_bytes BIGINT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_table_size_history_recorded_at ON table_size_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_table_size_history_table ON table_size_history(schema_name, table_name);

-- Function to record current table sizes
CREATE OR REPLACE FUNCTION record_table_sizes()
RETURNS INTEGER AS $$
DECLARE
    table_record RECORD;
    inserted_count INTEGER := 0;
BEGIN
    -- Insert current table sizes
    FOR table_record IN
        SELECT 
            schemaname,
            tablename,
            pg_total_relation_size(schemaname||'.'||tablename) as total_size,
            pg_relation_size(schemaname||'.'||tablename) as table_size,
            pg_indexes_size(schemaname||'.'||tablename) as index_size,
            (SELECT reltuples::BIGINT FROM pg_class WHERE relname = tablename) as row_estimate
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        INSERT INTO table_size_history (
            schema_name,
            table_name,
            size_bytes,
            row_count,
            index_size_bytes,
            total_size_bytes
        ) VALUES (
            table_record.schemaname,
            table_record.tablename,
            table_record.table_size,
            table_record.row_estimate,
            table_record.index_size,
            table_record.total_size
        );
        
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- INDEX USAGE MONITORING
-- =============================================================================

-- Create table to track index usage
CREATE TABLE IF NOT EXISTS index_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    index_name TEXT NOT NULL,
    scans BIGINT NOT NULL,
    tuples_read BIGINT NOT NULL,
    tuples_fetched BIGINT NOT NULL,
    size_bytes BIGINT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_index_usage_stats_recorded_at ON index_usage_stats(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_index_usage_stats_table ON index_usage_stats(schema_name, table_name);

-- Function to record index usage statistics
CREATE OR REPLACE FUNCTION record_index_usage()
RETURNS INTEGER AS $$
DECLARE
    index_record RECORD;
    inserted_count INTEGER := 0;
BEGIN
    -- Insert current index usage stats
    FOR index_record IN
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch,
            pg_relation_size(indexrelid) as index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
    LOOP
        INSERT INTO index_usage_stats (
            schema_name,
            table_name,
            index_name,
            scans,
            tuples_read,
            tuples_fetched,
            size_bytes
        ) VALUES (
            index_record.schemaname,
            index_record.tablename,
            index_record.indexname,
            index_record.idx_scan,
            index_record.idx_tup_read,
            index_record.idx_tup_fetch,
            index_record.index_size
        );
        
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PERFORMANCE MONITORING VIEWS
-- =============================================================================

-- View for current database performance metrics
CREATE OR REPLACE VIEW database_performance_summary AS
SELECT 
    current_database() as database_name,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
    (SELECT count(*) FROM pg_stat_activity) as total_connections,
    pg_database_size(current_database()) as database_size_bytes,
    (SELECT sum(size_bytes) FROM table_size_history WHERE recorded_at > NOW() - INTERVAL '1 hour') as recent_table_growth,
    NOW() as snapshot_time;

-- View for slow query analysis
CREATE OR REPLACE VIEW slow_queries_analysis AS
SELECT 
    query_hash,
    query_text,
    calls,
    ROUND(mean_time_ms::NUMERIC, 2) as avg_execution_ms,
    ROUND((execution_time_ms * calls)::NUMERIC, 2) as total_time_ms,
    table_names,
    query_type,
    organization_id,
    logged_at
FROM slow_query_log
WHERE logged_at > NOW() - INTERVAL '24 hours'
ORDER BY total_time_ms DESC;

-- View for table growth trends
CREATE OR REPLACE VIEW table_growth_trends AS
SELECT 
    table_name,
    size_bytes as current_size_bytes,
    row_count as current_row_count,
    LAG(size_bytes) OVER (PARTITION BY table_name ORDER BY recorded_at) as previous_size_bytes,
    LAG(row_count) OVER (PARTITION BY table_name ORDER BY recorded_at) as previous_row_count,
    (size_bytes - LAG(size_bytes) OVER (PARTITION BY table_name ORDER BY recorded_at)) as size_growth_bytes,
    recorded_at
FROM table_size_history
WHERE recorded_at > NOW() - INTERVAL '7 days'
ORDER BY table_name, recorded_at DESC;

-- View for unused indexes
CREATE OR REPLACE VIEW unused_indexes_analysis AS
SELECT 
    schema_name,
    table_name,
    index_name,
    size_bytes,
    scans,
    CASE 
        WHEN scans = 0 THEN 'Never used'
        WHEN scans < 10 THEN 'Rarely used'
        ELSE 'Actively used'
    END as usage_status,
    recorded_at
FROM index_usage_stats
WHERE recorded_at = (
    SELECT MAX(recorded_at) 
    FROM index_usage_stats ius2 
    WHERE ius2.index_name = index_usage_stats.index_name
)
ORDER BY scans ASC, size_bytes DESC;

-- =============================================================================
-- MONITORING FUNCTIONS
-- =============================================================================

-- Function to get current performance snapshot
CREATE OR REPLACE FUNCTION get_performance_snapshot()
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT,
    severity TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Active Connections'::TEXT,
        (SELECT count(*)::NUMERIC FROM pg_stat_activity WHERE state = 'active'),
        'connections'::TEXT,
        CASE 
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') > 50 THEN 'high'
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') > 20 THEN 'medium'
            ELSE 'low'
        END::TEXT
    
    UNION ALL
    
    SELECT 
        'Database Size'::TEXT,
        pg_database_size(current_database())::NUMERIC,
        'bytes'::TEXT,
        CASE 
            WHEN pg_database_size(current_database()) > 10737418240 THEN 'high' -- 10GB
            WHEN pg_database_size(current_database()) > 1073741824 THEN 'medium' -- 1GB
            ELSE 'low'
        END::TEXT
    
    UNION ALL
    
    SELECT 
        'Slow Queries (24h)'::TEXT,
        (SELECT count(*)::NUMERIC FROM slow_query_log WHERE logged_at > NOW() - INTERVAL '24 hours'),
        'queries'::TEXT,
        CASE 
            WHEN (SELECT count(*) FROM slow_query_log WHERE logged_at > NOW() - INTERVAL '24 hours') > 100 THEN 'high'
            WHEN (SELECT count(*) FROM slow_query_log WHERE logged_at > NOW() - INTERVAL '24 hours') > 10 THEN 'medium'
            ELSE 'low'
        END::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log slow queries (to be called by application)
CREATE OR REPLACE FUNCTION log_slow_query(
    p_query_text TEXT,
    p_execution_time_ms NUMERIC,
    p_organization_id UUID DEFAULT NULL,
    p_table_names TEXT[] DEFAULT NULL,
    p_query_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    query_id UUID;
    query_hash_val TEXT;
BEGIN
    -- Generate hash for the query
    query_hash_val := md5(p_query_text);
    
    -- Insert or update slow query log
    INSERT INTO slow_query_log (
        query_hash,
        query_text,
        execution_time_ms,
        organization_id,
        table_names,
        query_type,
        calls,
        mean_time_ms
    ) VALUES (
        query_hash_val,
        p_query_text,
        p_execution_time_ms,
        p_organization_id,
        p_table_names,
        p_query_type,
        1,
        p_execution_time_ms
    )
    ON CONFLICT (query_hash) DO UPDATE SET
        calls = slow_query_log.calls + 1,
        mean_time_ms = (slow_query_log.mean_time_ms * slow_query_log.calls + p_execution_time_ms) / (slow_query_log.calls + 1),
        logged_at = NOW()
    RETURNING id INTO query_id;
    
    RETURN query_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PERMISSIONS AND SECURITY
-- =============================================================================

-- Enable RLS on monitoring tables
ALTER TABLE slow_query_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_size_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_usage_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for monitoring tables (admin only)
CREATE POLICY "monitoring_admin_only" ON slow_query_log
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
    )
);

CREATE POLICY "table_size_admin_only" ON table_size_history
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
    )
);

CREATE POLICY "index_usage_admin_only" ON index_usage_stats
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
    )
);

-- Grant permissions
GRANT SELECT ON database_performance_summary TO authenticated;
GRANT SELECT ON slow_queries_analysis TO authenticated;
GRANT SELECT ON table_growth_trends TO authenticated;
GRANT SELECT ON unused_indexes_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION get_performance_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION log_slow_query(TEXT, NUMERIC, UUID, TEXT[], TEXT) TO authenticated;

-- Record this migration
SELECT record_migration(
  '009_performance_monitoring.sql',
  'performance_monitoring_v1',
  NULL,
  true,
  NULL,
  NULL
);
