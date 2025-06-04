# 🗄️ ConstructTrack Database Versioning Strategy

> **Comprehensive database schema versioning and migration management**

📅 **Last Updated**: January 2025  
🎯 **Epic**: 0.75 - Technical Infrastructure & Integrations  
📖 **Story**: 0.75.2 - Database Architecture & Migration System

---

## 📋 Overview

This document defines the database versioning strategy for ConstructTrack, ensuring consistent,
trackable, and reversible database schema changes across all environments.

## 🎯 Versioning Principles

### 1. **Sequential Migration Numbering**

- Format: `XXX_descriptive_name.sql` (e.g., `001_initial_schema.sql`)
- Migrations are applied in numerical order
- No gaps in numbering sequence
- Each migration is atomic and idempotent

### 2. **Environment Consistency**

- Same migration files across all environments (dev, staging, prod)
- Automated migration tracking prevents duplicate applications
- Environment-specific data handled through separate seed files

### 3. **Backward Compatibility**

- Additive changes preferred over destructive ones
- Column additions instead of modifications when possible
- Deprecation period for removed features
- Rollback scripts for critical changes

---

## 📁 Migration File Structure

```
supabase/migrations/
├── 001_initial_schema.sql          # Core tables and types
├── 002_extended_schema.sql         # Additional tables
├── 003_rls_policies.sql            # Row Level Security
├── 004_functions_views.sql         # Database functions and views
├── 005_migration_tracking.sql      # Migration system itself
├── 006_spatial_indexes.sql         # PostGIS spatial indexes
├── 007_core_rls_policies.sql       # Core table RLS policies
├── 008_seed_data.sql               # Development seed data
└── 009_next_feature.sql            # Next migration...
```

## 🔢 Version Numbering Convention

### Migration Numbers

- **001-099**: Core schema and infrastructure
- **100-199**: Authentication and user management
- **200-299**: Project and fiber network features
- **300-399**: Forms and documentation
- **400-499**: Mobile and real-time features
- **500-599**: Reporting and analytics
- **600-699**: Third-party integrations
- **700-799**: Performance optimizations
- **800-899**: Security enhancements
- **900-999**: Maintenance and cleanup

### Semantic Versioning for Schema

- **Major.Minor.Patch** format (e.g., 1.2.3)
- **Major**: Breaking changes requiring application updates
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, data corrections

---

## 📝 Migration File Standards

### File Header Template

```sql
-- Migration: [Brief Description]
-- Version: [Schema Version]
-- Description: [Detailed description of changes]
-- Breaking Changes: [Yes/No - list if yes]
-- Rollback: [Available/Manual/Not Available]
-- Created: [YYYY-MM-DD]
-- Author: [Name/Team]

-- Dependencies: [List of required migrations]
-- Estimated Execution Time: [Time estimate]
-- Impact: [Performance/Downtime considerations]
```

### Migration Content Structure

```sql
-- 1. Pre-migration checks
-- 2. Schema changes (DDL)
-- 3. Data migrations (DML)
-- 4. Index creation
-- 5. Constraint additions
-- 6. Function/view updates
-- 7. Permission grants
-- 8. Post-migration validation
-- 9. Migration recording
```

---

## 🔄 Migration Lifecycle

### 1. **Development Phase**

```bash
# Create new migration
./scripts/create-migration.js "add_customer_preferences"

# Apply locally
supabase db reset --local
supabase db push --local

# Test migration
npm run test:db
```

### 2. **Review Phase**

- Code review for migration files
- Schema change impact assessment
- Performance testing on staging data
- Rollback plan verification

### 3. **Staging Deployment**

```bash
# Apply to staging
supabase db push --project staging-project-id

# Validate staging environment
npm run test:integration:staging
```

### 4. **Production Deployment**

```bash
# Backup before migration
./scripts/backup-production.js

# Apply to production
supabase db push --project production-project-id

# Validate production
./scripts/validate-migration.js
```

---

## 🛡️ Safety Mechanisms

### 1. **Migration Validation**

- Syntax checking before application
- Dependency verification
- Rollback script validation
- Performance impact estimation

### 2. **Automatic Backups**

- Pre-migration database backup
- Schema snapshot creation
- Critical data export
- Recovery point establishment

### 3. **Rollback Procedures**

```sql
-- Each migration includes rollback information
SELECT record_migration(
  '009_feature_name.sql',
  'checksum_hash',
  execution_time_ms,
  success_status,
  error_message,
  'ROLLBACK SQL COMMANDS HERE'
);
```

### 4. **Monitoring and Alerts**

- Migration execution monitoring
- Performance impact tracking
- Error notification system
- Rollback trigger conditions

---

## 📊 Schema Version Tracking

### Current Schema Version: 1.0.8

| Version | Migration              | Description           | Date       | Status     |
| ------- | ---------------------- | --------------------- | ---------- | ---------- |
| 1.0.1   | 001_initial_schema     | Core tables and types | 2024-01-15 | ✅ Applied |
| 1.0.2   | 002_extended_schema    | Additional tables     | 2024-01-16 | ✅ Applied |
| 1.0.3   | 003_rls_policies       | Row Level Security    | 2024-01-17 | ✅ Applied |
| 1.0.4   | 004_functions_views    | Functions and views   | 2024-01-18 | ✅ Applied |
| 1.0.5   | 005_migration_tracking | Migration system      | 2024-01-19 | ✅ Applied |
| 1.0.6   | 006_spatial_indexes    | Spatial indexes       | 2024-01-20 | ✅ Applied |
| 1.0.7   | 007_core_rls_policies  | Core RLS policies     | 2024-01-21 | ✅ Applied |
| 1.0.8   | 008_seed_data          | Development seed data | 2024-01-22 | ✅ Applied |

---

## 🔧 Migration Tools and Scripts

### 1. **Migration Creation**

```javascript
// scripts/create-migration.js
// Generates new migration file with template
```

### 2. **Migration Validation**

```javascript
// scripts/validate-migration.js
// Checks migration syntax and dependencies
```

### 3. **Schema Comparison**

```javascript
// scripts/compare-schemas.js
// Compares schemas between environments
```

### 4. **Rollback Execution**

```javascript
// scripts/rollback-migration.js
// Executes rollback for specific migration
```

---

## 📈 Performance Considerations

### 1. **Large Table Migrations**

- Use `CONCURRENTLY` for index creation
- Batch data updates to avoid locks
- Schedule during low-traffic periods
- Monitor query performance impact

### 2. **Zero-Downtime Deployments**

- Additive changes first
- Backward-compatible modifications
- Feature flags for new functionality
- Gradual rollout strategies

### 3. **Resource Management**

- Memory usage monitoring
- Connection pool management
- Lock duration minimization
- Parallel execution where safe

---

## 🔍 Troubleshooting

### Common Issues

1. **Migration Conflicts**: Resolve through rebase or merge
2. **Performance Degradation**: Rollback and optimize
3. **Data Integrity**: Validate constraints and relationships
4. **Permission Errors**: Check RLS policies and grants

### Recovery Procedures

1. **Failed Migration**: Automatic rollback trigger
2. **Partial Application**: Manual cleanup and retry
3. **Data Corruption**: Restore from backup
4. **Performance Issues**: Query optimization and indexing

---

## 📚 Best Practices

### DO ✅

- Always test migrations on staging first
- Include rollback scripts for complex changes
- Document breaking changes clearly
- Use transactions for atomic operations
- Validate data integrity after migrations

### DON'T ❌

- Skip migration numbering sequence
- Apply migrations directly to production
- Ignore performance impact testing
- Remove old migration files
- Modify existing migration files after application

---

## 🎯 Future Enhancements

1. **Automated Schema Diffing**: Compare environments automatically
2. **Migration Scheduling**: Queue migrations for optimal timing
3. **Impact Analysis**: Predict performance and compatibility issues
4. **Visual Schema History**: Graphical representation of changes
5. **Integration Testing**: Automated validation of schema changes

---

📝 **Note**: This versioning strategy ensures reliable, trackable, and safe database evolution
throughout the ConstructTrack project lifecycle.
