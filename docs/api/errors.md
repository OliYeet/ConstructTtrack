# ⚠️ ConstructTrack API Error Reference

This comprehensive guide covers all error codes, HTTP status codes, and troubleshooting information
for the ConstructTrack API.

## Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "field": "fieldName",
    "statusCode": 400,
    "details": {
      "additionalInfo": "value"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "requestId": "req_1234567890_abc123"
  }
}
```

## HTTP Status Codes

### 2xx Success

| Code | Status     | Description                             |
| ---- | ---------- | --------------------------------------- |
| 200  | OK         | Request successful                      |
| 201  | Created    | Resource created successfully           |
| 202  | Accepted   | Request accepted for processing         |
| 204  | No Content | Request successful, no content returned |

### 4xx Client Errors

| Code | Status               | Description                         | Action Required              |
| ---- | -------------------- | ----------------------------------- | ---------------------------- |
| 400  | Bad Request          | Invalid request format or data      | Fix request format/data      |
| 401  | Unauthorized         | Authentication required or failed   | Provide valid authentication |
| 403  | Forbidden            | Insufficient permissions            | Check user role/permissions  |
| 404  | Not Found            | Resource doesn't exist              | Verify resource ID/URL       |
| 405  | Method Not Allowed   | HTTP method not supported           | Use correct HTTP method      |
| 409  | Conflict             | Resource already exists or conflict | Resolve conflict             |
| 422  | Unprocessable Entity | Valid format but semantic errors    | Fix semantic issues          |
| 429  | Too Many Requests    | Rate limit exceeded                 | Implement rate limiting      |

### 5xx Server Errors

| Code | Status                | Description                     | Action Required           |
| ---- | --------------------- | ------------------------------- | ------------------------- |
| 500  | Internal Server Error | Unexpected server error         | Report to support         |
| 502  | Bad Gateway           | Upstream service error          | Retry later               |
| 503  | Service Unavailable   | Service temporarily unavailable | Retry with backoff        |
| 504  | Gateway Timeout       | Request timeout                 | Retry with longer timeout |

## Error Codes Reference

### Authentication Errors (AUTH\_\*)

#### AUTHENTICATION_ERROR

- **HTTP Status**: 401
- **Description**: Authentication required or failed
- **Common Causes**:
  - Missing Authorization header
  - Invalid JWT token
  - Expired token
  - Malformed token

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired token",
    "statusCode": 401
  }
}
```

**Solutions:**

- Verify token format
- Check token expiration
- Refresh token if expired
- Re-authenticate if refresh fails

#### AUTHORIZATION_ERROR

- **HTTP Status**: 403
- **Description**: Insufficient permissions
- **Common Causes**:
  - User role lacks required permissions
  - Accessing resources outside organization
  - API key missing required scopes

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Access denied. Required roles: admin, manager",
    "statusCode": 403
  }
}
```

**Solutions:**

- Check user role and permissions
- Verify organization membership
- Request elevated permissions

### Validation Errors (VALIDATION\_\*)

#### VALIDATION_ERROR

- **HTTP Status**: 400
- **Description**: Input validation failed
- **Common Causes**:
  - Missing required fields
  - Invalid data format
  - Data out of range
  - Invalid enum values

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "field": "email",
    "statusCode": 400,
    "details": {
      "zodError": [
        {
          "path": ["email"],
          "message": "Invalid email",
          "code": "invalid_string"
        }
      ]
    }
  }
}
```

**Solutions:**

- Validate input data before sending
- Check field requirements and formats
- Review API documentation for valid values

### Resource Errors (RESOURCE\_\*)

#### NOT_FOUND

- **HTTP Status**: 404
- **Description**: Requested resource doesn't exist
- **Common Causes**:
  - Invalid resource ID
  - Resource deleted
  - Incorrect URL path

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found",
    "statusCode": 404
  }
}
```

**Solutions:**

- Verify resource ID
- Check if resource was deleted
- Confirm URL path is correct

#### CONFLICT

- **HTTP Status**: 409
- **Description**: Resource conflict
- **Common Causes**:
  - Duplicate resource creation
  - Concurrent modifications
  - Business rule violations

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Project with this name already exists",
    "statusCode": 409,
    "details": {
      "existingProjectId": "project-uuid"
    }
  }
}
```

**Solutions:**

- Use unique identifiers
- Implement optimistic locking
- Handle concurrent updates

### Rate Limiting Errors (RATE\_\*)

#### RATE_LIMIT_EXCEEDED

- **HTTP Status**: 429
- **Description**: Too many requests
- **Common Causes**:
  - Exceeding request rate limits
  - Burst traffic
  - Inefficient API usage

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "statusCode": 429,
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "remaining": 0,
      "reset": 1642248000
    }
  }
}
```

**Solutions:**

- Implement exponential backoff
- Respect rate limit headers
- Use API keys for higher limits
- Optimize request patterns

### Server Errors (SERVER\_\*)

#### INTERNAL_SERVER_ERROR

- **HTTP Status**: 500
- **Description**: Unexpected server error
- **Common Causes**:
  - Unhandled exceptions
  - Service failures
  - Configuration issues

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "statusCode": 500
  }
}
```

**Solutions:**

- Report to support with request ID
- Retry after delay
- Check system status page

#### DATABASE_ERROR

- **HTTP Status**: 500
- **Description**: Database operation failed
- **Common Causes**:
  - Database connection issues
  - Query timeouts
  - Data integrity violations

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database connection timeout",
    "statusCode": 500
  }
}
```

**Solutions:**

- Retry with exponential backoff
- Check database status
- Report persistent issues

#### EXTERNAL_SERVICE_ERROR

- **HTTP Status**: 503
- **Description**: External service unavailable
- **Common Causes**:
  - Third-party service downtime
  - Network connectivity issues
  - Service rate limiting

**Example:**

```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR",
    "message": "External service PaymentService is unavailable",
    "statusCode": 503,
    "details": {
      "service": "PaymentService"
    }
  }
}
```

**Solutions:**

- Retry with exponential backoff
- Check service status pages
- Implement fallback mechanisms

## Error Handling Best Practices

### 1. Implement Proper Error Handling

```javascript
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!data.success) {
      // Handle specific error codes
      switch (data.error.code) {
        case 'AUTHENTICATION_ERROR':
          await refreshTokenAndRetry();
          break;
        case 'RATE_LIMIT_EXCEEDED':
          await delay(data.error.details.retryAfter * 1000);
          return apiCall(endpoint, options);
        case 'VALIDATION_ERROR':
          showValidationErrors(data.error);
          break;
        default:
          showGenericError(data.error.message);
      }
      throw new Error(data.error.message);
    }

    return data.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

### 2. Use Request IDs for Debugging

Always include the request ID when reporting errors:

```javascript
function reportError(error, requestId) {
  console.error(`Error ${error.code}: ${error.message} (Request ID: ${requestId})`);

  // Send to error tracking service
  errorTracker.captureException(error, {
    extra: { requestId },
  });
}
```

### 3. Implement Retry Logic

```javascript
async function retryableApiCall(endpoint, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall(endpoint, options);
    } catch (error) {
      const shouldRetry = [
        'INTERNAL_SERVER_ERROR',
        'DATABASE_ERROR',
        'EXTERNAL_SERVICE_ERROR',
      ].includes(error.code);

      if (shouldRetry && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
}
```

### 4. Handle Rate Limiting

```javascript
class RateLimitedApiClient {
  constructor() {
    this.requestQueue = [];
    this.isProcessing = false;
  }

  async makeRequest(endpoint, options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const { endpoint, options, resolve, reject } = this.requestQueue.shift();

      try {
        const result = await apiCall(endpoint, options);
        resolve(result);
      } catch (error) {
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          // Put request back in queue and wait
          this.requestQueue.unshift({ endpoint, options, resolve, reject });
          await new Promise(resolve => setTimeout(resolve, error.details.retryAfter * 1000));
        } else {
          reject(error);
        }
      }
    }

    this.isProcessing = false;
  }
}
```

## Troubleshooting Guide

### Common Issues and Solutions

#### "Authentication required" but token is provided

**Symptoms:**

- 401 error despite providing Authorization header
- Error message: "Authentication required"

**Debugging Steps:**

1. Check Authorization header format: `Bearer <token>`
2. Verify token is not expired
3. Ensure token is valid JWT format
4. Check for extra spaces or characters

**Solution:**

```bash
# Correct format
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Incorrect formats
curl -H "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # Missing "Bearer"
curl -H "Authorization: Bearer  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # Extra space
```

#### "Validation error" with correct data

**Symptoms:**

- 400 error with validation message
- Data appears correct

**Debugging Steps:**

1. Check data types (string vs number)
2. Verify required fields are present
3. Check field length limits
4. Validate enum values

**Solution:**

```javascript
// Incorrect - number as string
{
  "budget": "50000"  // Should be number
}

// Correct
{
  "budget": 50000
}
```

#### Rate limiting issues

**Symptoms:**

- 429 errors
- Requests being rejected

**Debugging Steps:**

1. Check rate limit headers
2. Monitor request frequency
3. Implement proper delays

**Solution:**

```javascript
// Check rate limit headers
const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
const rateLimitReset = response.headers.get('X-RateLimit-Reset');

if (rateLimitRemaining < 10) {
  // Slow down requests
  await delay(1000);
}
```

## Getting Help

### Before Contacting Support

1. **Check this error reference** for your specific error code
2. **Review the request** format and data
3. **Check system status** at https://status.constructtrack.com
4. **Try the request** with curl to isolate client issues

### When Contacting Support

Include the following information:

1. **Request ID** from the error response
2. **Full error response** (sanitize sensitive data)
3. **Request details** (method, endpoint, headers)
4. **Steps to reproduce** the issue
5. **Expected vs actual behavior**

### Support Channels

- **Email**: api-support@constructtrack.com
- **GitHub Issues**: https://github.com/constructtrack/api/issues
- **Discord**: https://discord.gg/constructtrack
- **Status Page**: https://status.constructtrack.com
