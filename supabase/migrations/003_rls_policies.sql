-- ConstructTrack Row Level Security Policies
-- Implements organization-based multi-tenancy and role-based access control

-- Helper function to get user's organization ID from JWT
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'organization_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role from JWT
CREATE OR REPLACE FUNCTION auth.user_role()
 RETURNS TEXT AS $$
 BEGIN
  -- Execute in a strictly-qualified context without mutating caller GUCs
  RETURN (SELECT auth.jwt() ->> 'role');
 END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Equipment RLS Policies

-- Enable RLS on equipment table
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment FORCE ROW LEVEL SECURITY;

-- Equipment: Organization isolation
CREATE POLICY "equipment_organization_isolation" ON equipment
FOR ALL USING (organization_id = auth.user_organization_id());

-- Equipment assignments: Organization isolation via equipment
CREATE POLICY "equipment_assignments_organization_isolation" ON equipment_assignments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM equipment e
    WHERE e.id = equipment_assignments.equipment_id
    AND e.organization_id = auth.user_organization_id()
  )
);

-- Equipment assignments: INSERT policy
CREATE POLICY "equipment_assignments_insert_check" ON equipment_assignments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM equipment e
    WHERE e.id = equipment_assignments.equipment_id
    AND e.organization_id = auth.user_organization_id()
  )
);

-- Materials RLS Policies

-- Materials: Organization isolation
CREATE POLICY "materials_organization_isolation" ON materials
FOR ALL USING (organization_id = auth.user_organization_id());

-- Material allocations: Organization isolation via materials
CREATE POLICY "material_allocations_organization_isolation" ON material_allocations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM materials m
    WHERE m.id = material_allocations.material_id
    AND m.organization_id = auth.user_organization_id()
  )
);

-- Material allocations: INSERT policy
CREATE POLICY "material_allocations_insert_check" ON material_allocations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM materials m
    WHERE m.id = material_allocations.material_id
    AND m.organization_id = auth.user_organization_id()
  )
);

-- Work Areas RLS Policies

-- Work areas: Organization isolation via projects
CREATE POLICY "work_areas_organization_isolation" ON work_areas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = work_areas.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Work areas: INSERT policy
CREATE POLICY "work_areas_insert_check" ON work_areas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = work_areas.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Forms RLS Policies

-- Forms: Organization isolation
CREATE POLICY "forms_organization_isolation" ON forms
FOR ALL USING (organization_id = auth.user_organization_id());

-- Form submissions: Organization isolation via forms
CREATE POLICY "form_submissions_organization_isolation" ON form_submissions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = form_submissions.form_id
    AND f.organization_id = auth.user_organization_id()
  )
);

-- Form submissions: INSERT policy
CREATE POLICY "form_submissions_insert_check" ON form_submissions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms f
    WHERE f.id = form_submissions.form_id
    AND f.organization_id = auth.user_organization_id()
  )
);

-- Documents RLS Policies

-- Documents: Organization isolation
CREATE POLICY "documents_organization_isolation" ON documents
FOR ALL USING (organization_id = auth.user_organization_id());

-- Time Entries RLS Policies

-- Time entries: Organization isolation via projects
CREATE POLICY "time_entries_organization_isolation" ON time_entries
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = time_entries.project_id 
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Time entries: Field workers can only see their own entries
CREATE POLICY "time_entries_field_worker_own_only" ON time_entries
FOR SELECT USING (
  CASE auth.user_role()
    WHEN 'field_worker' THEN user_id = auth.uid()
    WHEN 'admin'        THEN true
    WHEN 'manager'      THEN true
    ELSE false
  END
);

-- Notifications RLS Policies

-- Notifications: Organization isolation
CREATE POLICY "notifications_organization_isolation" ON notifications
FOR INSERT, UPDATE, DELETE
USING (organization_id = auth.user_organization_id());

CREATE POLICY "notifications_select_org_and_recipient" ON notifications
FOR SELECT USING (
  organization_id = auth.user_organization_id()
  AND recipient_id = auth.uid()
);
-- Notifications: Only admins and managers can create notifications
CREATE POLICY "notifications_create_admin_manager" ON notifications
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

-- WhatsApp RLS Policies

-- WhatsApp chats: Organization isolation
CREATE POLICY "whatsapp_chats_organization_isolation" ON whatsapp_chats
FOR ALL USING (organization_id = auth.user_organization_id());

-- WhatsApp messages: Organization isolation via chats
CREATE POLICY "whatsapp_messages_organization_isolation" ON whatsapp_messages
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM whatsapp_chats wc
    WHERE wc.id = whatsapp_messages.chat_id
    AND wc.organization_id = auth.user_organization_id()
  )
);

-- WhatsApp messages: INSERT policy
CREATE POLICY "whatsapp_messages_insert_check" ON whatsapp_messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM whatsapp_chats wc
    WHERE wc.id = whatsapp_messages.chat_id
    AND wc.organization_id = auth.user_organization_id()
  )
);

-- Audit Logs RLS Policies

-- Audit logs: Organization isolation
CREATE POLICY "audit_logs_organization_isolation" ON audit_logs
FOR ALL USING (organization_id = auth.user_organization_id());

-- Audit logs: Only admins can view audit logs
CREATE POLICY "audit_logs_admin_only" ON audit_logs
FOR SELECT USING (auth.user_role() = 'admin');

-- Audit logs: System can insert (no user restriction)
CREATE POLICY "audit_logs_system_insert" ON audit_logs
FOR INSERT WITH CHECK (organization_id = auth.user_organization_id());

-- Role-based access policies for sensitive operations

-- Equipment: Only admins and managers can create/update/delete (with organization check)
CREATE POLICY "equipment_admin_manager_modify" ON equipment
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "equipment_admin_manager_update" ON equipment
FOR UPDATE USING (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "equipment_admin_manager_delete" ON equipment
FOR DELETE USING (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

-- Materials: Only admins and managers can create/update/delete (with organization check)
CREATE POLICY "materials_admin_manager_modify" ON materials
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "materials_admin_manager_update" ON materials
FOR UPDATE USING (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "materials_admin_manager_delete" ON materials
FOR DELETE USING (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

-- Forms: Only admins and managers can create/update/delete forms (with organization check)
CREATE POLICY "forms_admin_manager_create" ON forms
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "forms_admin_manager_update" ON forms
FOR UPDATE USING (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "forms_admin_manager_delete" ON forms
FOR DELETE USING (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

-- Documents: Role-based access
CREATE POLICY "documents_role_based_access" ON documents
FOR SELECT USING (
  CASE auth.user_role()
    WHEN 'admin' THEN true
    WHEN 'manager' THEN true
    WHEN 'field_worker' THEN 
      -- Field workers can only see documents for their assigned projects
      EXISTS (
        SELECT 1 FROM tasks t 
        WHERE t.project_id = documents.project_id 
        AND t.assigned_to = auth.uid()
      )
    ELSE false
  END
);

-- Function to automatically set organization_id from user's JWT
CREATE OR REPLACE FUNCTION set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := auth.user_organization_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers to automatically set organization_id on insert
CREATE TRIGGER set_equipment_organization_id
  BEFORE INSERT ON equipment
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_materials_organization_id
  BEFORE INSERT ON materials
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_forms_organization_id
  BEFORE INSERT ON forms
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_documents_organization_id
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_notifications_organization_id
  BEFORE INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_whatsapp_chats_organization_id
  BEFORE INSERT ON whatsapp_chats
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_audit_logs_organization_id
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();
