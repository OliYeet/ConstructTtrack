# 🔄 Database Migration Workflow

> **Comprehensive guide to managing database schema changes in ConstructTrack**

## 📋 Overview

The ConstructTrack migration system provides a robust, version-controlled approach to managing
database schema changes. It includes automated tracking, rollback capabilities, and safety checks to
ensure reliable deployments across all environments.

## 🏗️ Migration System Architecture

### Components

1. **Migration Manager** (`scripts/migration-manager.js`) - Core migration orchestration
2. **Migration Tracking** (`schema_migrations` table) - Database-level tracking
3. **Supabase CLI Integration** - Leverages Supabase's migration system
4. **Backup System** - Automatic backups before migrations
5. **Validation Tools** - Pre-migration safety checks

### Migration File Structure

```
supabase/migrations/
├── 001_initial_schema.sql          # Core tables
├── 002_extended_schema.sql         # Extended functionality
├── 003_rls_policies.sql            # Security policies
├── 004_functions_views.sql         # Database functions
├── 005_migration_tracking.sql      # Migration system
└── YYYYMMDDHHMMSS_<name>.sql      # Future migrations
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Ensure environment variables are set
npm run env:validate
```

### Basic Commands

```bash
# List all migrations
npm run db:migrate:list

# Check migration status
npm run db:migrate:status

# Run pending migrations
npm run db:migrate:run

# Create new migration
npm run db:migrate:create "add_user_preferences"
```

## 📝 Creating Migrations

### 1. Create Migration File

```bash
# Using npm script
npm run db:migrate:create "add_user_preferences" "Add user preferences table"

# Using migration manager directly
node scripts/migration-manager.js create add_user_preferences "Add user preferences table"
```

This creates a timestamped file: `20250130123456_add_user_preferences.sql`

### 2. Edit Migration File

```sql
-- Migration: Add User Preferences
-- Description: Add user preferences table
-- Created: 2025-01-30T12:34:56.789Z

-- Create user preferences table
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY "users_own_preferences" ON user_preferences
FOR ALL USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rollback instructions:
-- DROP TABLE IF EXISTS user_preferences;
```

### 3. Validate Migration

```bash
# Validate syntax and safety
npm run db:migrate:validate

# Dry run to see what would be applied
npm run db:migrate:run -- --dry-run
```

## 🔄 Running Migrations

### Development Environment

```bash
# Standard migration run (with backup)
npm run db:migrate:run

# Skip backup (faster for development)
npm run db:migrate:run -- --no-backup

# Dry run to preview changes
npm run db:migrate:run -- --dry-run
```

### Production Environment

```bash
# Always create backup in production
npm run db:migrate:run

# Target specific environment
npm run db:migrate:run -- --target=production
```

## 📊 Migration Status and Monitoring

### Check Migration Status

```bash
# View applied migrations
npm run db:migrate:status

# Get detailed migration summary
node scripts/migration-manager.js status
```

### Database Views

```sql
-- View migration status
SELECT * FROM migration_status_view;

-- Get migration summary
SELECT * FROM get_migration_summary();

-- Check if specific migration was applied
SELECT is_migration_applied('001_initial_schema.sql');
```

## 🛡️ Safety Features

### Automatic Backups

- **Default Behavior**: Backup created before each migration run
- **Backup Location**: `supabase/backups/backup_YYYYMMDDHHMMSS.sql`
- **Skip Option**: Use `--no-backup` flag (not recommended for production)

### Validation Checks

1. **SQL Syntax Validation**: Basic syntax checking
2. **Dangerous Operation Detection**: Warns about DROP, TRUNCATE, etc.
3. **File Integrity**: Checksum validation
4. **Dependency Checking**: Foreign key reference validation

### Rollback Safety

```bash
# Manual rollback using backup
supabase db reset
supabase db push --file supabase/backups/backup_YYYYMMDDHHMMSS.sql

# Emergency reset (development only)
npm run db:reset -- --confirm
```

## 🔧 Advanced Usage

### Custom Migration Templates

Modify `getMigrationTemplate()` in `migration-manager.js` to customize the default migration
template.

### Environment-Specific Migrations

```bash
# Target specific environment
node scripts/migration-manager.js run --target=staging
node scripts/migration-manager.js run --target=production
```

### Batch Operations

```bash
# Create multiple related migrations
npm run db:migrate:create "add_notifications_table"
npm run db:migrate:create "add_notification_preferences"
npm run db:migrate:create "update_notification_policies"
```

## 📋 Best Practices

### Migration Design

1. **Atomic Changes**: Each migration should be a single, atomic change
2. **Backward Compatibility**: Avoid breaking changes when possible
3. **Data Migration**: Include data migration scripts when needed
4. **Rollback Plan**: Always include rollback instructions in comments

### Naming Conventions

```
YYYYMMDDHHMMSS_<action>_<entity>[_<detail>].sql

Examples:
20250130123456_create_user_preferences.sql
20250130123457_add_email_index_users.sql
20250130123458_update_rls_policies_projects.sql
```

### Testing Strategy

1. **Local Testing**: Test migrations on local development database
2. **Staging Validation**: Run on staging environment first
3. **Backup Verification**: Ensure backups can be restored
4. **Rollback Testing**: Test rollback procedures

## 🚨 Troubleshooting

### Common Issues

#### Migration Fails

```bash
# Check migration status
npm run db:migrate:status

# Validate migration files
npm run db:migrate:validate

# Check Supabase connection
supabase status
```

#### Rollback Required

```bash
# List available backups
ls supabase/backups/

# Restore from backup
supabase db reset
supabase db push --file supabase/backups/backup_YYYYMMDDHHMMSS.sql
```

#### Migration Tracking Issues

```sql
-- Manually mark migration as applied (use with caution)
SELECT record_migration('filename.sql', 'checksum', 1000, true);

-- Check migration table
SELECT * FROM schema_migrations ORDER BY applied_at DESC;
```

### Emergency Procedures

#### Complete Database Reset

```bash
# ⚠️ DESTRUCTIVE - Only for development
npm run db:reset -- --confirm

# Reapply all migrations
npm run db:migrate:run
```

#### Production Recovery

1. **Stop Application**: Prevent new connections
2. **Assess Damage**: Check what failed
3. **Restore Backup**: Use most recent backup
4. **Validate State**: Ensure data integrity
5. **Resume Service**: Restart application

## 📚 Reference

### Migration Manager Commands

| Command    | Description          | Example                          |
| ---------- | -------------------- | -------------------------------- |
| `create`   | Create new migration | `create add_table "Description"` |
| `list`     | List migration files | `list`                           |
| `status`   | Show database status | `status`                         |
| `run`      | Execute migrations   | `run --dry-run`                  |
| `validate` | Validate migrations  | `validate`                       |
| `backup`   | Create backup        | `backup`                         |
| `reset`    | Reset database       | `reset --confirm`                |

### NPM Scripts

| Script                | Description          |
| --------------------- | -------------------- |
| `db:migrate:create`   | Create new migration |
| `db:migrate:list`     | List migrations      |
| `db:migrate:status`   | Check status         |
| `db:migrate:run`      | Run migrations       |
| `db:migrate:validate` | Validate migrations  |
| `db:migrate:backup`   | Create backup        |
| `db:migrate:reset`    | Reset database       |

### Environment Variables

| Variable                    | Description          | Required    |
| --------------------------- | -------------------- | ----------- |
| `SUPABASE_URL`              | Supabase project URL | Yes         |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key     | Production  |
| `SUPABASE_ANON_KEY`         | Anonymous key        | Development |
