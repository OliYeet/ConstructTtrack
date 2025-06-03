# 🗄️ ConstructTrack Database Schema Design

> **Comprehensive database schema for the Fiber Optic Installation Management Platform**

## 📋 Overview

This document outlines the complete database schema design for ConstructTrack, extending the initial
schema to support all platform features including equipment management, work areas, forms, document
management, and advanced fiber infrastructure.

## 🏗️ Schema Architecture

### Core Design Principles

1. **Multi-tenancy**: Organization-based data isolation using Row Level Security (RLS)
2. **Geospatial Support**: PostGIS integration for mapping and location features
3. **Audit Trail**: Comprehensive tracking of all data changes
4. **Scalability**: Optimized indexes and query patterns
5. **Flexibility**: JSONB metadata fields for extensibility

### Entity Relationship Overview

```
Organizations (1) ──── (N) Profiles
     │
     ├── (1) ──── (N) Projects
     │                │
     │                ├── (1) ──── (N) Fiber Routes ──── (N) Connections
     │                ├── (1) ──── (N) Tasks
     │                ├── (1) ──── (N) Work Areas
     │                ├── (1) ──── (N) Photos
     │                ├── (1) ──── (N) Customer Agreements
     │                ├── (1) ──── (N) Documents
     │                └── (1) ──── (N) Time Entries
     │
     ├── (1) ──── (N) Equipment
     ├── (1) ──── (N) Materials
     ├── (1) ──── (N) Forms
     ├── (1) ──── (N) Notifications
     └── (1) ──── (N) Audit Logs
```

## 📊 Core Tables (Existing)

### Organizations

- **Purpose**: Multi-tenant organization management
- **Key Features**: Unique slugs, settings JSONB, contact information

### Profiles

- **Purpose**: User management extending Supabase auth.users
- **Key Features**: Role-based access, organization association, metadata

### Projects

- **Purpose**: Main project entity with geospatial location
- **Key Features**: Status tracking, budget management, customer info, GPS location

### Fiber Routes

- **Purpose**: Fiber optic cable route management
- **Key Features**: PostGIS geometry, fiber types, installation tracking

### Fiber Connections

- **Purpose**: Connection points and equipment along routes
- **Key Features**: Connection types, test results, equipment tracking

### Tasks

- **Purpose**: Work item management and assignment
- **Key Features**: Priority levels, time tracking, location-based

### Photos

- **Purpose**: Documentation and progress tracking
- **Key Features**: GPS-tagged, multi-entity association, metadata

### Customer Agreements

- **Purpose**: Legal documentation and signatures
- **Key Features**: Digital signatures, document storage, agreement types

## 🔧 Extended Tables (New)

### Equipment Management

#### Equipment

```sql
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
```

#### Equipment Assignments

```sql
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
```

### Material Management

#### Materials

```sql
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
```

#### Material Allocations

```sql
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
```

### Work Area Management

#### Work Areas

```sql
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
```

### Forms and Custom Fields

#### Forms

```sql
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
```

#### Form Submissions

```sql
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
```

## 🔍 Additional Enums

```sql
CREATE TYPE equipment_status AS ENUM ('available', 'in_use', 'maintenance', 'retired');
CREATE TYPE work_area_status AS ENUM ('planned', 'in_progress', 'completed', 'blocked');
CREATE TYPE notification_type AS ENUM ('task_assigned', 'project_update', 'equipment_due', 'form_required');
CREATE TYPE document_type AS ENUM ('drawing', 'permit', 'contract', 'report', 'photo', 'other');
```

## 📈 Performance Optimization

### Indexes

```sql
-- Equipment indexes
CREATE INDEX idx_equipment_organization_id ON equipment(organization_id);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_type ON equipment(type);
CREATE INDEX idx_equipment_location ON equipment USING GIST(current_location);

-- Material indexes
CREATE INDEX idx_materials_organization_id ON materials(organization_id);
CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_material_allocations_project_id ON material_allocations(project_id);

-- Work area indexes
CREATE INDEX idx_work_areas_project_id ON work_areas(project_id);
CREATE INDEX idx_work_areas_geometry ON work_areas USING GIST(area_geometry);
CREATE INDEX idx_work_areas_status ON work_areas(status);

-- Form indexes
CREATE INDEX idx_forms_organization_id ON forms(organization_id);
CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_project_id ON form_submissions(project_id);
```

### Document Management

#### Documents

```sql
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
```

### Time Tracking

#### Time Entries

```sql
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
```

### Notifications System

#### Notifications

```sql
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
```

### WhatsApp Integration

#### WhatsApp Chats

```sql
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
```

#### WhatsApp Messages

```sql
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
```

### Audit Logging

#### Audit Logs

```sql
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
```

## 🔐 Security Considerations

### Row Level Security Policies

All tables implement organization-based RLS policies to ensure multi-tenant data isolation.

### Audit Trail

Comprehensive audit logging for all data modifications with user attribution and timestamps.

### Data Encryption

Sensitive data encrypted at rest with AES-256, TLS 1.3 for data in transit.

## 🔄 Migration Strategy

### Phase 1: Core Extensions

- Equipment and material management
- Work areas and geofencing
- Basic forms system

### Phase 2: Advanced Features

- Document management
- Time tracking
- Notifications system

### Phase 3: Integrations

- WhatsApp integration
- Advanced audit logging
- Performance optimizations

## 📊 Estimated Storage Requirements

- **Small Organization** (1-10 projects): ~1-5 GB
- **Medium Organization** (10-50 projects): ~5-25 GB
- **Large Organization** (50+ projects): ~25-100+ GB

Storage primarily driven by photos, documents, and geospatial data.
