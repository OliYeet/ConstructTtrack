#!/usr/bin/env node

/**
 * ConstructTrack Database Migration Manager
 * Comprehensive migration system with versioning, rollbacks, and safety checks
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = {
  info: msg => console.log(`ℹ️  ${msg}`),
  success: msg => console.log(`✅ ${msg}`),
  error: msg => console.error(`❌ ${msg}`),
  warn: msg => console.warn(`⚠️  ${msg}`),
  debug: msg => console.log(`🔍 ${msg}`),
};

class MigrationManager {
  constructor() {
    this.migrationsDir = path.join(__dirname, '../supabase/migrations');
    this.backupsDir = path.join(__dirname, '../supabase/backups');
    this.configPath = path.join(__dirname, '../supabase/config.toml');

    // Supabase connection
    this.supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!this.supabaseKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is required for the migration manager'
      );
    }

    this.supabase = null;
    this.migrationTable = 'schema_migrations';
  }

  async initialize() {
    try {
      // Ensure directories exist
      if (!fs.existsSync(this.migrationsDir)) {
        fs.mkdirSync(this.migrationsDir, { recursive: true });
      }

      if (!fs.existsSync(this.backupsDir)) {
        fs.mkdirSync(this.backupsDir, { recursive: true });
      }

      // Initialize Supabase client
      if (this.supabaseKey) {
        this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        await this.ensureMigrationTable();
      }

      logger.success('Migration manager initialized');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize migration manager: ${error.message}`);
      return false;
    }
  }

  async ensureMigrationTable() {
    try {
      // Create migration tracking table if it doesn't exist
      const { error } = await this.supabase.rpc('create_migration_table');
      if (error && error.code === '42883') {
        // function not found, create table directly
        const { error: ddlError } = await this.supabase.rpc('execute_sql', {
          sql: `CREATE TABLE IF NOT EXISTS schema_migrations (
              filename text primary key,
              applied_at timestamptz not null,
              checksum text
            );`,
        });

        if (ddlError) {
          throw ddlError;
        }
      }

      if (error && !error.message.includes('already exists')) {
        throw error;
      }

      logger.debug('Migration tracking table ensured');
    } catch (err) {
      logger.warn(`Could not ensure migration table: ${err.message}`);
    }
  }

  async checkSupabaseCLI() {
    try {
      execSync('supabase --version', { stdio: 'pipe' });
      return true;
    } catch {
      logger.error('Supabase CLI not found. Please install it:');
      logger.error('npm install -g supabase');
      return false;
    }
  }

  async createMigration(name, description = '') {
    try {
      if (!(await this.checkSupabaseCLI())) {
        return false;
      }

      logger.info(`Creating new migration: ${name}`);

      // Generate timestamp-based filename
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..+/, '');
      const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
      const filepath = path.join(this.migrationsDir, filename);

      // Create migration file with template
      const template = this.getMigrationTemplate(name, description);
      fs.writeFileSync(filepath, template);

      logger.success(`Migration created: ${filename}`);
      logger.info(`Edit the migration file at: ${filepath}`);

      return { filename, filepath };
    } catch (error) {
      logger.error(`Failed to create migration: ${error.message}`);
      return false;
    }
  }

  getMigrationTemplate(name, description) {
    return `-- Migration: ${name}
-- Description: ${description}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example_table (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     name TEXT NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Don't forget to:
-- 1. Add appropriate indexes
-- 2. Set up Row Level Security if needed
-- 3. Add any necessary triggers
-- 4. Update this comment with actual changes made

-- Rollback instructions (for manual rollback if needed):
-- DROP TABLE IF EXISTS example_table;
`;
  }

  async listMigrations() {
    try {
      const files = fs
        .readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      logger.info(`Found ${files.length} migration files:`);

      for (const file of files) {
        const filepath = path.join(this.migrationsDir, file);
        const content = fs.readFileSync(filepath, 'utf8');
        const descMatch = content.match(/-- Description: (.+)/);
        const description = descMatch ? descMatch[1] : 'No description';

        logger.info(`  📄 ${file}`);
        logger.info(`     ${description}`);
      }

      return files;
    } catch (error) {
      logger.error(`Failed to list migrations: ${error.message}`);
      return [];
    }
  }

  async getMigrationStatus() {
    try {
      if (!this.supabase) {
        logger.warn(
          'Supabase client not available - cannot check migration status'
        );
        return null;
      }

      const { data, error } = await this.supabase
        .from(this.migrationTable)
        .select('*')
        .order('applied_at', { ascending: true });

      if (error) {
        logger.warn(`Could not fetch migration status: ${error.message}`);
        return null;
      }

      return data || [];
    } catch (error) {
      logger.warn(`Could not get migration status: ${error.message}`);
      return null;
    }
  }

  async runMigrations(options = {}) {
    try {
      const { dryRun = false, target = null, backup = true } = options;

      if (!(await this.checkSupabaseCLI())) {
        return false;
      }

      logger.info('Running database migrations...');

      // Create backup if requested
      if (backup && !dryRun) {
        await this.createBackup();
      }

      // Get current migration status
      await this.getMigrationStatus();
      const allMigrations = await this.listMigrations();

      if (dryRun) {
        logger.info('DRY RUN - No changes will be applied');
        logger.info(`Would apply ${allMigrations.length} migrations`);
        return true;
      }

      // Run migrations using Supabase CLI
      const command = target
        ? `supabase db push --target ${target}`
        : 'supabase db push';

      logger.info(`Executing: ${command}`);
      execSync(command, { stdio: 'inherit' });

      // Record successful migration
      await this.recordMigrationSuccess(allMigrations);

      logger.success('Migrations completed successfully');
      return true;
    } catch (error) {
      logger.error(`Migration failed: ${error.message}`);
      return false;
    }
  }

  async recordMigrationSuccess(migrations) {
    try {
      if (!this.supabase) return;

      const timestamp = new Date().toISOString();

      const applied = new Set(
        (await this.getMigrationStatus())?.map(m => m.filename)
      );
      for (const migration of migrations.filter(m => !applied.has(m))) {
        const { error } = await this.supabase.from(this.migrationTable).upsert({
          filename: migration,
          applied_at: timestamp,
          checksum: this.calculateChecksum(migration),
        });

        if (error) {
          logger.warn(
            `Could not record migration ${migration}: ${error.message}`
          );
        }
      }
    } catch (err) {
      logger.warn(`Could not record migration success: ${err.message}`);
    }
  }

  calculateChecksum(filename) {
    try {
      const filepath = path.join(this.migrationsDir, filename);
      const content = fs.readFileSync(filepath, 'utf8');

      // Simple checksum calculation
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }

      return hash.toString(16);
    } catch {
      return 'unknown';
    }
  }

  async createBackup() {
    try {
      logger.info('Creating database backup...');

      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..+/, '');
      const backupFile = path.join(this.backupsDir, `backup_${timestamp}.sql`);

      // Use Supabase CLI to create backup
      const command = `supabase db dump --file ${backupFile}`;
      execSync(command, { stdio: 'pipe' });

      logger.success(`Backup created: ${backupFile}`);
      return backupFile;
    } catch (error) {
      logger.warn(`Could not create backup: ${error.message}`);
      return null;
    }
  }

  async resetDatabase() {
    try {
      if (!(await this.checkSupabaseCLI())) {
        return false;
      }

      logger.warn('⚠️  This will reset the database to initial state!');

      // Create backup before reset
      await this.createBackup();

      logger.info('Resetting database...');
      execSync('supabase db reset', { stdio: 'inherit' });

      logger.success('Database reset completed');
      return true;
    } catch (error) {
      logger.error(`Database reset failed: ${error.message}`);
      return false;
    }
  }

  async validateMigrations() {
    try {
      logger.info('Validating migration files...');

      const files = await this.listMigrations();
      let hasErrors = false;

      for (const file of files) {
        const filepath = path.join(this.migrationsDir, file);
        const content = fs.readFileSync(filepath, 'utf8');

        // Basic validation
        if (content.trim().length === 0) {
          logger.error(`Empty migration file: ${file}`);
          hasErrors = true;
          continue;
        }

        // Check for dangerous operations
        const dangerousPatterns = [
          /DROP\s+DATABASE/i,
          /TRUNCATE\s+TABLE/i,
          /DELETE\s+FROM\s+\w+\s*;?\s*$/im,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            logger.warn(
              `Potentially dangerous operation in ${file}: ${pattern}`
            );
          }
        }

        logger.debug(`✓ ${file} validated`);
      }

      if (hasErrors) {
        logger.error('Migration validation failed');
        return false;
      }

      logger.success('All migrations validated successfully');
      return true;
    } catch (error) {
      logger.error(`Migration validation failed: ${error.message}`);
      return false;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new MigrationManager();
  await manager.initialize();

  switch (command) {
    case 'create': {
      const name = args[1];
      const description = args.slice(2).join(' ');
      if (!name) {
        logger.error('Usage: migration-manager create <name> [description]');
        process.exit(1);
      }
      await manager.createMigration(name, description);
      break;
    }

    case 'list':
      await manager.listMigrations();
      break;

    case 'status': {
      const status = await manager.getMigrationStatus();
      if (status) {
        logger.info('Migration Status:');
        status.forEach(m => {
          logger.info(`  ✅ ${m.filename} (${m.applied_at})`);
        });
      }
      break;
    }

    case 'run': {
      const runOptions = {
        dryRun: args.includes('--dry-run'),
        backup: !args.includes('--no-backup'),
        target: args.find(arg => arg.startsWith('--target='))?.split('=')[1],
      };
      await manager.runMigrations(runOptions);
      break;
    }

    case 'validate':
      await manager.validateMigrations();
      break;

    case 'backup':
      await manager.createBackup();
      break;

    case 'reset': {
      if (args.includes('--confirm')) {
        await manager.resetDatabase();
      } else {
        logger.error('Database reset requires --confirm flag');
        logger.error('Usage: migration-manager reset --confirm');
      }
      break;
    }

    case 'help':
    default:
      console.log(`
ConstructTrack Migration Manager

Usage: node migration-manager.js <command> [options]

Commands:
  create <name> [description]  Create a new migration file
  list                        List all migration files
  status                      Show migration status from database
  run [options]               Run pending migrations
    --dry-run                 Show what would be applied without running
    --no-backup               Skip creating backup before migration
    --target=<env>            Target specific environment
  validate                    Validate migration files
  backup                      Create database backup
  reset --confirm             Reset database (requires confirmation)
  help                        Show this help message

Examples:
  node migration-manager.js create add_user_preferences "Add user preferences table"
  node migration-manager.js run --dry-run
  node migration-manager.js status
      `);
      break;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error(`Migration manager failed: ${error.message}`);
    process.exit(1);
  });
}

export { MigrationManager };
