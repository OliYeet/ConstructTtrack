-- ConstructTrack Seed Data
-- Sample data for development and testing

-- Insert sample organizations
INSERT INTO organizations (id, name, slug, address, phone, email, website) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'FiberTech Solutions', 'fibertech-solutions', '123 Tech Street, San Francisco, CA 94105', '+1-555-0123', 'info@fibertech.com', 'https://fibertech.com'),
  ('550e8400-e29b-41d4-a716-446655440001', 'ConnectCorp', 'connectcorp', '456 Network Ave, Austin, TX 78701', '+1-555-0456', 'contact@connectcorp.com', 'https://connectcorp.com');

-- Note: User profiles will be created automatically via trigger when users sign up
-- But we can insert some sample profiles for testing (these would normally be created via auth)

-- Insert sample projects
INSERT INTO projects (id, organization_id, name, description, status, start_date, end_date, budget, customer_name, customer_email, customer_phone, customer_address, location) VALUES
  (
    '660e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440000',
    'Downtown Fiber Installation',
    'High-speed fiber optic installation for downtown business district',
    'in_progress',
    '2024-02-01',
    '2024-04-30',
    150000.00,
    'Downtown Business Association',
    'admin@downtownbiz.com',
    '+1-555-0789',
    '789 Main Street, San Francisco, CA 94105',
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)
  ),
  (
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    'Residential Complex Fiber',
    'Fiber to the home installation for luxury residential complex',
    'planning',
    '2024-03-15',
    '2024-06-15',
    85000.00,
    'Sunset Residences',
    'manager@sunsetres.com',
    '+1-555-0321',
    '321 Sunset Blvd, San Francisco, CA 94116',
    ST_SetSRID(ST_MakePoint(-122.4647, 37.7648), 4326)
  ),
  (
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'Campus Network Upgrade',
    'University campus fiber network infrastructure upgrade',
    'planning',
    '2024-04-01',
    '2024-08-31',
    250000.00,
    'Austin University',
    'it@austinuni.edu',
    '+1-555-0654',
    '100 University Dr, Austin, TX 78712',
    ST_SetSRID(ST_MakePoint(-97.7431, 30.2672), 4326)
  );

-- Insert sample fiber routes
INSERT INTO fiber_routes (id, project_id, name, description, fiber_type, length_meters, route_geometry, start_point, end_point, status) VALUES
  (
    '770e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440000',
    'Main Street Trunk',
    'Primary fiber trunk along Main Street',
    'single_mode',
    1200.50,
    ST_SetSRID(ST_MakeLine(ST_MakePoint(-122.4194, 37.7749), ST_MakePoint(-122.4094, 37.7849)), 4326),
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
    ST_SetSRID(ST_MakePoint(-122.4094, 37.7849), 4326),
    'installed'
  ),
  (
    '770e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440000',
    'Market Street Branch',
    'Secondary branch to Market Street buildings',
    'single_mode',
    800.25,
    ST_SetSRID(ST_MakeLine(ST_MakePoint(-122.4094, 37.7849), ST_MakePoint(-122.4044, 37.7899)), 4326),
    ST_SetSRID(ST_MakePoint(-122.4094, 37.7849), 4326),
    ST_SetSRID(ST_MakePoint(-122.4044, 37.7899), 4326),
    'planned'
  ),
  (
    '770e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440001',
    'Residential Loop A',
    'Fiber loop for buildings A-F',
    'single_mode',
    950.75,
    ST_SetSRID(ST_MakeLine(ST_MakePoint(-122.4647, 37.7648), ST_MakePoint(-122.4597, 37.7698)), 4326),
    ST_SetSRID(ST_MakePoint(-122.4647, 37.7648), 4326),
    ST_SetSRID(ST_MakePoint(-122.4597, 37.7698), 4326),
    'planned'
  );

-- Insert sample fiber connections
INSERT INTO fiber_connections (id, route_id, connection_point, connection_type, equipment_id, fiber_count, status) VALUES
  (
    '880e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440000',
    ST_SetSRID(ST_MakePoint(-122.4144, 37.7799), 4326),
    'splice',
    'SP-001',
    12,
    'installed'
  ),
  (
    '880e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440000',
    ST_SetSRID(ST_MakePoint(-122.4094, 37.7849), 4326),
    'patch_panel',
    'PP-001',
    24,
    'installed'
  ),
  (
    '880e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440001',
    ST_SetSRID(ST_MakePoint(-122.4069, 37.7874), 4326),
    'termination',
    'TERM-001',
    6,
    'planned'
  );

-- Insert sample tasks
INSERT INTO tasks (id, project_id, route_id, title, description, status, priority, due_date, estimated_hours, location) VALUES
  (
    '990e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440000',
    'Install splice enclosure at Main/1st intersection',
    'Install and test fiber splice enclosure at the intersection of Main Street and 1st Avenue',
    'completed',
    1,
    '2024-02-15',
    4.0,
    ST_SetSRID(ST_MakePoint(-122.4144, 37.7799), 4326)
  ),
  (
    '990e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440001',
    'Run fiber cable along Market Street',
    'Install underground fiber cable from Main Street to Market Street endpoint',
    'in_progress',
    2,
    '2024-02-28',
    8.0,
    ST_SetSRID(ST_MakePoint(-122.4069, 37.7874), 4326)
  ),
  (
    '990e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002',
    'Site survey for residential complex',
    'Conduct detailed site survey and mark utility locations',
    'not_started',
    2,
    '2024-03-20',
    6.0,
    ST_SetSRID(ST_MakePoint(-122.4647, 37.7648), 4326)
  );

-- Insert sample customer agreements
INSERT INTO customer_agreements (id, project_id, customer_name, customer_email, customer_phone, property_address, agreement_type, is_signed) VALUES
  (
    'aa0e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440000',
    'Downtown Business Association',
    'admin@downtownbiz.com',
    '+1-555-0789',
    '789 Main Street, San Francisco, CA 94105',
    'installation',
    true
  ),
  (
    'aa0e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001',
    'Sunset Residences',
    'manager@sunsetres.com',
    '+1-555-0321',
    '321 Sunset Blvd, San Francisco, CA 94116',
    'installation',
    false
  );

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions for PostGIS
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON spatial_ref_sys TO anon, authenticated;
