# 🔌 API Overview

> **RESTful API documentation for ConstructTrack platform**

ConstructTrack provides a comprehensive REST API built on Supabase with real-time capabilities, geospatial support, and role-based access control.

## 🎯 API Design Principles

### RESTful Architecture
- **Resource-based URLs**: Clear, predictable endpoint structure
- **HTTP Methods**: Standard GET, POST, PUT, DELETE operations
- **Status Codes**: Meaningful HTTP response codes
- **JSON Format**: Consistent request/response format

### Security First
- **JWT Authentication**: Stateless token-based auth
- **Row Level Security**: Database-level access control
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Comprehensive request validation

## 🔐 Authentication

### Authentication Flow

#### 1. User Login
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "manager@fibertech.com",
  "password": "SecurePassword123!"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsInJvbGUiOiJtYW5hZ2VyIiwib3JnIjoib3JnXzQ1NiIsImV4cCI6MTY0MzcyMzQwMH0.signature",
    "refresh_token": "rt_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user": {
      "id": "user_123",
      "email": "manager@fibertech.com",
      "role": "manager",
      "organization_id": "org_456",
      "profile": {
        "first_name": "John",
        "last_name": "Smith",
        "phone": "+1-555-0123"
      }
    }
  },
  "meta": {
    "timestamp": "2025-01-30T10:00:00Z",
    "version": "1.0.0"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "details": []
  },
  "meta": {
    "timestamp": "2025-01-30T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

#### 2. Using Authentication Token
```bash
# Include token in Authorization header for all authenticated requests
GET /projects
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

#### 3. Token Refresh
```bash
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "rt_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

### Authentication Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/register` | User registration |
| POST | `/auth/logout` | User logout |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/reset-password` | Password reset |

## 🏗️ API Structure

### Base URL
```
Production:  https://api.constructtrack.com/v1
Staging:     https://staging-api.constructtrack.com/v1
Development: http://localhost:3000/api/v1
```

### Standard Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "meta": {
    "timestamp": "2025-01-30T10:00:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-01-30T10:00:00Z",
    "request_id": "req_123456"
  }
}
```

## 📋 Core Resources

### Projects API

#### List Projects
```bash
GET /projects?status=active&limit=10&offset=0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj_123",
        "name": "Fiber Installation - Downtown",
        "description": "High-speed fiber installation project for downtown district",
        "status": "active",
        "priority": "high",
        "location": {
          "type": "Point",
          "coordinates": [-122.4194, 37.7749]
        },
        "start_date": "2025-02-01",
        "end_date": "2025-06-30",
        "progress": 35.5,
        "team_size": 8,
        "created_at": "2025-01-15T09:00:00Z",
        "updated_at": "2025-01-30T14:30:00Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 10,
      "offset": 0,
      "has_more": true
    }
  }
}
```

#### Get Project Details
```bash
GET /projects/proj_123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "proj_123",
    "name": "Fiber Installation - Downtown",
    "description": "High-speed fiber installation project for downtown district",
    "status": "active",
    "priority": "high",
    "location": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749],
      "address": "123 Main St, San Francisco, CA 94105"
    },
    "dates": {
      "start_date": "2025-02-01",
      "end_date": "2025-06-30",
      "estimated_completion": "2025-06-15"
    },
    "metrics": {
      "progress": 35.5,
      "tasks_completed": 12,
      "tasks_total": 34,
      "team_size": 8,
      "budget_used": 125000.00,
      "budget_total": 350000.00
    },
    "team": [
      {
        "user_id": "user_456",
        "role": "project_manager",
        "name": "Jane Doe"
      }
    ],
    "created_at": "2025-01-15T09:00:00Z",
    "updated_at": "2025-01-30T14:30:00Z"
  }
}
```

#### Create Project
```bash
POST /projects
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "Fiber Installation - Residential Area",
  "description": "Fiber optic installation for residential neighborhood",
  "location": {
    "type": "Point",
    "coordinates": [-122.4094, 37.7849],
    "address": "456 Oak Street, San Francisco, CA 94102"
  },
  "start_date": "2025-03-01",
  "end_date": "2025-08-31",
  "priority": "medium",
  "budget": 275000.00,
  "team_members": ["user_456", "user_789"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "proj_456",
    "name": "Fiber Installation - Residential Area",
    "status": "planning",
    "created_at": "2025-01-30T15:00:00Z"
  },
  "message": "Project created successfully"
}
```

#### Update Project
```bash
PUT /projects/proj_123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "status": "in_progress",
  "progress": 45.0,
  "estimated_completion": "2025-06-10"
}
```

#### Delete Project
```bash
DELETE /projects/proj_123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### Users API
```bash
# List users (admin only)
GET /users

# Get user profile
GET /users/me
GET /users/{id}

# Update user profile
PUT /users/me
PUT /users/{id}

# User role management
PUT /users/{id}/role
{
  "role": "field_worker",
  "organization_id": "org_123"
}
```

### Tasks API
```bash
# List tasks
GET /tasks
GET /tasks?project_id=proj_123&assigned_to=user_456

# Create task
POST /tasks
{
  "title": "Install fiber splice box",
  "description": "Install and configure splice box at location",
  "project_id": "proj_123",
  "assigned_to": "user_456",
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "due_date": "2025-02-15"
}

# Update task status
PUT /tasks/{id}/status
{
  "status": "completed",
  "completion_notes": "Installation completed successfully"
}
```

## 🗺️ Geospatial API

### Location-Based Queries
```bash
# Find projects near location
GET /projects/nearby?lat=37.7749&lng=-122.4194&radius=5000

# Get projects within bounds
GET /projects/bounds?ne_lat=37.8&ne_lng=-122.4&sw_lat=37.7&sw_lng=-122.5

# Geospatial search
POST /search/geospatial
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[...]]
  },
  "filters": {
    "resource_type": "projects",
    "status": "active"
  }
}
```

### Mapping Data
```bash
# Get fiber routes
GET /mapping/routes?project_id=proj_123

# Create fiber route
POST /mapping/routes
{
  "project_id": "proj_123",
  "name": "Main trunk line",
  "geometry": {
    "type": "LineString",
    "coordinates": [[-122.4194, 37.7749], [-122.4094, 37.7849]]
  },
  "properties": {
    "fiber_count": 144,
    "cable_type": "single_mode"
  }
}
```

## 📸 File Management API

### File Upload
```bash
# Upload file
POST /files/upload
Content-Type: multipart/form-data

{
  "file": <binary_data>,
  "project_id": "proj_123",
  "task_id": "task_456",
  "category": "progress_photo",
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  }
}

# Response
{
  "success": true,
  "data": {
    "file_id": "file_789",
    "url": "https://storage.constructtrack.com/files/file_789.jpg",
    "thumbnail_url": "https://storage.constructtrack.com/thumbs/file_789.jpg"
  }
}
```

### File Management
```bash
# List files
GET /files?project_id=proj_123&category=progress_photo

# Get file metadata
GET /files/{id}

# Delete file
DELETE /files/{id}
```

## 🔄 Real-time API

### WebSocket Connection
```javascript
// Connect to real-time updates
const ws = new WebSocket('wss://api.constructtrack.com/realtime');

// Subscribe to project updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'projects:proj_123',
  token: 'your_jwt_token'
}));

// Receive real-time updates
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Real-time update:', update);
};
```

### Subscription Channels
- `projects:{project_id}` - Project updates
- `tasks:{task_id}` - Task status changes
- `users:{user_id}` - User-specific notifications
- `organizations:{org_id}` - Organization-wide updates

## 📊 Analytics API

### Project Analytics
```bash
# Project progress summary
GET /analytics/projects/{id}/progress

# Team performance metrics
GET /analytics/teams/{id}/performance

# Time tracking data
GET /analytics/time-tracking?project_id=proj_123&start_date=2025-01-01
```

## 🔍 Search API

### Full-Text Search
```bash
# Search across all resources
GET /search?q=fiber+installation&type=projects,tasks

# Advanced search
POST /search/advanced
{
  "query": "fiber installation",
  "filters": {
    "project_status": ["active", "planning"],
    "date_range": {
      "start": "2025-01-01",
      "end": "2025-12-31"
    }
  },
  "sort": {
    "field": "created_at",
    "order": "desc"
  }
}
```

## 📈 Rate Limiting

### Rate Limits
| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 1 minute |
| Read Operations | 100 requests | 1 minute |
| Write Operations | 30 requests | 1 minute |
| File Uploads | 10 requests | 1 minute |

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643723400
```

## 🛠️ Error Handling

### HTTP Status Codes
| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_REQUIRED` - Valid token required
- `INSUFFICIENT_PERMISSIONS` - Access denied
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests

## 📚 API Documentation

### Interactive Documentation
- **Swagger UI**: Available at `/api/docs`
- **Postman Collection**: Download from `/api/postman`
- **OpenAPI Spec**: Available at `/api/openapi.json`

### SDK Libraries
- **JavaScript/TypeScript**: `@constructtrack/api-client`
- **React Hooks**: `@constructtrack/react-hooks`
- **React Native**: `@constructtrack/react-native-sdk`

---

**Next**: Explore specific API endpoints in [Projects API](projects.md), [Users API](users.md), and [Mapping API](mapping.md).
