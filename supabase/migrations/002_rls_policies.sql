-- ConstructTrack Row Level Security Policies
-- Multi-tenant security with organization-based isolation

-- Helper function to get current user's organization
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'admin' FROM profiles WHERE id = auth.uid();
$$;

-- Helper function to check if user is manager or admin
CREATE OR REPLACE FUNCTION auth.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role IN ('admin', 'manager') FROM profiles WHERE id = auth.uid();
$$;

-- Organizations policies
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (id = auth.user_organization_id());

CREATE POLICY "Admins can update their organization" ON organizations
  FOR UPDATE USING (id = auth.user_organization_id() AND auth.is_admin());

-- Profiles policies
CREATE POLICY "Users can view profiles in their organization" ON profiles
  FOR SELECT USING (organization_id = auth.user_organization_id());

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles in their organization" ON profiles
  FOR INSERT WITH CHECK (organization_id = auth.user_organization_id() AND auth.is_admin());

CREATE POLICY "Admins can update profiles in their organization" ON profiles
  FOR UPDATE USING (organization_id = auth.user_organization_id() AND auth.is_admin());

-- Projects policies
CREATE POLICY "Users can view projects in their organization" ON projects
  FOR SELECT USING (organization_id = auth.user_organization_id());

CREATE POLICY "Managers can insert projects in their organization" ON projects
  FOR INSERT WITH CHECK (organization_id = auth.user_organization_id() AND auth.is_manager_or_admin());

CREATE POLICY "Managers can update projects in their organization" ON projects
  FOR UPDATE USING (organization_id = auth.user_organization_id() AND auth.is_manager_or_admin());

CREATE POLICY "Project managers can update their assigned projects" ON projects
  FOR UPDATE USING (manager_id = auth.uid());

-- Fiber routes policies
CREATE POLICY "Users can view fiber routes in their organization projects" ON fiber_routes
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Managers can insert fiber routes in their organization projects" ON fiber_routes
  FOR INSERT WITH CHECK (
    auth.is_manager_or_admin() AND
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Managers can update fiber routes in their organization projects" ON fiber_routes
  FOR UPDATE USING (
    auth.is_manager_or_admin() AND
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Field workers can update fiber routes in assigned projects" ON fiber_routes
  FOR UPDATE USING (
    project_id IN (
      SELECT DISTINCT t.project_id FROM tasks t WHERE t.assigned_to = auth.uid()
    )
  );

-- Fiber connections policies
CREATE POLICY "Users can view fiber connections in their organization" ON fiber_connections
  FOR SELECT USING (
    route_id IN (
      SELECT fr.id FROM fiber_routes fr
      JOIN projects p ON fr.project_id = p.id
      WHERE p.organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Managers can insert fiber connections" ON fiber_connections
  FOR INSERT WITH CHECK (
    auth.is_manager_or_admin() AND
    route_id IN (
      SELECT fr.id FROM fiber_routes fr
      JOIN projects p ON fr.project_id = p.id
      WHERE p.organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Field workers can update fiber connections in assigned routes" ON fiber_connections
  FOR UPDATE USING (
    route_id IN (
      SELECT fr.id FROM fiber_routes fr
      JOIN tasks t ON fr.id = t.route_id
      WHERE t.assigned_to = auth.uid()
    )
  );

-- Tasks policies
CREATE POLICY "Users can view tasks in their organization projects" ON tasks
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Managers can insert tasks in their organization projects" ON tasks
  FOR INSERT WITH CHECK (
    auth.is_manager_or_admin() AND
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Managers can update tasks in their organization projects" ON tasks
  FOR UPDATE USING (
    auth.is_manager_or_admin() AND
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Users can update their assigned tasks" ON tasks
  FOR UPDATE USING (assigned_to = auth.uid());

-- Photos policies
CREATE POLICY "Users can view photos in their organization projects" ON photos
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Users can insert photos in their organization projects" ON photos
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Users can update their own photos" ON photos
  FOR UPDATE USING (uploaded_by = auth.uid());

-- Customer agreements policies
CREATE POLICY "Users can view customer agreements in their organization projects" ON customer_agreements
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Managers can insert customer agreements" ON customer_agreements
  FOR INSERT WITH CHECK (
    auth.is_manager_or_admin() AND
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Managers can update customer agreements" ON customer_agreements
  FOR UPDATE USING (
    auth.is_manager_or_admin() AND
    project_id IN (
      SELECT id FROM projects WHERE organization_id = auth.user_organization_id()
    )
  );

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger to automatically create profile on user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
