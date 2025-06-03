-- ConstructTrack Database Functions and Views
-- Provides useful functions and views for common operations

-- Function: Get projects within geographic bounds
CREATE OR REPLACE FUNCTION projects_in_bounds(
  min_lat FLOAT,
  max_lat FLOAT,
  min_lng FLOAT,
  max_lng FLOAT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  status project_status,
  location GEOMETRY,
  customer_name TEXT,
  manager_name TEXT
) AS $$
BEGIN
  -- Set secure search_path to prevent privilege escalation
  PERFORM set_config('search_path', 'pg_catalog, public', true);

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.status,
    p.location,
    p.customer_name,
    pr.full_name as manager_name
  FROM projects p
  LEFT JOIN profiles pr ON p.manager_id = pr.id
  WHERE p.organization_id = auth.user_organization_id()
    AND p.location IS NOT NULL
    AND ST_Within(
      p.location,
      ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Find nearby projects within radius
CREATE OR REPLACE FUNCTION find_nearby_projects(
  lat FLOAT,
  lng FLOAT,
  radius_meters INTEGER
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  status project_status,
  distance_meters FLOAT,
  customer_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.status,
    ST_Distance(p.location::geography, ST_MakePoint(lng, lat)::geography)::FLOAT as distance_meters,
    p.customer_name
  FROM projects p
  WHERE p.organization_id = auth.user_organization_id()
    AND p.location IS NOT NULL
    AND ST_DWithin(p.location::geography, ST_MakePoint(lng, lat)::geography, radius_meters)
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate total fiber length for a project
CREATE OR REPLACE FUNCTION project_fiber_length(project_uuid UUID)
RETURNS FLOAT AS $$
DECLARE
  total_length FLOAT;
BEGIN
  SELECT COALESCE(SUM(ST_Length(route_geometry::geography)), 0)
  INTO total_length
  FROM fiber_routes
  WHERE project_id = project_uuid
    AND route_geometry IS NOT NULL;
  
  RETURN total_length;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get equipment utilization rate
CREATE OR REPLACE FUNCTION equipment_utilization_rate(
  equipment_uuid UUID,
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS FLOAT AS $$
DECLARE
  total_days INTEGER;
  used_days INTEGER;
BEGIN
  total_days := end_date - start_date + 1;

  SELECT COUNT(DISTINCT DATE(assigned_at))
  INTO used_days
  FROM equipment_assignments
  WHERE equipment_id = equipment_uuid
    AND assigned_at <= end_date
    AND (returned_at IS NULL OR returned_at >= start_date);

  RETURN CASE
    WHEN total_days > 0 THEN (used_days::FLOAT / total_days::FLOAT) * 100
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get low stock materials
CREATE OR REPLACE FUNCTION get_low_stock_materials()
RETURNS TABLE (
  id UUID,
  name TEXT,
  current_stock INTEGER,
  minimum_stock INTEGER,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.current_stock,
    m.minimum_stock,
    m.category
  FROM materials m
  WHERE m.organization_id = auth.user_organization_id()
    AND m.current_stock <= m.minimum_stock
  ORDER BY (m.current_stock::FLOAT / NULLIF(m.minimum_stock, 0)) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate project completion percentage
CREATE OR REPLACE FUNCTION project_completion_percentage(project_uuid UUID)
RETURNS FLOAT AS $$
DECLARE
  total_tasks INTEGER;
  completed_tasks INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tasks
  FROM tasks
  WHERE project_id = project_uuid;
  
  SELECT COUNT(*) INTO completed_tasks
  FROM tasks
  WHERE project_id = project_uuid
    AND status = 'completed';
  
  RETURN CASE 
    WHEN total_tasks > 0 THEN (completed_tasks::FLOAT / total_tasks::FLOAT) * 100
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user's active time entries
CREATE OR REPLACE FUNCTION get_active_time_entries(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
  id UUID,
  project_name TEXT,
  task_title TEXT,
  start_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    te.id,
    p.name as project_name,
    t.title as task_title,
    te.start_time,
    EXTRACT(EPOCH FROM (NOW() - te.start_time))::INTEGER / 60 as duration_minutes,
    te.description
  FROM time_entries te
  JOIN projects p ON te.project_id = p.id
  LEFT JOIN tasks t ON te.task_id = t.id
  WHERE te.user_id = user_uuid
    AND te.end_time IS NULL
    AND p.organization_id = auth.user_organization_id()
  ORDER BY te.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View: Project dashboard summary
CREATE OR REPLACE VIEW project_dashboard AS
SELECT 
  p.id,
  p.name,
  p.status,
  p.start_date,
  p.end_date,
  p.budget,
  p.customer_name,
  pr.full_name as manager_name,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
  COUNT(DISTINCT fr.id) as total_routes,
  COALESCE(SUM(ST_Length(fr.route_geometry::geography)), 0) as total_fiber_length,
  COUNT(DISTINCT ph.id) as total_photos,
  project_completion_percentage(p.id) as completion_percentage
FROM projects p
LEFT JOIN profiles pr ON p.manager_id = pr.id
LEFT JOIN tasks t ON p.id = t.project_id
LEFT JOIN fiber_routes fr ON p.id = fr.project_id
LEFT JOIN photos ph ON p.id = ph.project_id
WHERE p.organization_id = auth.user_organization_id()
GROUP BY p.id, p.name, p.status, p.start_date, p.end_date, p.budget, p.customer_name, pr.full_name;

-- View: Equipment status summary
CREATE OR REPLACE VIEW equipment_status_summary AS
SELECT 
  e.id,
  e.name,
  e.type,
  e.status,
  e.serial_number,
  pr.full_name as assigned_to_name,
  p.name as current_project,
  equipment_utilization_rate(e.id) as utilization_rate_30d
FROM equipment e
LEFT JOIN profiles pr ON e.assigned_to = pr.id
LEFT JOIN equipment_assignments ea ON e.id = ea.equipment_id AND ea.returned_at IS NULL
LEFT JOIN projects p ON ea.project_id = p.id
WHERE e.organization_id = auth.user_organization_id();

-- View: Material inventory summary
CREATE OR REPLACE VIEW material_inventory_summary AS
SELECT 
  m.id,
  m.name,
  m.category,
  m.unit_of_measure,
  m.current_stock,
  m.minimum_stock,
  m.cost_per_unit,
  (m.current_stock * m.cost_per_unit) as total_value,
  CASE 
    WHEN m.current_stock <= m.minimum_stock THEN 'low'
    WHEN m.current_stock <= (m.minimum_stock * 1.5) THEN 'medium'
    ELSE 'good'
  END as stock_level,
  COALESCE(SUM(ma.allocated_quantity - ma.used_quantity), 0) as allocated_quantity
FROM materials m
LEFT JOIN material_allocations ma ON m.id = ma.material_id
WHERE m.organization_id = auth.user_organization_id()
GROUP BY m.id, m.name, m.category, m.unit_of_measure, m.current_stock, m.minimum_stock, m.cost_per_unit;

-- View: Task assignment summary
CREATE OR REPLACE VIEW task_assignment_summary AS
SELECT 
  t.id,
  t.title,
  t.status,
  t.priority,
  t.due_date,
  p.name as project_name,
  pr.full_name as assigned_to_name,
  pr.email as assigned_to_email,
  t.estimated_hours,
  t.actual_hours,
  CASE 
    WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN true
    ELSE false
  END as is_overdue
FROM tasks t
JOIN projects p ON t.project_id = p.id
LEFT JOIN profiles pr ON t.assigned_to = pr.id
WHERE p.organization_id = auth.user_organization_id();

-- Function: Create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log(
  action_type TEXT,
  entity_type_param TEXT,
  entity_id_param UUID,
  old_values_param JSONB DEFAULT NULL,
  new_values_param JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    action_type,
    entity_type_param,
    entity_id_param,
    old_values_param,
    new_values_param,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if table has RLS enabled (for testing)
CREATE OR REPLACE FUNCTION check_table_rls_status(table_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  -- Set secure search_path to prevent privilege escalation
  PERFORM set_config('search_path', 'pg_catalog, public', true);

  SELECT relrowsecurity
  INTO rls_enabled
  FROM pg_catalog.pg_class
  WHERE relname = table_name;

  RETURN COALESCE(rls_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
