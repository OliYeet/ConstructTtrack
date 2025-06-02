# 🔌 ConstructTrack API Documentation

## Overview

The ConstructTrack API is a comprehensive RESTful API designed specifically for fiber optic construction management. It provides endpoints for project management, task tracking, user management, and real-time progress monitoring.

## 🚀 Quick Start

### Base URLs

- **Production**: `https://api.constructtrack.com/v1`
- **Development**: `http://localhost:3001/api/v1`

### Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer <your-jwt-token>" \
     https://api.constructtrack.com/v1/projects
```

### Test the API

Start with the health check endpoint to verify connectivity:

```bash
curl https://api.constructtrack.com/v1/health
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

## 📚 API Reference

### 📋 Complete Specification

- **OpenAPI 3.0 Specification**: [`openapi.yaml`](./openapi.yaml)
- **Interactive Documentation**: Available at `/docs` endpoint (coming soon)

### 🔗 Core Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/health` | GET | System health check | ❌ |
| `/test` | GET, POST | API testing endpoints | ❌ |
| `/projects` | GET, POST | Project management | ✅ |
| `/projects/{id}` | GET, PUT, DELETE | Individual project operations | ✅ |
| `/tasks` | GET, POST | Task management | ✅ |
| `/users` | GET, POST | User management | ✅ |
| `/auth/login` | POST | User authentication | ❌ |
| `/auth/refresh` | POST | Token refresh | ✅ |

## 🔐 Authentication

### JWT Token Authentication

1. **Login** to get a JWT token:
```bash
curl -X POST https://api.constructtrack.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

2. **Use the token** in subsequent requests:
```bash
curl -H "Authorization: Bearer <jwt-token>" \
     https://api.constructtrack.com/v1/projects
```

### API Key Authentication

For external integrations, use API keys:

```bash
curl -H "X-API-Key: <your-api-key>" \
     https://api.constructtrack.com/v1/projects
```

## 📊 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful",
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "requestId": "req_1234567890_abc123"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "field": "email",
    "statusCode": 400,
    "details": { /* additional error info */ }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "requestId": "req_1234567890_abc123"
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "data": [ /* array of items */ ],
    "pagination": {
      "page": 2,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": true
    }
  },
  "message": "Data retrieved successfully",
  "meta": { /* standard meta info */ }
}
```

## ⚠️ Error Handling

### HTTP Status Codes

| Code | Description | When Used |
|------|-------------|-----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation errors, malformed requests |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side errors |
| 503 | Service Unavailable | System maintenance or overload |

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `AUTHENTICATION_ERROR` | Authentication required or failed | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `CONFLICT` | Resource conflict | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_SERVER_ERROR` | Server error | 500 |
| `DATABASE_ERROR` | Database operation failed | 500 |
| `EXTERNAL_SERVICE_ERROR` | External service unavailable | 503 |

## 🔄 Pagination

List endpoints support pagination with the following parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (max 100) |
| `sortBy` | string | - | Field to sort by |
| `sortOrder` | string | asc | Sort order: `asc` or `desc` |

Example:
```bash
curl "https://api.constructtrack.com/v1/projects?page=2&limit=50&sortBy=name&sortOrder=desc"
```

## 🎯 Rate Limiting

API requests are rate-limited to ensure fair usage:

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated**: Higher limits based on user tier
- **Rate limit headers** included in responses:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

When rate limited, you'll receive a `429` status with retry information.

## 🌐 CORS

The API supports Cross-Origin Resource Sharing (CORS) for web applications:

- **Allowed Origins**: Configurable (default: all)
- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-API-Key
- **Max Age**: 24 hours

## 📱 Mobile Considerations

The API is optimized for mobile applications:

- **Efficient payloads**: Minimal data transfer
- **Offline support**: Endpoints designed for sync scenarios
- **Location services**: GPS coordinate handling
- **Image uploads**: Optimized for field photos
- **Battery efficiency**: Reduced polling requirements

## 🔧 Development Tools

### Testing

Use the test endpoints for development:

```bash
# Simple GET test
curl https://api.constructtrack.com/v1/test

# POST test with validation
curl -X POST https://api.constructtrack.com/v1/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello API!", "data": {"test": true}}'
```

### Health Monitoring

Monitor API health:

```bash
curl https://api.constructtrack.com/v1/health
```

### Request Tracing

Every response includes a `requestId` for debugging:

```json
{
  "meta": {
    "requestId": "req_1234567890_abc123"
  }
}
```

Include this ID when reporting issues.

## 📖 Additional Resources

- **[Getting Started Guide](./getting-started.md)** - Step-by-step tutorial
- **[Authentication Guide](./authentication.md)** - Detailed auth documentation
- **[Error Reference](./errors.md)** - Complete error code reference
- **[Examples](./examples/)** - Code examples in multiple languages
- **[Changelog](./changelog.md)** - API version history
- **[Migration Guide](./migration.md)** - Upgrade instructions

## 🆘 Support

- **Documentation Issues**: [GitHub Issues](https://github.com/constructtrack/api-docs/issues)
- **API Support**: api-support@constructtrack.com
- **Status Page**: https://status.constructtrack.com
- **Community**: [Discord](https://discord.gg/constructtrack)
