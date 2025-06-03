#!/usr/bin/env node

/**
 * Database Schema Validation Script
 * Validates the ConstructTrack database schema design without requiring Supabase CLI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = {
  info: msg => console.log(`ℹ️  ${msg}`),
  success: msg => console.log(`✅ ${msg}`),
  error: msg => console.error(`❌ ${msg}`),
  warn: msg => console.warn(`⚠️  ${msg}`),
};

class SchemaValidator {
  constructor() {
    this.migrationsDir = path.join(__dirname, '../supabase/migrations');
    this.docsDir = path.join(__dirname, '../docs/database');
  }

  validateMigrationFiles() {
    logger.info('Validating migration files...');

    if (!fs.existsSync(this.migrationsDir)) {
      logger.error(`Migrations directory not found: ${this.migrationsDir}`);
      return false;
    }

    const migrationFiles = fs
      .readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      logger.error('No migration files found');
      return false;
    }

    logger.info(`Found ${migrationFiles.length} migration files:`);
    migrationFiles.forEach(file => logger.info(`  - ${file}`));

    // Validate each migration file
    const expectedFiles = [
      '001_initial_schema.sql',
      '002_extended_schema.sql',
      '003_rls_policies.sql',
      '004_functions_views.sql',
    ];

    const missingFiles = expectedFiles.filter(
      file => !migrationFiles.includes(file)
    );
    if (missingFiles.length > 0) {
      logger.warn(
        `Missing expected migration files: ${missingFiles.join(', ')}`
      );
    }

    // Validate SQL syntax (basic check)
    for (const file of migrationFiles) {
      const filePath = path.join(this.migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      if (!this.validateSQLSyntax(content, file)) {
        return false;
      }
    }

    logger.success('All migration files validated successfully');
    return true;
  }

  validateSQLSyntax(content, filename) {
    // Basic SQL syntax validation
    const lines = content.split('\n');
    let hasErrors = false;

    // Check for common SQL syntax issues (patterns for validation)
    // These patterns help validate SQL structure

    // Check for balanced parentheses
    let parenCount = 0;
    let inString = false;
    let inComment = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];

        // Handle string literals
        if (char === "'" && !inComment) {
          inString = !inString;
          continue;
        }

        // Handle comments
        if (char === '-' && nextChar === '-' && !inString) {
          inComment = true;
          break; // Rest of line is comment
        }

        // Count parentheses only if not in string or comment
        if (!inString && !inComment) {
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
        }
      }

      inComment = false; // Reset comment flag for next line
    }

    if (parenCount !== 0) {
      logger.error(`${filename}: Unbalanced parentheses (${parenCount})`);
      hasErrors = true;
    }

    // Check for required patterns
    const hasCreateTable = /CREATE TABLE/i.test(content);

    if (filename.includes('schema') && !hasCreateTable) {
      logger.warn(`${filename}: No CREATE TABLE statements found`);
    }

    if (filename.includes('rls')) {
      const hasPolicies = /CREATE POLICY/i.test(content);
      if (!hasPolicies) {
        logger.warn(`${filename}: No RLS policies found`);
      }
    }

    return !hasErrors;
  }

  validateSchemaDocumentation() {
    logger.info('Validating schema documentation...');

    const schemaDocPath = path.join(this.docsDir, 'schema-design.md');

    if (!fs.existsSync(schemaDocPath)) {
      logger.error(`Schema documentation not found: ${schemaDocPath}`);
      return false;
    }

    const content = fs.readFileSync(schemaDocPath, 'utf8');

    // Check for required sections
    const requiredSections = [
      'Entity Relationship Overview',
      'Core Tables',
      'Extended Tables',
      'Performance Optimization',
      'Security Considerations',
    ];

    const missingSections = requiredSections.filter(
      section => !content.includes(section)
    );

    if (missingSections.length > 0) {
      logger.warn(
        `Missing documentation sections: ${missingSections.join(', ')}`
      );
    }

    // Check for table documentation
    const expectedTables = [
      'equipment',
      'materials',
      'work_areas',
      'forms',
      'documents',
      'time_entries',
      'notifications',
      'audit_logs',
    ];

    const missingTableDocs = expectedTables.filter(
      table => !content.toLowerCase().includes(table)
    );

    if (missingTableDocs.length > 0) {
      logger.warn(
        `Missing table documentation: ${missingTableDocs.join(', ')}`
      );
    }

    logger.success('Schema documentation validated');
    return true;
  }

  validateTableRelationships() {
    logger.info('Validating table relationships...');

    // Read the initial schema to understand relationships
    const initialSchemaPath = path.join(
      this.migrationsDir,
      '001_initial_schema.sql'
    );
    const extendedSchemaPath = path.join(
      this.migrationsDir,
      '002_extended_schema.sql'
    );

    if (
      !fs.existsSync(initialSchemaPath) ||
      !fs.existsSync(extendedSchemaPath)
    ) {
      logger.error('Required schema files not found');
      return false;
    }

    const initialSchema = fs.readFileSync(initialSchemaPath, 'utf8');
    const extendedSchema = fs.readFileSync(extendedSchemaPath, 'utf8');
    const combinedSchema = initialSchema + '\n' + extendedSchema;

    // Extract table names (including quoted identifiers)
    const tableMatches =
      combinedSchema.match(
        /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:"[^"]+"|[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)?)/gi
      ) || [];
    const tables = tableMatches.map(match =>
      match.replace(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?/i, '').replace(/"/g, '').toLowerCase()
    );

    logger.info(`Found ${tables.length} tables: ${tables.join(', ')}`);

    // Extract foreign key references
    const fkMatches = combinedSchema.match(/REFERENCES\s+(\w+)\s*\(/gi) || [];
    const referencedTables = fkMatches.map(match =>
      match
        .replace(/REFERENCES\s+/i, '')
        .replace(/\s*\(.*/, '')
        .toLowerCase()
    );

    // Check that all referenced tables exist
    const missingReferences = referencedTables.filter(
      ref => !tables.includes(ref) && ref !== 'auth.users' // auth.users is from Supabase
    );

    if (missingReferences.length > 0) {
      logger.error(
        `Missing referenced tables: ${missingReferences.join(', ')}`
      );
      return false;
    }

    logger.success('Table relationships validated');
    return true;
  }

  validateIndexes() {
    logger.info('Validating database indexes...');

    const extendedSchemaPath = path.join(
      this.migrationsDir,
      '002_extended_schema.sql'
    );

    if (!fs.existsSync(extendedSchemaPath)) {
      logger.error('Extended schema file not found');
      return false;
    }

    const content = fs.readFileSync(extendedSchemaPath, 'utf8');

    // Check for index creation
    const indexMatches = content.match(/CREATE INDEX\s+\w+/gi) || [];

    if (indexMatches.length === 0) {
      logger.warn('No indexes found in extended schema');
      return false;
    }

    logger.info(`Found ${indexMatches.length} indexes`);

    // Check for spatial indexes
    const spatialIndexes = content.match(/USING GIST/gi) || [];
    logger.info(`Found ${spatialIndexes.length} spatial indexes`);

    // Check for organization_id indexes (important for multi-tenancy)
    const orgIndexes = content.match(/organization_id/gi) || [];
    logger.info(`Found ${orgIndexes.length} organization_id indexes`);

    // Validate that essential indexes exist
    if (spatialIndexes.length === 0) {
      logger.error('No spatial indexes found - these are critical for geometry queries');
      return false;
    }

    if (orgIndexes.length === 0) {
      logger.error('No organization_id indexes found - these are critical for multi-tenant performance');
      return false;
    }

    logger.success('Database indexes validated');
    return true;
  }

  async validate() {
    logger.info('🔍 Starting ConstructTrack database schema validation...');

    const validations = [
      () => this.validateMigrationFiles(),
      () => this.validateSchemaDocumentation(),
      () => this.validateTableRelationships(),
      () => this.validateIndexes(),
    ];

    let allPassed = true;

    for (const validation of validations) {
      try {
        const result = await validation();
        if (!result) {
          allPassed = false;
        }
      } catch (error) {
        logger.error(`Validation error: ${error.message}`);
        allPassed = false;
      }
    }

    if (allPassed) {
      logger.success('🎉 All database schema validations passed!');
      logger.info('The database schema design is ready for implementation.');
    } else {
      logger.error(
        '❌ Some validations failed. Please review and fix the issues.'
      );
    }

    return allPassed;
  }
}

// CLI interface
async function main() {
  const validator = new SchemaValidator();
  const success = await validator.validate();
  process.exit(success ? 0 : 1);
}
import { fileURLToPath, pathToFileURL } from 'url';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    logger.error(`Validation failed: ${error.message}`);
    process.exit(1);
  });
}

export { SchemaValidator };
