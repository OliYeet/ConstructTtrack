-- Spatial Indexes Migration
-- Creates spatial indexes for geometry columns to optimize spatial queries

-- Create spatial index on projects.location column
CREATE INDEX IF NOT EXISTS idx_projects_location 
ON projects USING GIST (location);

-- Create spatial index on fiber_routes.route_geometry column
CREATE INDEX IF NOT EXISTS idx_fiber_routes_geometry 
ON fiber_routes USING GIST (route_geometry);

-- Create spatial index on work_areas.boundary column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_areas' 
        AND column_name = 'boundary'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_work_areas_boundary 
        ON work_areas USING GIST (boundary);
    END IF;
END $$;

-- Create spatial index on equipment.location column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'equipment' 
        AND column_name = 'location'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_equipment_location 
        ON equipment USING GIST (location);
    END IF;
END $$;

-- Create composite spatial indexes for common query patterns
-- Index for projects within organization and location
CREATE INDEX IF NOT EXISTS idx_projects_org_location 
ON projects USING GIST (organization_id, location);

-- Index for fiber routes within organization and geometry
CREATE INDEX IF NOT EXISTS idx_fiber_routes_org_geometry 
ON fiber_routes USING GIST (organization_id, route_geometry);

-- Add comments for documentation
COMMENT ON INDEX idx_projects_location IS 'Spatial index for optimizing location-based queries on projects';
COMMENT ON INDEX idx_fiber_routes_geometry IS 'Spatial index for optimizing geometry-based queries on fiber routes';
COMMENT ON INDEX idx_projects_org_location IS 'Composite index for organization and location queries on projects';
COMMENT ON INDEX idx_fiber_routes_org_geometry IS 'Composite index for organization and geometry queries on fiber routes';
