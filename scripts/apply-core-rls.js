#!/usr/bin/env node

/**
 * Apply Core RLS Policies Migration
 *
 * This script applies the critical missing RLS policies for core tables
 * and validates the security setup.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class CoreRLSManager {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error(chalk.red('❌ Missing required environment variables:'));
      console.error(chalk.red('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'));
      process.exit(1);
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
    };

    console.log(`${colors[type](`[${timestamp}]`)} ${message}`);
  }

  async checkConnection() {
    try {
      const { error } = await this.supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (error && error.code !== '42501') {
        // 42501 = insufficient_privilege
        throw error;
      }

      this.log('✅ Supabase connection established', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Failed to connect to Supabase: ${error.message}`, 'error');
      return false;
    }
  }

  async applyMigration() {
    try {
      this.log('📋 Applying core RLS policies migration...', 'info');

      const migrationPath = join(
        process.cwd(),
        'supabase/migrations/007_core_rls_policies.sql'
      );

      if (!existsSync(migrationPath)) {
        throw new Error('Migration file not found: 007_core_rls_policies.sql');
      }

      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Split the migration into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      this.log(`📝 Executing ${statements.length} SQL statements...`, 'info');

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            const { error } = await this.supabase.rpc('exec_sql', {
              sql: statement + ';',
            });

            if (error) {
              // Check if it's a "policy already exists" error (which is OK)
              if (error.message.includes('already exists')) {
                this.log(
                  `⚠️  Policy already exists (skipping): ${error.message}`,
                  'warning'
                );
                continue;
              }
              throw error;
            }

            this.log(
              `✅ Statement ${i + 1}/${statements.length} executed`,
              'success'
            );
          } catch (error) {
            this.log(
              `❌ Failed to execute statement ${i + 1}: ${error.message}`,
              'error'
            );
            throw error;
          }
        }
      }

      this.log(
        '✅ Core RLS policies migration applied successfully!',
        'success'
      );
      return true;
    } catch (error) {
      this.log(`❌ Migration failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateRLSPolicies() {
    try {
      this.log('🔍 Validating RLS policies...', 'info');

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

      const { data: policies, error } = await this.supabase.rpc('exec_sql', {
        sql: `
            SELECT 
              schemaname,
              tablename,
              policyname,
              permissive,
              roles,
              cmd,
              qual,
              with_check
            FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = ANY($1)
            ORDER BY tablename, policyname;
          `,
        params: [coreTables],
      });

      if (error) {
        throw error;
      }

      // Group policies by table
      const policiesByTable = {};
      if (policies && policies.length > 0) {
        policies.forEach(policy => {
          if (!policiesByTable[policy.tablename]) {
            policiesByTable[policy.tablename] = [];
          }
          policiesByTable[policy.tablename].push(policy);
        });
      }

      // Check each core table
      const missingPolicies = [];
      coreTables.forEach(table => {
        const tablePolicies = policiesByTable[table] || [];
        this.log(`📋 ${table}: ${tablePolicies.length} policies found`, 'info');

        if (tablePolicies.length === 0) {
          missingPolicies.push(table);
        }
      });

      if (missingPolicies.length > 0) {
        this.log(
          `⚠️  Tables missing RLS policies: ${missingPolicies.join(', ')}`,
          'warning'
        );
        return false;
      }

      this.log('✅ All core tables have RLS policies configured!', 'success');
      return true;
    } catch (error) {
      this.log(`❌ RLS validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async checkRLSEnabled() {
    try {
      this.log('🔒 Checking RLS enablement status...', 'info');

      const { data: rlsStatus, error } = await this.supabase.rpc('exec_sql', {
        sql: `
            SELECT 
              schemaname,
              tablename,
              rowsecurity,
              forcerowsecurity
            FROM pg_tables pt
            JOIN pg_class pc ON pc.relname = pt.tablename
            WHERE schemaname = 'public'
            AND tablename IN (
              'organizations', 'profiles', 'projects', 'fiber_routes',
              'fiber_connections', 'tasks', 'photos', 'customer_agreements'
            )
            ORDER BY tablename;
          `,
      });

      if (error) {
        throw error;
      }

      const tablesWithoutRLS = [];
      if (rlsStatus && rlsStatus.length > 0) {
        rlsStatus.forEach(table => {
          const status = table.rowsecurity ? '✅ Enabled' : '❌ Disabled';
          this.log(
            `🔒 ${table.tablename}: ${status}`,
            table.rowsecurity ? 'success' : 'error'
          );

          if (!table.rowsecurity) {
            tablesWithoutRLS.push(table.tablename);
          }
        });
      }

      if (tablesWithoutRLS.length > 0) {
        this.log(
          `❌ Tables without RLS: ${tablesWithoutRLS.join(', ')}`,
          'error'
        );
        return false;
      }

      this.log('✅ All core tables have RLS enabled!', 'success');
      return true;
    } catch (error) {
      this.log(`❌ RLS status check failed: ${error.message}`, 'error');
      return false;
    }
  }

  async run() {
    console.log(chalk.blue.bold('🔐 ConstructTrack Core RLS Setup'));
    console.log(chalk.blue('=====================================\n'));

    // Step 1: Check connection
    if (!(await this.checkConnection())) {
      process.exit(1);
    }

    // Step 2: Check RLS enablement
    if (!(await this.checkRLSEnabled())) {
      this.log(
        "⚠️  Some tables don't have RLS enabled. This should have been done in initial migration.",
        'warning'
      );
    }

    // Step 3: Apply migration
    if (!(await this.applyMigration())) {
      process.exit(1);
    }

    // Step 4: Validate policies
    if (!(await this.validateRLSPolicies())) {
      this.log(
        '⚠️  Some RLS policies may be missing. Please review the output above.',
        'warning'
      );
    }

    console.log(
      chalk.green.bold('\n🎉 Core RLS setup completed successfully!')
    );
    console.log(
      chalk.green(
        'Your database now has comprehensive Row Level Security policies.'
      )
    );
    console.log(chalk.yellow('\n📝 Next steps:'));
    console.log(
      chalk.yellow('1. Test the RLS policies with different user roles')
    );
    console.log(
      chalk.yellow(
        '2. Continue with API design and documentation (Story 0.75.1)'
      )
    );
    console.log(
      chalk.yellow('3. Set up real-time subscriptions (Story 0.75.3)')
    );
  }
}

// Run the script
const manager = new CoreRLSManager();
manager.run().catch(error => {
  console.error(chalk.red('💥 Script failed:'), error);
  process.exit(1);
});
