-- Core RLS Policies Migration
-- Implements missing RLS policies for core tables: organizations, profiles, projects, 
-- fiber_routes, fiber_connections, tasks, photos, customer_agreements

-- =============================================================================
-- ORGANIZATIONS RLS POLICIES
-- =============================================================================

-- Organizations: Users can only see their own organization
CREATE POLICY "organizations_own_organization_only" ON organizations
FOR SELECT USING (id = auth.user_organization_id());

-- Organizations: Only admins can update organization details
CREATE POLICY "organizations_admin_update" ON organizations
FOR UPDATE USING (
  id = auth.user_organization_id() 
  AND auth.user_role() = 'admin'
);

-- =============================================================================
-- PROFILES RLS POLICIES  
-- =============================================================================

-- Profiles: Organization isolation
CREATE POLICY "profiles_organization_isolation" ON profiles
FOR ALL USING (organization_id = auth.user_organization_id());

-- Profiles: Users can always see their own profile
CREATE POLICY "profiles_own_profile_access" ON profiles
FOR SELECT USING (id = auth.uid());

-- Profiles: Users can update their own profile (limited fields)
CREATE POLICY "profiles_own_profile_update" ON profiles
FOR UPDATE USING (id = auth.uid());

-- Profiles: Only admins and managers can create/delete profiles
CREATE POLICY "profiles_admin_manager_create" ON profiles
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "profiles_admin_delete" ON profiles
FOR DELETE USING (
  auth.user_role() = 'admin'
  AND organization_id = auth.user_organization_id()
  AND id != auth.uid() -- Can't delete own profile
);

-- =============================================================================
-- PROJECTS RLS POLICIES
-- =============================================================================

-- Projects: Organization isolation
CREATE POLICY "projects_organization_isolation" ON projects
FOR ALL USING (organization_id = auth.user_organization_id());

-- Projects: Role-based access for creation/modification
CREATE POLICY "projects_admin_manager_create" ON projects
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "projects_admin_manager_update" ON projects
FOR UPDATE USING (
  auth.user_role() IN ('admin', 'manager')
  AND organization_id = auth.user_organization_id()
);

CREATE POLICY "projects_admin_delete" ON projects
FOR DELETE USING (
  auth.user_role() = 'admin'
  AND organization_id = auth.user_organization_id()
);

-- Projects: Field workers can see projects they're assigned to
CREATE POLICY "projects_field_worker_assigned" ON projects
FOR SELECT USING (
  CASE auth.user_role()
    WHEN 'field_worker' THEN 
      EXISTS (
        SELECT 1 FROM tasks t 
        WHERE t.project_id = projects.id 
        AND t.assigned_to = auth.uid()
      )
    ELSE true -- admins and managers see all
  END
  AND organization_id = auth.user_organization_id()
);

-- =============================================================================
-- FIBER_ROUTES RLS POLICIES
-- =============================================================================

-- Fiber routes: Organization isolation via projects
CREATE POLICY "fiber_routes_organization_isolation" ON fiber_routes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = fiber_routes.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Fiber routes: Role-based creation/modification
CREATE POLICY "fiber_routes_admin_manager_create" ON fiber_routes
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = fiber_routes.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

CREATE POLICY "fiber_routes_admin_manager_update" ON fiber_routes
FOR UPDATE USING (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = fiber_routes.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

CREATE POLICY "fiber_routes_admin_delete" ON fiber_routes
FOR DELETE USING (
  auth.user_role() = 'admin'
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = fiber_routes.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- =============================================================================
-- FIBER_CONNECTIONS RLS POLICIES
-- =============================================================================

-- Fiber connections: Organization isolation via fiber routes
CREATE POLICY "fiber_connections_organization_isolation" ON fiber_connections
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM fiber_routes fr
    JOIN projects p ON p.id = fr.project_id
    WHERE fr.id = fiber_connections.route_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Fiber connections: Role-based creation/modification
CREATE POLICY "fiber_connections_admin_manager_create" ON fiber_connections
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM fiber_routes fr
    JOIN projects p ON p.id = fr.project_id
    WHERE fr.id = fiber_connections.route_id
    AND p.organization_id = auth.user_organization_id()
  )
);

CREATE POLICY "fiber_connections_admin_manager_update" ON fiber_connections
FOR UPDATE USING (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM fiber_routes fr
    JOIN projects p ON p.id = fr.project_id
    WHERE fr.id = fiber_connections.route_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- =============================================================================
-- TASKS RLS POLICIES
-- =============================================================================

-- Tasks: Organization isolation via projects
CREATE POLICY "tasks_organization_isolation" ON tasks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = tasks.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Tasks: Role-based access for viewing
CREATE POLICY "tasks_role_based_select" ON tasks
FOR SELECT USING (
  CASE auth.user_role()
    WHEN 'field_worker' THEN 
      assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM projects p
        JOIN tasks t ON t.project_id = p.id
        WHERE t.id = tasks.id
        AND p.manager_id = auth.uid()
      )
    WHEN 'admin' THEN true
    WHEN 'manager' THEN true
    ELSE false
  END
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = tasks.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Tasks: Field workers can update their assigned tasks
CREATE POLICY "tasks_field_worker_update_assigned" ON tasks
FOR UPDATE USING (
  assigned_to = auth.uid()
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = tasks.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Tasks: Admins and managers can create/update/delete tasks
CREATE POLICY "tasks_admin_manager_create" ON tasks
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = tasks.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

CREATE POLICY "tasks_admin_manager_update" ON tasks
FOR UPDATE USING (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = tasks.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

CREATE POLICY "tasks_admin_manager_delete" ON tasks
FOR DELETE USING (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = tasks.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- =============================================================================
-- PHOTOS RLS POLICIES
-- =============================================================================

-- Photos: Organization isolation via projects
CREATE POLICY "photos_organization_isolation" ON photos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = photos.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Photos: Field workers can create photos for their assigned tasks
CREATE POLICY "photos_field_worker_create" ON photos
FOR INSERT WITH CHECK (
  (
    auth.user_role() = 'field_worker' 
    AND (
      uploaded_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = photos.task_id
        AND t.assigned_to = auth.uid()
      )
    )
  ) OR 
  auth.user_role() IN ('admin', 'manager')
);

-- Photos: Role-based deletion
CREATE POLICY "photos_role_based_delete" ON photos
FOR DELETE USING (
  CASE auth.user_role()
    WHEN 'field_worker' THEN uploaded_by = auth.uid()
    WHEN 'admin' THEN true
    WHEN 'manager' THEN true
    ELSE false
  END
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = photos.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- =============================================================================
-- CUSTOMER_AGREEMENTS RLS POLICIES
-- =============================================================================

-- Customer agreements: Organization isolation via projects
CREATE POLICY "customer_agreements_organization_isolation" ON customer_agreements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = customer_agreements.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Customer agreements: Only admins and managers can create/modify
CREATE POLICY "customer_agreements_admin_manager_create" ON customer_agreements
FOR INSERT WITH CHECK (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = customer_agreements.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

CREATE POLICY "customer_agreements_admin_manager_update" ON customer_agreements
FOR UPDATE USING (
  auth.user_role() IN ('admin', 'manager')
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = customer_agreements.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);

-- Customer agreements: Field workers can view agreements for their assigned projects
CREATE POLICY "customer_agreements_field_worker_view" ON customer_agreements
FOR SELECT USING (
  CASE auth.user_role()
    WHEN 'field_worker' THEN 
      EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.assigned_to = auth.uid()
        AND p.id = customer_agreements.project_id
      )
    ELSE true
  END
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = customer_agreements.project_id
    AND p.organization_id = auth.user_organization_id()
  )
);
