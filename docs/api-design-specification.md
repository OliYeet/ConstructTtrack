# 🚀 ConstructTrack API Design Specification

> **Fiber Optic Installation Management Platform API**

📅 **Last Updated**: January 2025  
🎯 **Epic**: 0.75 - Technical Infrastructure & Integrations  
📖 **Story**: 0.75.1 - API Design & Documentation Foundation

---

## 📋 Overview

This document defines the RESTful API specification for ConstructTrack, a fiber optic installation
management platform. The API follows REST principles, implements comprehensive security, and
supports real-time features for field operations.

### 🎯 Design Principles

- **Security First**: All endpoints protected by RLS and role-based access
- **Mobile Optimized**: Designed for field workers using mobile devices
- **Offline Capable**: Support for offline-first operations with sync
- **Fiber Industry Focused**: Specialized endpoints for fiber optic workflows
- **Multi-tenant**: Organization-based data isolation

---

## 🔐 Authentication & Authorization

### Authentication Flow

```
1. User login → JWT token with organization_id and role
2. Token includes: { user_id, organization_id, role, exp }
3. All API requests require Authorization: Bearer <token>
4. Supabase RLS enforces organization isolation automatically
```

### User Roles & Permissions

| Role             | Permissions                                       |
| ---------------- | ------------------------------------------------- |
| **admin**        | Full access to organization data, user management |
| **manager**      | Project management, team oversight, reporting     |
| **field_worker** | Assigned tasks, photo uploads, form submissions   |
| **customer**     | View project status, agreements, limited access   |

---

## 📊 Core API Endpoints

### 🏢 Organizations

```http
GET    /api/v1/organizations/current
PUT    /api/v1/organizations/current
```

### 👥 User Management

```http
GET    /api/v1/users                    # List organization users
POST   /api/v1/users                    # Create user (admin/manager)
GET    /api/v1/users/{id}               # Get user details
PUT    /api/v1/users/{id}               # Update user
DELETE /api/v1/users/{id}               # Deactivate user
GET    /api/v1/users/me                 # Current user profile
PUT    /api/v1/users/me                 # Update own profile
```

### 📋 Project Management

```http
GET    /api/v1/projects                 # List projects
POST   /api/v1/projects                 # Create project
GET    /api/v1/projects/{id}            # Get project details
PUT    /api/v1/projects/{id}            # Update project
DELETE /api/v1/projects/{id}            # Delete project
GET    /api/v1/projects/{id}/summary    # Project summary with stats
```

### 🗺️ Fiber Network Management

```http
# Fiber Routes
GET    /api/v1/projects/{id}/fiber-routes
POST   /api/v1/projects/{id}/fiber-routes
GET    /api/v1/fiber-routes/{id}
PUT    /api/v1/fiber-routes/{id}
DELETE /api/v1/fiber-routes/{id}

# Fiber Connections
GET    /api/v1/fiber-routes/{id}/connections
POST   /api/v1/fiber-routes/{id}/connections
GET    /api/v1/fiber-connections/{id}
PUT    /api/v1/fiber-connections/{id}
DELETE /api/v1/fiber-connections/{id}

# Geospatial Queries
GET    /api/v1/fiber-routes/within-bounds?bbox={bbox}
GET    /api/v1/fiber-routes/near-point?lat={lat}&lng={lng}&radius={radius}
```

### ✅ Task Management

```http
GET    /api/v1/projects/{id}/tasks      # Project tasks
GET    /api/v1/tasks/assigned           # My assigned tasks
POST   /api/v1/tasks                    # Create task
GET    /api/v1/tasks/{id}               # Task details
PUT    /api/v1/tasks/{id}               # Update task
DELETE /api/v1/tasks/{id}               # Delete task
PUT    /api/v1/tasks/{id}/status        # Update task status
```

### 📸 Photo & Media Management

```http
GET    /api/v1/projects/{id}/photos     # Project photos
POST   /api/v1/photos                   # Upload photo
GET    /api/v1/photos/{id}              # Photo details
DELETE /api/v1/photos/{id}              # Delete photo
POST   /api/v1/photos/bulk-upload       # Bulk photo upload
GET    /api/v1/photos/by-location       # Photos by GPS coordinates
```

### 📋 Forms & Documentation

```http
GET    /api/v1/forms                    # Available forms
POST   /api/v1/forms                    # Create form template
GET    /api/v1/forms/{id}               # Form details
PUT    /api/v1/forms/{id}               # Update form
POST   /api/v1/forms/{id}/submit        # Submit form data
GET    /api/v1/form-submissions         # Form submissions
GET    /api/v1/form-submissions/{id}    # Submission details
```

### 🔧 Equipment & Materials

```http
GET    /api/v1/equipment                # Equipment list
POST   /api/v1/equipment                # Add equipment
GET    /api/v1/equipment/{id}           # Equipment details
PUT    /api/v1/equipment/{id}           # Update equipment
GET    /api/v1/equipment/available      # Available equipment
POST   /api/v1/equipment/{id}/assign    # Assign equipment

GET    /api/v1/materials                # Materials inventory
POST   /api/v1/materials                # Add material
GET    /api/v1/materials/{id}           # Material details
PUT    /api/v1/materials/{id}           # Update material
POST   /api/v1/materials/{id}/allocate  # Allocate material
```

---

## 🌐 Real-time Features

### WebSocket Endpoints

```
ws://api.constructtrack.com/ws/projects/{id}     # Project updates
ws://api.constructtrack.com/ws/tasks/{id}        # Task updates
ws://api.constructtrack.com/ws/notifications     # User notifications
```

### Supabase Real-time Subscriptions

```javascript
// Subscribe to project changes
supabase
  .channel('project-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'projects',
      filter: `organization_id=eq.${orgId}`,
    },
    handleProjectChange
  )
  .subscribe();

// Subscribe to task assignments
supabase
  .channel('task-assignments')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'tasks',
      filter: `assigned_to=eq.${userId}`,
    },
    handleTaskUpdate
  )
  .subscribe();
```

---

## 📱 Mobile-Specific Endpoints

### Offline Sync

```http
POST   /api/v1/sync/upload              # Upload offline data
GET    /api/v1/sync/download            # Download updates
GET    /api/v1/sync/status              # Sync status
```

### Field Operations

```http
GET    /api/v1/field/my-tasks           # Today's assigned tasks
POST   /api/v1/field/check-in           # Check in to work area
POST   /api/v1/field/check-out          # Check out of work area
GET    /api/v1/field/nearby-assets      # Nearby fiber assets
POST   /api/v1/field/emergency-report   # Emergency reporting
```

---

## 🔍 Query Parameters & Filtering

### Standard Query Parameters

| Parameter | Description                | Example                      |
| --------- | -------------------------- | ---------------------------- |
| `limit`   | Results per page (max 100) | `?limit=20`                  |
| `offset`  | Pagination offset          | `?offset=40`                 |
| `sort`    | Sort field and direction   | `?sort=created_at:desc`      |
| `filter`  | Field filtering            | `?filter=status:eq:active`   |
| `search`  | Text search                | `?search=fiber installation` |
| `include` | Related data to include    | `?include=tasks,photos`      |

### Geospatial Parameters

| Parameter | Description            | Example                         |
| --------- | ---------------------- | ------------------------------- |
| `bbox`    | Bounding box           | `?bbox=-122.4,37.7,-122.3,37.8` |
| `near`    | Near point with radius | `?near=-122.4,37.7&radius=1000` |
| `within`  | Within polygon         | `?within=POLYGON(...)`          |

---

## 📊 Response Formats

### Standard Response Structure

```json
{
  "data": [...],           // Response data
  "meta": {
    "total": 150,          // Total records
    "count": 20,           // Records in response
    "page": 1,             // Current page
    "pages": 8             // Total pages
  },
  "links": {
    "self": "/api/v1/projects?page=1",
    "next": "/api/v1/projects?page=2",
    "prev": null,
    "first": "/api/v1/projects?page=1",
    "last": "/api/v1/projects?page=8"
  }
}
```

### Error Response Structure

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "request_id": "req_123456789"
  }
}
```

---

## 🚀 Next Steps

### Immediate Implementation Tasks

1. **✅ Set up OpenAPI/Swagger documentation**
2. **✅ Implement API authentication middleware**
3. **✅ Create API versioning strategy**
4. **✅ Set up API rate limiting and throttling**
5. **✅ Implement API monitoring and metrics**

### Story 0.75.1 Completion Criteria

- [ ] RESTful API specification documented
- [ ] OpenAPI/Swagger documentation generated
- [ ] API authentication middleware implemented
- [ ] Rate limiting configured
- [ ] API versioning strategy defined
- [ ] Contract testing framework set up
- [ ] API monitoring dashboard created
- [ ] Request/response logging implemented
- [ ] Security headers configured
- [ ] Caching strategies defined

---

📝 **Note**: This specification will be implemented incrementally as part of Epic 0.75 stories. Each
endpoint will be thoroughly tested and documented before moving to the next phase.
