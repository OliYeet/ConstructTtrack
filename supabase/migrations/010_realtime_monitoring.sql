-- Real-time Monitoring Tables and Functions
-- Based on Charlie's implementation blueprint for LUM-585
-- Migration: 010_realtime_monitoring.sql

-- Enable TimescaleDB extension if not already enabled
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create realtime_metrics table
CREATE TABLE IF NOT EXISTS realtime_metrics (
  time        TIMESTAMPTZ NOT NULL,
  metric_name TEXT        NOT NULL,
  tags        JSONB       NOT NULL DEFAULT '{}',
  value       DOUBLE PRECISION,
  unit        TEXT,
  metadata    JSONB       DEFAULT '{}',
  PRIMARY KEY (time, metric_name, tags)
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable(
  'realtime_metrics', 
  'time',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '1 day'
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_metric_name 
  ON realtime_metrics (metric_name, time DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_metrics_tags 
  ON realtime_metrics USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_realtime_metrics_time 
  ON realtime_metrics (time DESC);

-- Create continuous aggregates for hourly rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS realtime_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 hour', time) AS bucket,
  metric_name,
  tags,
  AVG(value) AS avg_value,
  MAX(value) AS max_value,
  MIN(value) AS min_value,
  SUM(value) AS sum_value,
  COUNT(*) AS count_value,
  STDDEV(value) AS stddev_value
FROM realtime_metrics
GROUP BY bucket, metric_name, tags
WITH NO DATA;

-- Create continuous aggregates for daily rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS realtime_metrics_daily
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 day', time) AS bucket,
  metric_name,
  tags,
  AVG(value) AS avg_value,
  MAX(value) AS max_value,
  MIN(value) AS min_value,
  SUM(value) AS sum_value,
  COUNT(*) AS count_value,
  STDDEV(value) AS stddev_value
FROM realtime_metrics
GROUP BY bucket, metric_name, tags
WITH NO DATA;

-- Add refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy(
  'realtime_metrics_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy(
  'realtime_metrics_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Add retention policies
SELECT add_retention_policy(
  'realtime_metrics',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

SELECT add_retention_policy(
  'realtime_metrics_hourly',
  INTERVAL '90 days',
  if_not_exists => TRUE
);

SELECT add_retention_policy(
  'realtime_metrics_daily',
  INTERVAL '1 year',
  if_not_exists => TRUE
);

-- Create function to get metric statistics
CREATE OR REPLACE FUNCTION get_metric_stats(
  p_metric_name TEXT,
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  p_end_time TIMESTAMPTZ DEFAULT NOW(),
  p_tags JSONB DEFAULT '{}'
)
RETURNS TABLE (
  avg_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  min_value DOUBLE PRECISION,
  sum_value DOUBLE PRECISION,
  count_value BIGINT,
  p50_value DOUBLE PRECISION,
  p95_value DOUBLE PRECISION,
  p99_value DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    AVG(rm.value) AS avg_value,
    MAX(rm.value) AS max_value,
    MIN(rm.value) AS min_value,
    SUM(rm.value) AS sum_value,
    COUNT(*)::BIGINT AS count_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rm.value) AS p50_value,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rm.value) AS p95_value,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY rm.value) AS p99_value
  FROM realtime_metrics rm
  WHERE rm.metric_name = p_metric_name
    AND rm.time >= p_start_time
    AND rm.time <= p_end_time
    AND (p_tags = '{}' OR rm.tags @> p_tags);
END;
$$ LANGUAGE plpgsql;

-- Create function to get top metrics by value
CREATE OR REPLACE FUNCTION get_top_metrics(
  p_metric_name TEXT,
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  p_end_time TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  time TIMESTAMPTZ,
  value DOUBLE PRECISION,
  tags JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT rm.time, rm.value, rm.tags
  FROM realtime_metrics rm
  WHERE rm.metric_name = p_metric_name
    AND rm.time >= p_start_time
    AND rm.time <= p_end_time
  ORDER BY rm.value DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to get metric trends
CREATE OR REPLACE FUNCTION get_metric_trends(
  p_metric_name TEXT,
  p_interval TEXT DEFAULT '5 minutes',
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  bucket TIMESTAMPTZ,
  avg_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  min_value DOUBLE PRECISION,
  count_value BIGINT
) AS $$
BEGIN
  RETURN QUERY
  EXECUTE format('
    SELECT 
      time_bucket(%L, time) AS bucket,
      AVG(value) AS avg_value,
      MAX(value) AS max_value,
      MIN(value) AS min_value,
      COUNT(*)::BIGINT AS count_value
    FROM realtime_metrics
    WHERE metric_name = %L
      AND time >= %L
      AND time <= %L
    GROUP BY bucket
    ORDER BY bucket
  ', p_interval, p_metric_name, p_start_time, p_end_time);
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old metrics (manual cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_metrics(
  p_older_than TIMESTAMPTZ
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM realtime_metrics
  WHERE time < p_older_than;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create alerts table for monitoring thresholds
CREATE TABLE IF NOT EXISTS realtime_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  threshold_type TEXT NOT NULL CHECK (threshold_type IN ('above', 'below', 'equal')),
  threshold_value DOUBLE PRECISION NOT NULL,
  tags JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  cooldown_minutes INTEGER DEFAULT 5,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on alerts
CREATE INDEX IF NOT EXISTS idx_realtime_alerts_metric_name 
  ON realtime_alerts (metric_name) WHERE enabled = TRUE;

-- Create function to check alert thresholds
CREATE OR REPLACE FUNCTION check_metric_alerts(
  p_metric_name TEXT,
  p_value DOUBLE PRECISION,
  p_tags JSONB DEFAULT '{}'
)
RETURNS TABLE (
  alert_id UUID,
  threshold_type TEXT,
  threshold_value DOUBLE PRECISION,
  should_trigger BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ra.id,
    ra.threshold_type,
    ra.threshold_value,
    CASE
      WHEN ra.threshold_type = 'above' THEN p_value > ra.threshold_value
      WHEN ra.threshold_type = 'below' THEN p_value < ra.threshold_value
      -- Use epsilon comparison for floating-point equality
      WHEN ra.threshold_type = 'equal' THEN ABS(p_value - ra.threshold_value) < 0.0001
      ELSE FALSE
    END AS should_trigger
  FROM realtime_alerts ra
  WHERE ra.metric_name = p_metric_name
    AND ra.enabled = TRUE
    AND (ra.tags = '{}' OR ra.tags @> p_tags)
    AND (
      ra.last_triggered_at IS NULL
      OR ra.last_triggered_at < NOW() - (ra.cooldown_minutes || ' minutes')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for security
ALTER TABLE realtime_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_alerts ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data
CREATE POLICY "Service role can access all realtime_metrics" ON realtime_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all realtime_alerts" ON realtime_alerts
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read their organization's metrics
-- (This would need to be customized based on your auth schema)
CREATE POLICY "Users can read realtime_metrics" ON realtime_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read realtime_alerts" ON realtime_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON realtime_metrics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON realtime_alerts TO service_role;
GRANT SELECT ON realtime_metrics TO authenticated;
GRANT SELECT ON realtime_alerts TO authenticated;

-- Grant permissions on continuous aggregates
GRANT SELECT ON realtime_metrics_hourly TO service_role, authenticated;
GRANT SELECT ON realtime_metrics_daily TO service_role, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_metric_stats TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_top_metrics TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_metric_trends TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_metrics TO service_role;
GRANT EXECUTE ON FUNCTION check_metric_alerts TO service_role, authenticated;

-- Create comments for documentation
COMMENT ON TABLE realtime_metrics IS 'Stores real-time monitoring metrics with TimescaleDB optimization';
COMMENT ON TABLE realtime_alerts IS 'Defines alert thresholds for real-time metrics';
COMMENT ON FUNCTION get_metric_stats IS 'Returns statistical analysis of metrics for a given time period';
COMMENT ON FUNCTION get_top_metrics IS 'Returns top N metrics by value for analysis';
COMMENT ON FUNCTION get_metric_trends IS 'Returns time-bucketed trends for metric visualization';
COMMENT ON FUNCTION check_metric_alerts IS 'Checks if metric values trigger any configured alerts';
