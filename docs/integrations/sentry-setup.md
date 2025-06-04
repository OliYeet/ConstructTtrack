# 🚨 Sentry Error Monitoring Integration

> **Comprehensive error monitoring and performance tracking for ConstructTrack**

This document outlines the Sentry integration setup for ConstructTrack, providing real-time error
monitoring, performance tracking, and user feedback collection.

## 🎯 Overview

Sentry is integrated into ConstructTrack to provide:

- **Real-time Error Monitoring**: Automatic error detection and reporting
- **Performance Tracking**: Monitor application performance and bottlenecks
- **Session Replay**: Video-like reproduction of user sessions with errors
- **User Feedback**: Collect user feedback when errors occur
- **Release Tracking**: Monitor errors across different releases
- **Custom Error Reporting**: Enhanced error classification and context

## 🏗️ Architecture

### Integration Points

1. **Next.js App Router**: Automatic instrumentation for pages and API routes
2. **ErrorReporter Class**: Enhanced with Sentry reporting capabilities
3. **ErrorBoundary Component**: React error boundary with Sentry integration
4. **Custom API Endpoints**: Manual error reporting and testing

### Configuration Files

```
apps/web/
├── sentry.client.config.ts    # Browser-side configuration
├── sentry.server.config.ts    # Server-side configuration
├── sentry.edge.config.ts      # Edge runtime configuration
├── src/instrumentation.ts     # Server instrumentation
├── src/instrumentation-client.ts # Client instrumentation
└── next.config.ts             # Next.js with Sentry webpack plugin
```

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Sentry Configuration
SENTRY_DSN=https://your_sentry_dsn_here@sentry.io/project_id
NEXT_PUBLIC_SENTRY_DSN=https://your_sentry_dsn_here@sentry.io/project_id
SENTRY_ORG=lumenfront
SENTRY_PROJECT=constructtrack

# For CI/CD (DO NOT commit to repository)
SENTRY_AUTH_TOKEN=your_sentry_auth_token_here
```

### Sentry Project Settings

1. **Organization**: `lumenfront`
2. **Project**: `constructtrack`
3. **Platform**: `javascript-nextjs`
4. **Tunnel Route**: `/monitoring` (bypasses ad blockers)

## 🚀 Features

### 1. Automatic Error Reporting

All unhandled errors are automatically captured and sent to Sentry with:

- **Stack traces** with source maps
- **User context** (when available)
- **Request context** (URL, user agent, etc.)
- **Custom tags** for categorization
- **Performance data**

### 2. Enhanced Error Classification

The existing `ErrorReporter` class now integrates with Sentry:

```typescript
await errorReporter.reportError(
  error,
  {
    source: 'api',
    url: request.url,
    userId: 'user123',
    additionalData: { customField: 'value' },
  },
  {
    type: 'validation',
    severity: 'medium',
    category: 'user_input',
    recoverable: true,
  }
);
```

### 3. React Error Boundary

Enhanced `ErrorBoundary` component captures React errors:

```tsx
<ErrorBoundary level='page' showDetails={true}>
  <YourComponent />
</ErrorBoundary>
```

### 4. Performance Monitoring

Automatic performance tracking for:

- **Page loads**
- **API routes**
- **Database queries**
- **External API calls**

### 5. Session Replay

Video-like reproduction of user sessions with errors:

- **Masked sensitive data**
- **10% sample rate** (configurable)
- **100% error sessions**

## 🧪 Testing

### Test Endpoints

1. **Sentry Example Page**: `/sentry-example-page`

   - Official Sentry test page
   - Tests frontend and backend errors
   - Connectivity diagnostics

2. **Custom Test API**: `/api/test-sentry`
   - Multiple error types
   - Performance testing
   - Custom error reporting

### Test Error Types

```bash
# Basic error
GET /api/test-sentry?type=basic

# Async error
GET /api/test-sentry?type=async

# Custom error through ErrorReporter
GET /api/test-sentry?type=custom

# Direct Sentry reporting
GET /api/test-sentry?type=sentry-direct

# Performance monitoring
GET /api/test-sentry?type=performance

# User feedback
GET /api/test-sentry?type=user-feedback
```

### Custom Error Testing

```bash
# POST custom error
curl -X POST /api/test-sentry \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Custom test error",
    "level": "error",
    "tags": { "test": "true" },
    "context": { "feature": "testing" }
  }'
```

## 📊 Monitoring

### Sentry Dashboard

Access your Sentry dashboard at:

- **Issues**: https://lumenfront.sentry.io/issues/?project=constructtrack
- **Performance**: https://lumenfront.sentry.io/performance/?project=constructtrack
- **Releases**: https://lumenfront.sentry.io/releases/?project=constructtrack

### Key Metrics

- **Error Rate**: Percentage of sessions with errors
- **Crash-Free Sessions**: Sessions without crashes
- **Performance Score**: Overall application performance
- **User Impact**: Number of users affected by errors

## 🔒 Security & Privacy

### Data Masking

- **Passwords**: Automatically masked
- **API Keys**: Filtered out
- **Personal Data**: Configurable masking
- **Sensitive URLs**: Path normalization

### Data Retention

- **Errors**: 90 days
- **Performance**: 30 days
- **Session Replays**: 30 days

## 🚀 Deployment

### CI/CD Integration

Add to your deployment pipeline:

```bash
# Upload source maps
npx @sentry/cli releases files $RELEASE upload-sourcemaps ./build

# Create release
npx @sentry/cli releases new $RELEASE
npx @sentry/cli releases set-commits $RELEASE --auto
npx @sentry/cli releases finalize $RELEASE
```

### Environment Variables for CI

```bash
SENTRY_AUTH_TOKEN=your_auth_token
SENTRY_ORG=lumenfront
SENTRY_PROJECT=constructtrack
```

## 🛠️ Troubleshooting

### Common Issues

1. **No errors appearing in Sentry**

   - Check DSN configuration
   - Verify network connectivity
   - Check ad blocker settings

2. **Source maps not working**

   - Verify auth token
   - Check build configuration
   - Ensure source maps are uploaded

3. **Performance data missing**
   - Check tracing configuration
   - Verify sample rates
   - Check instrumentation setup

### Debug Mode

Enable debug logging in development:

```typescript
Sentry.init({
  debug: true, // Enable in development only
  // ... other config
});
```

## 📚 Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [ConstructTrack Error Handling Guide](../error-handling/overview.md)
- [Performance Monitoring Best Practices](../performance/monitoring.md)

## 🔄 Updates

- **v1.0.0**: Initial Sentry integration
- **v1.1.0**: Enhanced ErrorReporter integration
- **v1.2.0**: Session Replay configuration
- **v1.3.0**: Performance monitoring optimization
