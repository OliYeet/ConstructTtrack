# 🔧 Technical Architecture Deep Dive

> **Detailed technical implementation guide for ConstructTrack**

This document provides in-depth technical details about the ConstructTrack architecture,
implementation patterns, and development guidelines.

## 🏗️ Application Architecture Patterns

### 1. Monorepo Architecture

#### Structure Benefits

- **Code Sharing**: Shared packages reduce duplication
- **Consistent Tooling**: Unified linting, testing, and build processes
- **Atomic Changes**: Cross-package changes in single commits
- **Dependency Management**: Centralized package management

#### Implementation Details

```typescript
// Package structure with TypeScript path mapping
{
  "compilerOptions": {
    "paths": {
      "@constructtrack/shared/*": ["packages/shared/src/*"],
      "@constructtrack/ui/*": ["packages/ui/src/*"],
      "@constructtrack/supabase/*": ["packages/supabase/src/*"]
    }
  }
}
```

### 2. API-First Design

#### RESTful API Conventions

```typescript
// Standardized API response format
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

// Error response format
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
  timestamp: string;
}
```

#### Route Handler Pattern

```typescript
// apps/web/src/app/api/v1/[resource]/route.ts
export const GET = withAuth({ GET: handleGet }, { requireRoles: ['admin', 'manager'] });

export const POST = withAuth({ POST: handlePost }, { requireRoles: ['admin', 'manager'] });
```

### 3. Multi-Tenant Architecture

#### Organization-Based Isolation

```sql
-- Row Level Security Policy Example
CREATE POLICY "Users can only access their organization's data"
ON projects FOR ALL
USING (organization_id = auth.jwt() ->> 'organization_id');
```

#### Context Propagation

```typescript
// Middleware injects organization context
interface RequestContext {
  requestId: string;
  organizationId: string;
  userId: string;
  userRole: UserRole;
}
```

## 🗄️ Database Architecture

### 1. Schema Design Principles

#### Entity Relationships

```
Organizations (1) ──── (N) Profiles
     │
     └── (1) ──── (N) Projects
                    │
                    ├── (1) ──── (N) Fiber Routes
                    │                 │
                    │                 └── (1) ──── (N) Connections
                    │
                    ├── (1) ──── (N) Tasks
                    │
                    └── (1) ──── (N) Photos
```

#### Geospatial Data Strategy

```sql
-- PostGIS geometry types for different use cases
location GEOMETRY(POINT, 4326)        -- Single points (projects, tasks)
route_geometry GEOMETRY(LINESTRING, 4326)  -- Fiber routes
work_area GEOMETRY(POLYGON, 4326)     -- Project boundaries
```

### 2. Performance Optimization

#### Indexing Strategy

```sql
-- Composite indexes for common queries
CREATE INDEX idx_projects_org_status ON projects(organization_id, status);
CREATE INDEX idx_tasks_project_assigned ON tasks(project_id, assigned_to);

-- Spatial indexes for geospatial queries
CREATE INDEX idx_projects_location ON projects USING GIST(location);
CREATE INDEX idx_fiber_routes_geometry ON fiber_routes USING GIST(route_geometry);
```

#### Query Optimization

```typescript
// Efficient pagination with cursor-based approach
const query = supabase
  .from('projects')
  .select('*', { count: 'exact' })
  .eq('organization_id', organizationId)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

## 🔐 Security Architecture

### 1. Authentication Flow

#### JWT Token Structure

```typescript
interface JWTPayload {
  sub: string; // User ID
  email: string;
  organization_id: string;
  role: UserRole;
  iat: number;
  exp: number;
}
```

#### Authentication Middleware

```typescript
// apps/web/src/lib/api/middleware.ts
export function withAuth(handlers: RouteHandlers, options: AuthOptions = {}) {
  return async (request: NextRequest, context: RouteContext) => {
    // 1. Extract JWT from Authorization header
    // 2. Verify token with Supabase
    // 3. Extract user context
    // 4. Apply role-based access control
    // 5. Inject context into request
  };
}
```

### 2. Data Security

#### Row Level Security Policies

```sql
-- Example RLS policies for multi-tenancy
CREATE POLICY "organization_isolation" ON projects
FOR ALL USING (organization_id = auth.jwt() ->> 'organization_id');

CREATE POLICY "role_based_access" ON projects
FOR SELECT USING (
  CASE auth.jwt() ->> 'role'
    WHEN 'admin' THEN true
    WHEN 'manager' THEN true
    WHEN 'field_worker' THEN assigned_to IS NOT NULL AND assigned_to = auth.uid()
    ELSE false
  END
);
```

#### Input Validation

```typescript
// Zod schemas for request validation
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  startDate: z.string().datetime().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});
```

## 📱 Client Architecture

### 1. State Management

#### React Query for Server State

```typescript
// Custom hooks for API integration
export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsApi.list(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

#### Local State with Zustand

```typescript
// Lightweight state management for UI state
interface AppState {
  selectedProject: Project | null;
  mapView: MapViewState;
  setSelectedProject: (project: Project | null) => void;
  updateMapView: (view: Partial<MapViewState>) => void;
}

export const useAppStore = create<AppState>(set => ({
  selectedProject: null,
  mapView: { center: [0, 0], zoom: 10 },
  setSelectedProject: project => set({ selectedProject: project }),
  updateMapView: view =>
    set(state => ({
      mapView: { ...state.mapView, ...view },
    })),
}));
```

### 2. Component Architecture

#### Shared Component Library

```typescript
// packages/ui/src/components/Button.tsx
export interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ ... }) => {
  // Shared button implementation
};
```

#### Platform-Specific Implementations

```typescript
// Web: apps/web/src/components/MapView.tsx
export const MapView = () => {
  return <MapboxGL.Map {...props} />;
};

// Mobile: apps/mobile/src/components/MapView.tsx
export const MapView = () => {
  return <MapboxGL.MapView {...props} />;
};
```

## 🔄 Data Flow Architecture

### 1. Real-time Updates

#### Supabase Subscriptions

```typescript
// Real-time project updates
useEffect(() => {
  const subscription = supabase
    .channel('projects')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `organization_id=eq.${organizationId}`,
      },
      payload => {
        // Update local state
        queryClient.invalidateQueries(['projects']);
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [organizationId]);
```

### 2. Offline-First Mobile Strategy

#### Local Storage with SQLite

```typescript
// React Native offline storage
import SQLite from 'react-native-sqlite-storage';

class OfflineStorage {
  async syncToServer() {
    const pendingChanges = await this.getPendingChanges();
    for (const change of pendingChanges) {
      try {
        await this.uploadChange(change);
        await this.markAsSynced(change.id);
      } catch (error) {
        // Handle sync conflicts
        await this.handleSyncConflict(change, error);
      }
    }
  }
}
```

## 🧪 Testing Architecture

### 1. Testing Strategy

#### Unit Tests with Jest

```typescript
// API route testing
describe('/api/v1/projects', () => {
  it('should create a project with valid data', async () => {
    const response = await POST(
      new Request('http://localhost/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
        headers: { Authorization: `Bearer ${validToken}` },
      })
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

#### Integration Tests

```typescript
// Database integration testing
describe('Project CRUD operations', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  it('should enforce organization isolation', async () => {
    // Test RLS policies
  });
});
```

### 2. End-to-End Testing

#### Playwright for Web

```typescript
// E2E testing for critical user flows
test('project creation flow', async ({ page }) => {
  await page.goto('/projects');
  await page.click('[data-testid="create-project"]');
  await page.fill('[name="name"]', 'Test Project');
  await page.click('[type="submit"]');

  await expect(page.locator('.success-message')).toBeVisible();
});
```

---

**Next**: See [API Documentation](../api/api-overview.md) for detailed endpoint specifications.
