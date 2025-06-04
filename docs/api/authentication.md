# 🔐 ConstructTrack API Authentication

This guide covers all authentication methods supported by the ConstructTrack API, including JWT
tokens, API keys, and security best practices.

## Overview

The ConstructTrack API supports multiple authentication methods:

1. **JWT Token Authentication** - For user-based access (web/mobile apps)
2. **API Key Authentication** - For external integrations and services
3. **Session-based Authentication** - For web applications (coming soon)

## JWT Token Authentication

### How It Works

JWT (JSON Web Token) authentication is the primary method for user authentication. It's stateless,
secure, and perfect for mobile and web applications.

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Database

    Client->>API: POST /auth/login (email, password)
    API->>Database: Verify credentials
    Database-->>API: User data
    API-->>Client: JWT token + refresh token

    Client->>API: API request with JWT token
    API->>API: Verify JWT token
    API-->>Client: API response

    Client->>API: POST /auth/refresh (refresh token)
    API-->>Client: New JWT token
```

### 1. User Registration

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "fullName": "John Doe",
    "role": "field_worker",
    "organizationId": "org-uuid-here"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "field_worker",
      "organizationId": "org-uuid-here"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-token-here",
    "expiresIn": 3600
  },
  "message": "User registered successfully"
}
```

### 2. User Login

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "field_worker",
      "organizationId": "org-uuid-here"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-token-here",
    "expiresIn": 3600
  },
  "message": "Login successful"
}
```

### 3. Using JWT Tokens

Include the JWT token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     http://localhost:3001/api/v1/projects
```

### 4. Token Refresh

JWT tokens expire after 1 hour. Use the refresh token to get a new access token:

```bash
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "refresh-token-here"
  }'
```

### 5. Logout

```bash
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Authorization: Bearer your-jwt-token"
```

## API Key Authentication

### When to Use API Keys

- External integrations
- Server-to-server communication
- Automated scripts and services
- Third-party applications

### Creating API Keys

API keys are created through the web dashboard or by administrators:

```bash
curl -X POST http://localhost:3001/api/v1/auth/api-keys \
  -H "Authorization: Bearer admin-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "External Integration",
    "description": "API key for external service integration",
    "permissions": ["projects:read", "tasks:read", "tasks:write"],
    "expiresAt": "2025-01-01T00:00:00Z"
  }'
```

### Using API Keys

Include the API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key-here" \
     http://localhost:3001/api/v1/projects
```

### API Key Management

```bash
# List API keys
curl -H "Authorization: Bearer admin-jwt-token" \
     http://localhost:3001/api/v1/auth/api-keys

# Revoke an API key
curl -X DELETE http://localhost:3001/api/v1/auth/api-keys/key-id \
  -H "Authorization: Bearer admin-jwt-token"
```

## User Roles and Permissions

### Role Hierarchy

1. **Admin** - Full system access
2. **Manager** - Organization management, project oversight
3. **Field Worker** - Task execution, progress updates

### Permission Matrix

| Action          | Admin | Manager       | Field Worker       |
| --------------- | ----- | ------------- | ------------------ |
| Create Projects | ✅    | ✅            | ❌                 |
| View Projects   | ✅    | ✅            | ✅ (assigned only) |
| Update Projects | ✅    | ✅            | ❌                 |
| Delete Projects | ✅    | ❌            | ❌                 |
| Create Tasks    | ✅    | ✅            | ❌                 |
| View Tasks      | ✅    | ✅            | ✅ (assigned only) |
| Update Tasks    | ✅    | ✅            | ✅ (assigned only) |
| Manage Users    | ✅    | ✅ (same org) | ❌                 |
| View Reports    | ✅    | ✅            | ❌                 |

### Role-Based Access Control

The API automatically enforces permissions based on user roles:

```bash
# This will succeed for admin/manager
curl -X POST http://localhost:3001/api/v1/projects \
  -H "Authorization: Bearer manager-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Project"}'

# This will fail for field worker (403 Forbidden)
curl -X POST http://localhost:3001/api/v1/projects \
  -H "Authorization: Bearer field-worker-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Project"}'
```

## Security Best Practices

### 1. Token Storage

**✅ Secure Storage:**

- Use secure storage mechanisms (Keychain on iOS, Keystore on Android)
- Store tokens in httpOnly cookies for web applications
- Never store tokens in localStorage for sensitive applications

**❌ Avoid:**

- Storing tokens in plain text
- Logging tokens in console or files
- Storing tokens in URL parameters

### 2. Token Transmission

**✅ Secure Transmission:**

- Always use HTTPS in production
- Include tokens in Authorization header
- Validate SSL certificates

**❌ Avoid:**

- Sending tokens over HTTP
- Including tokens in URL parameters
- Ignoring SSL certificate errors

### 3. Token Lifecycle

**✅ Best Practices:**

- Implement automatic token refresh
- Handle token expiration gracefully
- Logout users when tokens are revoked
- Use short-lived access tokens (1 hour)

### 4. Error Handling

```javascript
// Example: Proper error handling in JavaScript
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry the original request
        return apiCall(endpoint, options);
      } else {
        // Refresh failed, redirect to login
        redirectToLogin();
        return;
      }
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error.message);
    }

    return data.data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

## Common Authentication Errors

### 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Authentication required",
    "statusCode": 401
  }
}
```

**Causes:**

- Missing Authorization header
- Invalid or expired token
- Malformed token

### 403 Forbidden

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Insufficient permissions",
    "statusCode": 403
  }
}
```

**Causes:**

- User doesn't have required role
- Accessing resources outside organization
- API key lacks required permissions

### 429 Rate Limited

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "statusCode": 429,
    "details": {
      "retryAfter": 60
    }
  }
}
```

**Solution:**

- Implement exponential backoff
- Respect rate limit headers
- Use API keys for higher limits

## Testing Authentication

### Development Testing

```bash
# Test with invalid token
curl -H "Authorization: Bearer invalid-token" \
     http://localhost:3001/api/v1/projects

# Test without authentication
curl http://localhost:3001/api/v1/projects

# Test with expired token
curl -H "Authorization: Bearer expired-token" \
     http://localhost:3001/api/v1/projects
```

### Integration Testing

```javascript
// Example test suite
describe('Authentication', () => {
  test('should authenticate with valid credentials', async () => {
    const response = await login('user@example.com', 'password');
    expect(response.success).toBe(true);
    expect(response.data.accessToken).toBeDefined();
  });

  test('should reject invalid credentials', async () => {
    const response = await login('user@example.com', 'wrong-password');
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('AUTHENTICATION_ERROR');
  });

  test('should refresh expired tokens', async () => {
    const refreshResponse = await refreshToken('valid-refresh-token');
    expect(refreshResponse.success).toBe(true);
    expect(refreshResponse.data.accessToken).toBeDefined();
  });
});
```

## Migration and Updates

### Token Format Changes

When updating token formats:

1. Support both old and new formats during transition
2. Provide migration endpoints
3. Notify users of deprecation timeline
4. Update client libraries

### API Key Rotation

```bash
# Rotate API key
curl -X POST http://localhost:3001/api/v1/auth/api-keys/key-id/rotate \
  -H "Authorization: Bearer admin-jwt-token"
```

## Support

For authentication-related issues:

1. Check the [Error Reference](./errors.md) for error codes
2. Review token expiration and refresh logic
3. Verify role permissions
4. Contact support at auth-support@constructtrack.com
