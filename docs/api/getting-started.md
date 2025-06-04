# 🚀 Getting Started with ConstructTrack API

This guide will walk you through the basics of using the ConstructTrack API, from authentication to
making your first API calls.

## Prerequisites

- Basic understanding of REST APIs
- A tool for making HTTP requests (curl, Postman, or similar)
- ConstructTrack account (for production) or local development environment

## Step 1: Environment Setup

### Development Environment

If you're running the API locally:

```bash
# Clone the repository
git clone https://github.com/constructtrack/api.git
cd constructtrack-api

# Install dependencies
npm install

# Start the development server
npm run dev
```

The API will be available at `http://localhost:3001/api/v1`

### Production Environment

The production API is available at:

```
https://api.constructtrack.com/v1
```

## Step 2: Verify API Connectivity

Test that the API is accessible with the health check endpoint:

```bash
curl http://localhost:3001/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "services": {
      "api": "healthy",
      "database": "healthy"
    },
    "uptime": 86400
  },
  "message": "System is healthy",
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "requestId": "req_1234567890_abc123"
  }
}
```

## Step 3: Test Basic Functionality

Try the test endpoint to verify request/response handling:

```bash
# GET request
curl http://localhost:3001/api/v1/test

# POST request with data
curl -X POST http://localhost:3001/api/v1/test \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello ConstructTrack API!",
    "data": {
      "test": true,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'
```

## Step 4: Authentication (Coming Soon)

> **Note**: Authentication is currently being implemented. For now, most endpoints return a "not
> implemented" response.

Once authentication is available, you'll follow this process:

### 1. Register or Login

```bash
# Register a new user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123",
    "fullName": "John Doe",
    "role": "field_worker"
  }'

# Login to get a JWT token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

### 2. Use the JWT Token

```bash
# Store the token from login response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Use token in subsequent requests
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/v1/projects
```

## Step 5: Working with Projects

### Create a Project

```bash
curl -X POST http://localhost:3001/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fiber Installation - Downtown District",
    "description": "Installation of fiber optic cables in the downtown business district",
    "startDate": "2024-01-15T09:00:00Z",
    "endDate": "2024-03-15T17:00:00Z",
    "budget": 50000.00,
    "customerName": "Downtown Business Association",
    "customerEmail": "contact@downtownbiz.com",
    "customerPhone": "+1-555-123-4567",
    "customerAddress": "123 Main St, Downtown, NY 10001",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }'
```

### List Projects

```bash
# Get all projects
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/v1/projects

# Get projects with pagination and filtering
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:3001/api/v1/projects?page=1&limit=10&status=in_progress&sortBy=name&sortOrder=asc"
```

### Get a Specific Project

```bash
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/v1/projects/PROJECT_ID
```

### Update a Project

```bash
curl -X PUT http://localhost:3001/api/v1/projects/PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "description": "Project completed successfully with all fiber cables installed"
  }'
```

## Step 6: Working with Tasks

### Create a Task

```bash
curl -X POST http://localhost:3001/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_ID",
    "title": "Install fiber cable on Main Street",
    "description": "Install 500m of fiber optic cable from junction box A to junction box B",
    "priority": 3,
    "dueDate": "2024-01-20T17:00:00Z",
    "estimatedHours": 8,
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }'
```

### List Tasks

```bash
# Get all tasks
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/v1/tasks

# Get tasks for a specific project
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:3001/api/v1/tasks?projectId=PROJECT_ID&status=pending"
```

## Step 7: Error Handling

The API uses standard HTTP status codes and provides detailed error information:

### Validation Error Example

```bash
curl -X POST http://localhost:3001/api/v1/test \
  -H "Content-Type: application/json" \
  -d '{"message": ""}'  # Empty message will fail validation
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "String must contain at least 1 character(s)",
    "field": "message",
    "statusCode": 400
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "requestId": "req_1234567890_abc123"
  }
}
```

### Authentication Error Example

```bash
curl -H "Authorization: Bearer invalid-token" \
     http://localhost:3001/api/v1/projects
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired token",
    "statusCode": 401
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "requestId": "req_1234567890_abc123"
  }
}
```

## Step 8: Best Practices

### 1. Always Check Response Status

```bash
# Check HTTP status code
curl -w "%{http_code}" -s -o /dev/null http://localhost:3001/api/v1/health
```

### 2. Handle Rate Limiting

```bash
# Check rate limit headers
curl -I http://localhost:3001/api/v1/test
```

Look for headers:

- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

### 3. Use Request IDs for Debugging

Every response includes a `requestId` in the meta section. Include this when reporting issues:

```json
{
  "meta": {
    "requestId": "req_1234567890_abc123"
  }
}
```

### 4. Implement Proper Error Handling

```javascript
// Example in JavaScript
async function callAPI(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!data.success) {
      throw new Error(`API Error: ${data.error.message} (${data.error.code})`);
    }

    return data.data;
  } catch (error) {
    console.error('API call failed:', error.message);
    throw error;
  }
}
```

## Next Steps

1. **Explore the API**: Try different endpoints and parameters
2. **Read the OpenAPI Specification**: Check [`openapi.yaml`](./openapi.yaml) for complete API
   details
3. **Check Examples**: Look at [`examples/`](./examples/) for code samples in different languages
4. **Join the Community**: Get help and share feedback on our
   [Discord](https://discord.gg/constructtrack)

## Common Issues

### CORS Errors in Browser

If you're making requests from a web browser, ensure CORS is properly configured. The API includes
CORS headers by default.

### SSL Certificate Issues

For development, you might need to disable SSL verification:

```bash
curl -k https://localhost:3001/api/v1/health  # -k flag disables SSL verification
```

### Network Connectivity

Ensure the API server is running and accessible:

```bash
# Check if the server is running
curl -f http://localhost:3001/api/v1/health || echo "Server not accessible"
```

## Support

If you encounter issues:

1. Check the [Error Reference](./errors.md) for common error codes
2. Review the [API Documentation](./README.md) for endpoint details
3. Contact support at api-support@constructtrack.com
4. Report bugs on [GitHub Issues](https://github.com/constructtrack/api/issues)
