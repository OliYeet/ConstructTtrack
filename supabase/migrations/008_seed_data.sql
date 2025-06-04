-- Seed Data Migration
-- Creates test data and fixtures for development and testing

-- =============================================================================
-- ORGANIZATIONS SEED DATA
-- =============================================================================

-- Insert test organizations
INSERT INTO organizations (id, name, slug, address, phone, email, website, settings) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  'FiberTech Solutions',
  'fibertech-solutions',
  '123 Fiber Street, Tech City, TC 12345',
  '+1-555-0123',
  'contact@fibertech.com',
  'https://fibertech.com',
  '{"timezone": "America/New_York", "currency": "USD", "units": "metric"}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440002', 
  'Metro Fiber Networks',
  'metro-fiber-networks',
  '456 Network Ave, Metro City, MC 67890',
  '+1-555-0456',
  'info@metrofiber.com',
  'https://metrofiber.com',
  '{"timezone": "America/Los_Angeles", "currency": "USD", "units": "imperial"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- USER PROFILES SEED DATA
-- =============================================================================

-- Note: These profiles reference auth.users which would be created through Supabase Auth
-- In a real scenario, users would be created through the authentication system first

-- Insert test profiles (assuming auth.users exist)
INSERT INTO profiles (id, organization_id, email, full_name, phone, role, metadata) VALUES
(
  '550e8400-e29b-41d4-a716-446655440011',
  '550e8400-e29b-41d4-a716-446655440001',
  'admin@fibertech.com',
  'John Admin',
  '+1-555-0111',
  'admin',
  '{"department": "IT", "hire_date": "2023-01-15"}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440012',
  '550e8400-e29b-41d4-a716-446655440001',
  'manager@fibertech.com',
  'Sarah Manager',
  '+1-555-0112',
  'manager',
  '{"department": "Operations", "hire_date": "2023-02-01"}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440013',
  '550e8400-e29b-41d4-a716-446655440001',
  'worker@fibertech.com',
  'Mike Worker',
  '+1-555-0113',
  'field_worker',
  '{"department": "Field Operations", "hire_date": "2023-03-01", "vehicle_id": "VH001"}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440021',
  '550e8400-e29b-41d4-a716-446655440002',
  'admin@metrofiber.com',
  'Lisa Metro',
  '+1-555-0221',
  'admin',
  '{"department": "Administration", "hire_date": "2022-12-01"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PROJECTS SEED DATA
-- =============================================================================

INSERT INTO projects (
  id, 
  organization_id, 
  name, 
  description, 
  status, 
  start_date, 
  end_date, 
  budget, 
  manager_id,
  customer_name,
  customer_email,
  customer_phone,
  customer_address,
  location,
  metadata
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440001',
  'Downtown Fiber Installation',
  'High-speed fiber optic installation for downtown business district',
  'in_progress',
  '2024-01-15',
  '2024-06-30',
  250000.00,
  '550e8400-e29b-41d4-a716-446655440012',
  'Downtown Business Association',
  'contact@downtownbiz.com',
  '+1-555-0301',
  '789 Business Blvd, Downtown, DT 11111',
  ST_SetSRID(ST_MakePoint(-74.0060, 40.7128), 4326), -- NYC coordinates
  '{"priority": "high", "fiber_type": "single_mode", "expected_connections": 150}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440102',
  '550e8400-e29b-41d4-a716-446655440001',
  'Residential Complex Fiber',
  'Fiber to the home installation for new residential development',
  'planning',
  '2024-03-01',
  '2024-08-15',
  180000.00,
  '550e8400-e29b-41d4-a716-446655440012',
  'Greenfield Residential',
  'projects@greenfield.com',
  '+1-555-0302',
  '321 Residential Way, Suburbs, SB 22222',
  ST_SetSRID(ST_MakePoint(-74.0160, 40.7228), 4326),
  '{"priority": "medium", "fiber_type": "multi_mode", "expected_connections": 200}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440201',
  '550e8400-e29b-41d4-a716-446655440002',
  'Metro Campus Network',
  'University campus fiber network upgrade',
  'in_progress',
  '2024-02-01',
  '2024-07-31',
  320000.00,
  '550e8400-e29b-41d4-a716-446655440021',
  'Metro University',
  'it@metrouniv.edu',
  '+1-555-0401',
  '100 University Drive, Metro City, MC 33333',
  ST_SetSRID(ST_MakePoint(-118.2437, 34.0522), 4326), -- LA coordinates
  '{"priority": "high", "fiber_type": "single_mode", "expected_connections": 500}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- FIBER ROUTES SEED DATA
-- =============================================================================

INSERT INTO fiber_routes (
  id,
  project_id,
  name,
  description,
  fiber_type,
  length_meters,
  route_geometry,
  start_point,
  end_point,
  status,
  metadata
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440301',
  '550e8400-e29b-41d4-a716-446655440101',
  'Main Street Trunk Line',
  'Primary fiber trunk line along Main Street',
  'single_mode',
  1200.5,
  ST_SetSRID(ST_MakeLine(
    ST_MakePoint(-74.0060, 40.7128),
    ST_MakePoint(-74.0070, 40.7138)
  ), 4326),
  ST_SetSRID(ST_MakePoint(-74.0060, 40.7128), 4326),
  ST_SetSRID(ST_MakePoint(-74.0070, 40.7138), 4326),
  'installed',
  '{"cable_type": "48-strand", "installation_method": "underground", "depth_meters": 1.2}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440302',
  '550e8400-e29b-41d4-a716-446655440101',
  'Business District Branch',
  'Branch line serving business district buildings',
  'single_mode',
  800.0,
  ST_SetSRID(ST_MakeLine(
    ST_MakePoint(-74.0070, 40.7138),
    ST_MakePoint(-74.0080, 40.7148)
  ), 4326),
  ST_SetSRID(ST_MakePoint(-74.0070, 40.7138), 4326),
  ST_SetSRID(ST_MakePoint(-74.0080, 40.7148), 4326),
  'planned',
  '{"cable_type": "24-strand", "installation_method": "aerial", "pole_attachments": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TASKS SEED DATA
-- =============================================================================

INSERT INTO tasks (
  id,
  project_id,
  route_id,
  assigned_to,
  title,
  description,
  status,
  priority,
  due_date,
  estimated_hours,
  location,
  metadata
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440401',
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440301',
  '550e8400-e29b-41d4-a716-446655440013',
  'Install fiber splice enclosure',
  'Install and test fiber splice enclosure at Main St junction',
  'in_progress',
  1,
  '2024-02-15',
  4.0,
  ST_SetSRID(ST_MakePoint(-74.0065, 40.7133), 4326),
  '{"equipment_needed": ["splice_enclosure", "fusion_splicer"], "safety_requirements": ["traffic_control"]}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440402',
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440302',
  '550e8400-e29b-41d4-a716-446655440013',
  'Conduct site survey',
  'Survey route for business district branch installation',
  'not_started',
  2,
  '2024-02-20',
  6.0,
  ST_SetSRID(ST_MakePoint(-74.0075, 40.7143), 4326),
  '{"survey_type": "aerial", "permits_required": ["utility_crossing"]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- EQUIPMENT SEED DATA
-- =============================================================================

INSERT INTO equipment (
  id,
  organization_id,
  name,
  type,
  serial_number,
  model,
  manufacturer,
  status,
  current_location,
  assigned_to,
  metadata
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440501',
  '550e8400-e29b-41d4-a716-446655440001',
  'Fusion Splicer Unit 1',
  'testing_equipment',
  'FS-2024-001',
  'FSM-100P+',
  'Fujikura',
  'available',
  ST_SetSRID(ST_MakePoint(-74.0050, 40.7120), 4326),
  NULL,
  '{"calibration_date": "2024-01-01", "next_maintenance": "2024-07-01"}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440502',
  '550e8400-e29b-41d4-a716-446655440001',
  'Service Van Alpha',
  'vehicle',
  'VAN-001',
  'Transit Connect',
  'Ford',
  'in_use',
  ST_SetSRID(ST_MakePoint(-74.0065, 40.7133), 4326),
  '550e8400-e29b-41d4-a716-446655440013',
  '{"license_plate": "FT-001", "fuel_type": "gasoline", "capacity": "1000kg"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- MATERIALS SEED DATA
-- =============================================================================

INSERT INTO materials (
  id,
  organization_id,
  name,
  category,
  unit_of_measure,
  cost_per_unit,
  current_stock,
  minimum_stock,
  metadata
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440601',
  '550e8400-e29b-41d4-a716-446655440001',
  'Single Mode Fiber Cable 48-strand',
  'fiber_cable',
  'meters',
  12.50,
  5000,
  1000,
  '{"specifications": "OS2 9/125μm", "jacket_type": "LSZH", "temperature_range": "-40°C to +70°C"}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440602',
  '550e8400-e29b-41d4-a716-446655440001',
  'SC/APC Connectors',
  'connectors',
  'pieces',
  8.75,
  500,
  100,
  '{"connector_type": "SC/APC", "polish": "APC", "insertion_loss": "<0.2dB"}'::jsonb
),
(
  '550e8400-e29b-41d4-a716-446655440603',
  '550e8400-e29b-41d4-a716-446655440001',
  'Fiber Splice Enclosures',
  'hardware',
  'pieces',
  125.00,
  25,
  5,
  '{"capacity": "24 splices", "ingress_protection": "IP68", "mounting": "aerial/underground"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Record this migration
SELECT record_migration(
  '008_seed_data.sql',
  'seed_data_v1',
  NULL,
  true,
  NULL,
  NULL
);
