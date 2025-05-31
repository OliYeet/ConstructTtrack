#!/usr/bin/env node

/**
 * ConstructTrack Notion Sync Setup Script
 *
 * This script helps you set up bidirectional sync between Notion and local files.
 */

import { config } from 'dotenv';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Load environment variables
config();

async function setupSync() {
  console.log(chalk.blue.bold('🔄 ConstructTrack Notion Sync Setup'));
  console.log(chalk.blue('=====================================\n'));

  // Check if .env file exists
  if (!existsSync('.env')) {
    console.log(
      chalk.yellow('⚠️  No .env file found. Creating from template...')
    );

    if (existsSync('.env.example')) {
      const envTemplate = readFileSync('.env.example', 'utf-8');
      writeFileSync('.env', envTemplate);
      console.log(chalk.green('✅ Created .env file from template'));
      console.log(
        chalk.yellow('📝 Please edit .env file with your Notion credentials\n')
      );
    } else {
      console.log(chalk.red('❌ No .env.example template found'));
      return;
    }
  }

  // Check required environment variables
  const requiredVars = ['NOTION_TOKEN', 'NOTION_DATABASE_ID'];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log(chalk.red('❌ Missing required environment variables:'));
    missingVars.forEach(varName => {
      console.log(chalk.red(`   - ${varName}`));
    });
    console.log(
      chalk.yellow(
        '\n📝 Please update your .env file with the missing values\n'
      )
    );
    return;
  }

  console.log(chalk.green('✅ Environment variables configured'));

  // Display setup instructions
  console.log(chalk.blue('\n📋 Setup Instructions:'));
  console.log(chalk.white('1. Install dependencies:'));
  console.log(chalk.gray('   npm install express'));

  console.log(chalk.white('\n2. Start the sync service:'));
  console.log(chalk.gray('   npm run notion:sync'));

  console.log(chalk.white('\n3. Configure Notion webhook:'));
  console.log(chalk.gray('   - Go to https://www.notion.so/my-integrations'));
  console.log(chalk.gray('   - Select your integration'));
  console.log(
    chalk.gray('   - Add webhook URL: http://localhost:3001/webhook')
  );
  console.log(
    chalk.gray('   - Subscribe to: page.updated, page.created, page.deleted')
  );

  console.log(chalk.white('\n4. Test the sync:'));
  console.log(
    chalk.gray('   - Make changes in Notion → Local files update automatically')
  );
  console.log(chalk.gray('   - Edit local markdown → Notion database updates'));

  console.log(chalk.blue('\n🔄 Sync Features:'));
  console.log(chalk.green('✅ Notion → Local: Real-time updates via webhooks'));
  console.log(chalk.green('✅ Local → Notion: File watching for changes'));
  console.log(chalk.green('✅ Automatic backups before overwriting'));
  console.log(chalk.green('✅ Status tracking and team assignments'));
  console.log(chalk.green('✅ Conflict resolution and error handling'));

  console.log(chalk.blue('\n📁 Generated Files:'));
  console.log(
    chalk.gray('- docs/constructtrack_agile_project_plan.md (synced)')
  );
  console.log(chalk.gray('- docs/project-status.json (auto-generated)'));
  console.log(chalk.gray('- docs/team-assignments.json (auto-generated)'));
  console.log(chalk.gray('- *.backup.* (automatic backups)'));

  console.log(chalk.yellow('\n💡 Pro Tips:'));
  console.log(
    chalk.gray('- Use ngrok for public webhook URL during development')
  );
  console.log(chalk.gray('- Set NOTION_WEBHOOK_SECRET for security'));
  console.log(chalk.gray('- Monitor logs for sync status and errors'));
  console.log(chalk.gray('- Check /health endpoint for service status'));

  console.log(chalk.green.bold('\n🎉 Setup complete! Ready to start syncing.'));
}

// Run setup
setupSync().catch(error => {
  console.error(chalk.red(`❌ Setup error: ${error.message}`));
  process.exit(1);
});
