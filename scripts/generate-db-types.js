#!/usr/bin/env node

/**
 * Generate TypeScript types from Supabase database schema
 * This script generates types for the extended ConstructTrack database schema
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = {
  info: msg => console.log(`ℹ️  ${msg}`),
  success: msg => console.log(`✅ ${msg}`),
  error: msg => console.error(`❌ ${msg}`),
  warn: msg => console.warn(`⚠️  ${msg}`),
};

async function generateDatabaseTypes() {
  try {
    logger.info('Generating TypeScript types from Supabase database schema...');

    // Check if Supabase CLI is available
    try {
      execSync('supabase --version', { stdio: 'pipe' });
    } catch {
      logger.error('Supabase CLI not found. Please install it first:');
      logger.error('npm install -g supabase');
      process.exit(1);
    }

    // Generate types from local Supabase instance
    const outputPath = path.join(
      __dirname,
      '../packages/supabase/types/database.ts'
    );

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      logger.info(`Created directory: ${outputDir}`);
    }

    logger.info('Generating types from local Supabase instance...');

    try {
      execSync('supabase gen types typescript --local', {
        stdio: ['inherit', fs.openSync(outputPath, 'w'), 'inherit'],
      });
      logger.success(`Types generated successfully at: ${outputPath}`);
    } catch {
      logger.warn('Local generation failed, trying with project reference...');

      // Fallback: try with project reference if available
      try {
        execSync('supabase gen types typescript --project-id constructtrack', {
          stdio: ['inherit', fs.openSync(outputPath, 'w'), 'inherit'],
        });
        logger.success(`Types generated successfully at: ${outputPath}`);
      } catch {
        logger.error(
          'Failed to generate types. Make sure Supabase is running locally or project is configured.'
        );
        logger.error('Run: supabase start');
        process.exit(1);
      }
    }

    // Validate the generated file
    if (fs.existsSync(outputPath)) {
      const content = fs.readFileSync(outputPath, 'utf8');

      // Check if the file contains our new tables
      const expectedTables = [
        'equipment',
        'materials',
        'work_areas',
        'forms',
        'form_submissions',
        'documents',
        'time_entries',
        'notifications',
        'whatsapp_chats',
        'whatsapp_messages',
        'audit_logs',
      ];

      const missingTables = expectedTables.filter(
        table => !content.includes(table)
      );

      if (missingTables.length > 0) {
        logger.warn(
          `Some expected tables are missing from generated types: ${missingTables.join(', ')}`
        );
        logger.warn(
          "This might indicate that migrations haven't been applied yet."
        );
      } else {
        logger.success('All expected tables found in generated types!');
      }

      // Check file size (should be substantial with all our tables)
      const stats = fs.statSync(outputPath);
      logger.info(
        `Generated types file size: ${(stats.size / 1024).toFixed(2)} KB`
      );

      if (stats.size < 10000) {
        // Less than 10KB seems too small
        logger.warn(
          'Generated types file seems smaller than expected. Check if all migrations are applied.'
        );
      }
    } else {
      logger.error('Types file was not generated successfully.');
      process.exit(1);
    }

    logger.success('Database types generation completed!');
    logger.info('Next steps:');
    logger.info(
      '1. Review the generated types in packages/supabase/types/database.ts'
    );
    logger.info('2. Update any TypeScript files that use database types');
    logger.info('3. Run tests to ensure type compatibility');
  } catch (error) {
    logger.error(`Error generating database types: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDatabaseTypes();
}

export { generateDatabaseTypes };
