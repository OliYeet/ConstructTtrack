-- Add tags_hash column to realtime_metrics for better conflict handling
-- This allows us to use tags in the conflict target without JSONB comparison issues

-- Add the tags_hash column
ALTER TABLE realtime_metrics 
ADD COLUMN IF NOT EXISTS tags_hash TEXT 
GENERATED ALWAYS AS (md5(tags::text)) STORED;

-- Create an index on the tags_hash for better performance
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_tags_hash 
ON realtime_metrics (time, metric_name, tags_hash);

-- Drop the existing primary key
ALTER TABLE realtime_metrics DROP CONSTRAINT IF EXISTS realtime_metrics_pkey;

-- Recreate the primary key with tags_hash instead of tags
ALTER TABLE realtime_metrics 
ADD CONSTRAINT realtime_metrics_pkey 
PRIMARY KEY (time, metric_name, tags_hash);

-- Add a unique constraint that can be used for upsert conflict target
CREATE UNIQUE INDEX IF NOT EXISTS idx_realtime_metrics_unique 
ON realtime_metrics (time, metric_name, tags_hash);