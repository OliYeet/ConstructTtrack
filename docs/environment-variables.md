# Environment Variables Guide

This document provides a comprehensive guide to environment variables used in the ConstructTrack application.

## Quick Start

1. **Copy the example file**: `cp .env.example .env`
2. **Run the setup script**: `npm run env:setup`
3. **Validate your configuration**: `npm run env:validate`

## Environment Files

### File Structure

```
.env                    # Main environment file (gitignored)
.env.example           # Template with all variables documented
.env.development       # Development-specific settings
.env.staging          # Staging environment settings
.env.production       # Production environment settings
```

### Loading Priority

The application loads environment variables in this order:
1. `.env.{NODE_ENV}` (e.g., `.env.development`)
2. `.env` (fallback)
3. System environment variables (highest priority)

## Required Variables

### Core Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | `development`, `staging`, `production` |
| `PORT` | Server port | `3000` |

### Supabase Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Public anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Public URL for Next.js | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for Next.js | ✅ |
| `EXPO_PUBLIC_SUPABASE_URL` | Public URL for Expo | ✅ |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for Expo | ✅ |

### MapBox Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `MAPBOX_ACCESS_TOKEN` | MapBox public access token | ✅ |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | MapBox token for Next.js | ✅ |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | MapBox token for Expo | ✅ |

### Notion Integration

| Variable | Description | Required |
|----------|-------------|----------|
| `NOTION_TOKEN` | Notion integration token | ✅ |
| `NOTION_DATABASE_ID` | Main project database ID | ✅ |
| `NOTION_WEBHOOK_SECRET` | Webhook secret for sync | ✅ |

### Security

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret for JWT token signing | ✅ |
| `ENCRYPTION_KEY` | 32-character encryption key | ✅ |

## Optional Variables

### Email Service

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |

### SMS Service (Twilio)

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |

### Cloud Storage (AWS S3)

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name | - |

## Environment-Specific Settings

### Development

- Debug logging enabled
- Hot reload enabled
- Less strict security settings
- Local webhook URLs

### Staging

- Moderate logging
- Test service credentials
- Staging URLs and databases

### Production

- Error-level logging only
- Strict security settings
- Production service credentials
- HTTPS URLs

## Security Best Practices

### 🔒 Secrets Management

1. **Never commit `.env` files** to version control
2. **Use different secrets** for each environment
3. **Rotate secrets regularly** in production
4. **Use strong, random values** for JWT secrets and encryption keys

### 🛡️ Access Control

1. **Limit service role key usage** to server-side only
2. **Use anon keys** for client-side applications
3. **Implement proper CORS** settings
4. **Enable RLS** in Supabase

## Validation

### Automatic Validation

Run `npm run env:validate` to check:
- All required variables are set
- Variables match expected patterns
- URLs are valid
- Keys have minimum length requirements

### Manual Validation

Check these manually:
- Supabase connection works
- MapBox tokens are valid
- Notion integration is authorized
- Email/SMS services are configured

## Troubleshooting

### Common Issues

1. **"Required environment variable missing"**
   - Check if the variable is set in your `.env` file
   - Ensure no typos in variable names

2. **"Invalid URL format"**
   - Verify Supabase URLs end with `.supabase.co`
   - Check for extra spaces or characters

3. **"Token does not match pattern"**
   - MapBox tokens should start with `pk.`
   - Notion tokens should start with `secret_`

4. **"Inconsistent values"**
   - Ensure public and private versions of URLs match
   - Check that all platform-specific tokens are identical

### Getting Help

1. Run the validation script: `npm run env:validate`
2. Check the example file: `.env.example`
3. Use the setup script: `npm run env:setup`
4. Review this documentation

## Scripts

| Script | Description |
|--------|-------------|
| `npm run env:setup` | Interactive environment setup |
| `npm run env:validate` | Validate environment variables |
| `npm run env:check` | Quick environment check |

## References

- [Supabase Dashboard](https://supabase.com/dashboard)
- [MapBox Access Tokens](https://account.mapbox.com/access-tokens/)
- [Notion Integrations](https://www.notion.so/my-integrations)
- [Environment Variables Best Practices](https://12factor.net/config)
