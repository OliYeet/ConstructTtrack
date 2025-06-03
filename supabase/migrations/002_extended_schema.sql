-- ConstructTrack Extended Database Schema Migration
-- Adds comprehensive tables for equipment, materials, work areas, forms, and more

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create additional custom types
CREATE TYPE equipment_status AS ENUM ('available', 'in_use', 'maintenance', 'retired');
CREATE TYPE work_area_status AS ENUM ('planned', 'in_progress', 'completed', 'blocked');
CREATE TYPE notification_type AS ENUM ('task_assigned', 'project_update', 'equipment_due', 'form_required', 'system_alert');
CREATE TYPE document_type AS ENUM ('drawing', 'permit', 'contract', 'report', 'photo', 'other');

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Equipment Management Tables

-- Equipment table
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'vehicle', 'tool', 'testing_equipment', 'safety'
    serial_number TEXT,
    model TEXT,
    manufacturer TEXT,
    purchase_date DATE,
    purchase_cost DECIMAL(10,2),
    status equipment_status DEFAULT 'available',
    current_location GEOMETRY(POINT, 4326),
    assigned_to UUID REFERENCES profiles(id),
    maintenance_schedule JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment assignments table
CREATE TABLE equipment_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    checkout_location GEOMETRY(POINT, 4326),
    return_location GEOMETRY(POINT, 4326),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Material Management Tables

-- Materials table
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'fiber_cable', 'connectors', 'tools', 'hardware'
    unit_of_measure TEXT NOT NULL, -- 'meters', 'pieces', 'boxes'
    cost_per_unit DECIMAL(10,2),
    current_stock INTEGER DEFAULT 0,
    minimum_stock INTEGER DEFAULT 0,
    supplier_info JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Material allocations table
CREATE TABLE material_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    allocated_quantity INTEGER NOT NULL,
    used_quantity INTEGER DEFAULT 0,
    allocated_by UUID NOT NULL REFERENCES profiles(id),
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Area Management

-- Work areas table
CREATE TABLE work_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    area_geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    area_type TEXT DEFAULT 'general', -- 'excavation', 'installation', 'testing'
    status work_area_status DEFAULT 'planned',
    assigned_to UUID REFERENCES profiles(id),
    start_date DATE,
    end_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forms and Custom Fields

-- Forms table
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    form_schema JSONB NOT NULL, -- JSON schema for form fields
    is_template BOOLEAN DEFAULT false,
    category TEXT, -- 'installation', 'maintenance', 'inspection'
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES profiles(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form submissions table
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES profiles(id),
    form_data JSONB NOT NULL, -- Actual form responses
    location GEOMETRY(POINT, 4326),
    signature_url TEXT,
    is_complete BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Management

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    document_type document_type NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time Tracking

-- Time entries table
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    description TEXT,
    location GEOMETRY(POINT, 4326),
    is_billable BOOLEAN DEFAULT true,
    hourly_rate DECIMAL(8,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications System

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id),
    sender_id UUID REFERENCES profiles(id),
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT, -- 'project', 'task', 'equipment'
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Integration

-- WhatsApp chats table
CREATE TABLE whatsapp_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    chat_name TEXT NOT NULL,
    chat_id TEXT UNIQUE NOT NULL, -- WhatsApp group ID
    participant_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp messages table
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES whatsapp_chats(id) ON DELETE CASCADE,
    message_id TEXT UNIQUE NOT NULL, -- WhatsApp message ID
    sender_phone TEXT NOT NULL,
    sender_name TEXT,
    message_type TEXT NOT NULL, -- 'text', 'image', 'document', 'location'
    content TEXT,
    media_url TEXT,
    location GEOMETRY(POINT, 4326),
    timestamp TIMESTAMPTZ NOT NULL,
    is_processed BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logging

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout'
    entity_type TEXT NOT NULL, -- table name
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security for all new tables
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance

-- Equipment indexes
CREATE INDEX idx_equipment_organization_id ON equipment(organization_id);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_type ON equipment(type);
CREATE INDEX idx_equipment_assigned_to ON equipment(assigned_to);
CREATE INDEX idx_equipment_location ON equipment USING GIST(current_location);
CREATE INDEX idx_equipment_assignments_equipment_id ON equipment_assignments(equipment_id);
CREATE INDEX idx_equipment_assignments_project_id ON equipment_assignments(project_id);
CREATE INDEX idx_equipment_assignments_assigned_to ON equipment_assignments(assigned_to);

-- Material indexes
CREATE INDEX idx_materials_organization_id ON materials(organization_id);
CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_stock_level ON materials(current_stock);
CREATE INDEX idx_material_allocations_material_id ON material_allocations(material_id);
CREATE INDEX idx_material_allocations_project_id ON material_allocations(project_id);

-- Work area indexes
CREATE INDEX idx_work_areas_project_id ON work_areas(project_id);
CREATE INDEX idx_work_areas_status ON work_areas(status);
CREATE INDEX idx_work_areas_assigned_to ON work_areas(assigned_to);
CREATE INDEX idx_work_areas_geometry ON work_areas USING GIST(area_geometry);

-- Form indexes
CREATE INDEX idx_forms_organization_id ON forms(organization_id);
CREATE INDEX idx_forms_category ON forms(category);
CREATE INDEX idx_forms_is_active ON forms(is_active);
CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_project_id ON form_submissions(project_id);
CREATE INDEX idx_form_submissions_submitted_by ON form_submissions(submitted_by);
CREATE INDEX idx_form_submissions_location ON form_submissions USING GIST(location);

-- Document indexes
CREATE INDEX idx_documents_organization_id ON documents(organization_id);
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_is_current ON documents(is_current);

-- Time tracking indexes
CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);
CREATE INDEX idx_time_entries_location ON time_entries USING GIST(location);

-- Notification indexes
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- WhatsApp indexes
CREATE INDEX idx_whatsapp_chats_organization_id ON whatsapp_chats(organization_id);
CREATE INDEX idx_whatsapp_chats_project_id ON whatsapp_chats(project_id);
CREATE INDEX idx_whatsapp_chats_chat_id ON whatsapp_chats(chat_id);
CREATE INDEX idx_whatsapp_messages_chat_id ON whatsapp_messages(chat_id);
CREATE INDEX idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp);
CREATE INDEX idx_whatsapp_messages_location ON whatsapp_messages USING GIST(location);

-- Audit log indexes
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Add updated_at triggers for tables that need them
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_areas_updated_at BEFORE UPDATE ON work_areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_chats_updated_at BEFORE UPDATE ON whatsapp_chats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
