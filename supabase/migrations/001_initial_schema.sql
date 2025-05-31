-- ConstructTrack Fiber Optic Management Platform
-- Initial Database Schema Migration

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'field_worker', 'customer');
CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'completed', 'on_hold', 'cancelled');
CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'completed', 'blocked');
CREATE TYPE fiber_type AS ENUM ('single_mode', 'multi_mode', 'armored', 'aerial', 'underground');
CREATE TYPE connection_status AS ENUM ('planned', 'installed', 'tested', 'active', 'inactive');

-- Organizations table (multi-tenancy)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role user_role DEFAULT 'field_worker',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status project_status DEFAULT 'planning',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12,2),
    manager_id UUID REFERENCES profiles(id),
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    location GEOMETRY(POINT, 4326),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fiber routes table
CREATE TABLE fiber_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    fiber_type fiber_type NOT NULL,
    length_meters DECIMAL(10,2),
    route_geometry GEOMETRY(LINESTRING, 4326),
    start_point GEOMETRY(POINT, 4326),
    end_point GEOMETRY(POINT, 4326),
    status connection_status DEFAULT 'planned',
    installation_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fiber connections table
CREATE TABLE fiber_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES fiber_routes(id) ON DELETE CASCADE,
    connection_point GEOMETRY(POINT, 4326) NOT NULL,
    connection_type TEXT NOT NULL, -- splice, termination, patch_panel, etc.
    equipment_id TEXT,
    fiber_count INTEGER DEFAULT 1,
    status connection_status DEFAULT 'planned',
    installation_date DATE,
    test_results JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    route_id UUID REFERENCES fiber_routes(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'not_started',
    priority INTEGER DEFAULT 3, -- 1=high, 2=medium, 3=low
    due_date DATE,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    location GEOMETRY(POINT, 4326),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photos table for documentation
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    route_id UUID REFERENCES fiber_routes(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    location GEOMETRY(POINT, 4326),
    caption TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer agreements table
CREATE TABLE customer_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    property_address TEXT NOT NULL,
    agreement_type TEXT NOT NULL, -- installation, maintenance, etc.
    agreement_url TEXT, -- signed document
    signed_date DATE,
    is_signed BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiber_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiber_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_agreements ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_manager_id ON projects(manager_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_fiber_routes_project_id ON fiber_routes(project_id);
CREATE INDEX idx_fiber_connections_route_id ON fiber_connections(route_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_photos_project_id ON photos(project_id);

-- Spatial indexes
CREATE INDEX idx_projects_location ON projects USING GIST(location);
CREATE INDEX idx_fiber_routes_geometry ON fiber_routes USING GIST(route_geometry);
CREATE INDEX idx_fiber_routes_start_point ON fiber_routes USING GIST(start_point);
CREATE INDEX idx_fiber_routes_end_point ON fiber_routes USING GIST(end_point);
CREATE INDEX idx_fiber_connections_point ON fiber_connections USING GIST(connection_point);
CREATE INDEX idx_tasks_location ON tasks USING GIST(location);
CREATE INDEX idx_photos_location ON photos USING GIST(location);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fiber_routes_updated_at BEFORE UPDATE ON fiber_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fiber_connections_updated_at BEFORE UPDATE ON fiber_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_agreements_updated_at BEFORE UPDATE ON customer_agreements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
