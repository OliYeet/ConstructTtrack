#!/usr/bin/env node

/**
 * Database Setup Script for ConstructTrack
 * Sets up the complete database schema with all migrations
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = {
  info: msg => console.log(`ℹ️  ${msg}`),
  success: msg => console.log(`✅ ${msg}`),
  error: msg => console.error(`❌ ${msg}`),
  warn: msg => console.warn(`⚠️  ${msg}`),
};

class DatabaseSetup {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!this.supabaseKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is required for setup tasks (inserts, migrations)'
      );
    }
    this.migrationsDir = path.join(__dirname, '../supabase/migrations');
  }

  async checkSupabaseConnection() {
    try {
      logger.info('Checking Supabase connection...');

      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      // Use a simple version check that doesn't depend on specific tables or error codes
      try {
        // Skip non-portable RPC; use information_schema directly
        // If version RPC fails, try a simple query that should always work
// The special /rest/v1/ root returns 200 when the instance is up
const { error: fallbackError } = await supabase
  .rpc('version');               // ← or any cheap harmless RPC you define
// A healthy “select 1” through the SQL endpoint is portable and always available
const { error: pingError } = await supabase
  .rpc('sql', { query: 'select 1' }); // requires an exposed `sql` rpc or use /sql endpoint via fetch
if (pingError) { throw pingError; }
        }
      } catch {
        // Final fallback - check database connectivity
        const { error: basicError } = await supabase
          .from('pg_catalog.pg_tables')
          .select('schemaname')
          .limit(1);
        if (basicError) {
          throw new Error('Unable to connect to Supabase database');
        }
      }

      logger.success('Supabase connection established');
      return true;
    } catch (error) {
      logger.error(`Failed to connect to Supabase: ${error.message}`);
      return false;
    }
  }

  async checkSupabaseCLI() {
    try {
      execSync('supabase --version', { stdio: 'pipe' });
      logger.success('Supabase CLI is available');
      return true;
    } catch {
      logger.error('Supabase CLI not found. Please install it:');
      logger.error('npm install -g supabase');
      return false;
    }
  }

  async startLocalSupabase() {
    try {
      logger.info('Starting local Supabase...');
      logger.warn('⚠️  Please start Supabase manually in a separate terminal:');
      logger.warn('   supabase start');
      logger.info('Waiting for Supabase to be available...');

      // Poll for Supabase availability instead of blocking
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds

      while (attempts < maxAttempts) {
        try {
          const supabase = createClient(this.supabaseUrl, this.supabaseKey);
          const { error } = await supabase.auth.getSession();
          if (!error || !error.message.includes('connection')) {
            logger.success('Local Supabase is available');
            return true;
          }
        } catch {
          // Continue polling
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        if (attempts % 5 === 0) {
          logger.info(
            `Still waiting for Supabase... (${attempts}/${maxAttempts})`
          );
        }
      }

      logger.error('Timeout waiting for Supabase to start');
      logger.error('Please ensure Supabase is running: supabase start');
      return false;
    } catch (error) {
      logger.error(`Failed to start local Supabase: ${error.message}`);
      return false;
    }
  }

  async runMigrations() {
    try {
      logger.info('Running database migrations...');

      // Check if migrations directory exists
      if (!fs.existsSync(this.migrationsDir)) {
        logger.error(`Migrations directory not found: ${this.migrationsDir}`);
        return false;
      }

      // Get list of migration files
      const migrationFiles = fs
        .readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      logger.info(`Found ${migrationFiles.length} migration files:`);
      migrationFiles.forEach(file => logger.info(`  - ${file}`));

      // Run migrations using Supabase CLI
      const result = spawnSync('supabase', ['db', 'push'], {
        stdio: 'inherit',
      });
      if (result.status !== 0) {
        throw new Error(`Migration failed with exit code ${result.status}`);
      }

      logger.success('All migrations applied successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to run migrations: ${error.message}`);
      return false;
    }
  }

  async generateTypes() {
    try {
      logger.info('Generating TypeScript types...');

      // Use dynamic import for ES modules
      const { generateDatabaseTypes } = await import('./generate-db-types.js');
      await generateDatabaseTypes();

      logger.success('TypeScript types generated');
      return true;
    } catch (error) {
      logger.error(`Failed to generate types: ${error.message}`);
      return false;
    }
  }

  async seedTestData() {
    try {
      logger.info('Seeding test data...');

      const supabase = createClient(this.supabaseUrl, this.supabaseKey);

      // Create test organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: 'ConstructTrack Demo',
          slug: 'constructtrack-demo',
          email: 'demo@constructtrack.com',
          phone: '+1-555-0123',
          address: '123 Demo Street, Demo City, DC 12345',
        })
        .select()
        .single();

      if (orgError) {
        logger.warn(`Test organization may already exist: ${orgError.message}`);
      } else {
        logger.success(`Created test organization: ${org.name}`);
      }

      // Add more seed data as needed
      logger.success('Test data seeded successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to seed test data: ${error.message}`);
      return false;
    }
  }

  async validateSchema() {
    try {
      logger.info('Validating database schema...');

      const supabase = createClient(this.supabaseUrl, this.supabaseKey);

      // Check core tables
      const coreTables = [
        'organizations',
        'profiles',
        'projects',
        'fiber_routes',
        'fiber_connections',
        'tasks',
        'photos',
        'customer_agreements',
      ];

      // Check extended tables
      const extendedTables = [
        'equipment',
        'materials',
        'work_areas',
        'forms',
        'documents',
        'time_entries',
        'notifications',
        'audit_logs',
      ];

      const allTables = [...coreTables, ...extendedTables];

      for (const table of allTables) {
        // Use count() instead of select() with limit(0) to avoid full scan
        const { error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        if (error) {
          logger.error(`Table ${table} validation failed: ${error.message}`);
          return false;
        }
      }

      logger.success(`All ${allTables.length} tables validated successfully`);
      return true;
    } catch (error) {
      logger.error(`Schema validation failed: ${error.message}`);
      return false;
    }
  }

  async setup(options = {}) {
    const {
      skipCLICheck = false,
      skipLocalStart = false,
      skipMigrations = false,
      skipTypes = false,
      skipSeed = false,
      skipValidation = false,
    } = options;

    logger.info('🚀 Starting ConstructTrack database setup...');

    // Step 1: Check Supabase CLI
    if (!skipCLICheck && !(await this.checkSupabaseCLI())) {
      return false;
    }

    // Step 2: Start local Supabase (if needed)
    if (!skipLocalStart && this.supabaseUrl.includes('localhost')) {
      if (!(await this.startLocalSupabase())) {
        return false;
      }
    }

    // Step 3: Check connection
    if (!(await this.checkSupabaseConnection())) {
      return false;
    }

    // Step 4: Run migrations
    if (!skipMigrations && !(await this.runMigrations())) {
      return false;
    }

    // Step 5: Generate TypeScript types
    if (!skipTypes && !(await this.generateTypes())) {
      return false;
    }

    // Step 6: Seed test data
    if (!skipSeed && !(await this.seedTestData())) {
      return false;
    }

    // Step 7: Validate schema
    if (!skipValidation && !(await this.validateSchema())) {
      return false;
    }

    logger.success('🎉 Database setup completed successfully!');
    logger.info('Next steps:');
    logger.info(
      '1. Review the generated types in packages/supabase/types/database.ts'
    );
    logger.info('2. Run tests: npm test');
    logger.info('3. Start the development server: npm run dev');

    return true;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  args.forEach(arg => {
    switch (arg) {
      case '--skip-cli-check':
        options.skipCLICheck = true;
        break;
      case '--skip-local-start':
        options.skipLocalStart = true;
        break;
      case '--skip-migrations':
        options.skipMigrations = true;
        break;
      case '--skip-types':
        options.skipTypes = true;
        break;
      case '--skip-seed':
        options.skipSeed = true;
        break;
      case '--skip-validation':
        options.skipValidation = true;
        break;
      case '--help':
        console.log(`
ConstructTrack Database Setup

Usage: node setup-database.js [options]

Options:
  --skip-cli-check      Skip Supabase CLI availability check
  --skip-local-start    Skip starting local Supabase
  --skip-migrations     Skip running database migrations
  --skip-types          Skip generating TypeScript types
  --skip-seed           Skip seeding test data
  --skip-validation     Skip schema validation
  --help                Show this help message
        `);
        process.exit(0);
    }
  });

  const setup = new DatabaseSetup();
  const success = await setup.setup(options);

  process.exit(success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    logger.error(`Setup failed: ${error.message}`);
    process.exit(1);
  });
}

export { DatabaseSetup };
