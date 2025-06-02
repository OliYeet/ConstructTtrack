#!/usr/bin/env node

/**
 * ConstructTrack Notion Importer Setup Script
 *
 * This script helps you set up the Notion integration by creating
 * a template .env file and providing setup instructions.
 *
 * Usage: npm run notion:setup
 *
 * Author: ConstructTrack Development Team
 */

import { writeFileSync, existsSync } from 'fs';

import chalk from 'chalk';

function createEnvTemplate() {
  const envFile = '.env';

  if (existsSync(envFile)) {
    console.log(chalk.yellow(`📄 ${envFile} already exists`));
    return true;
  }

  const envTemplate = `# ConstructTrack Notion Integration Configuration
# Replace the values below with your actual Notion integration details

# Your Notion Integration Token (starts with 'secret_')
# Get this from: https://www.notion.so/my-integrations
NOTION_TOKEN=secret_your_integration_token_here

# Your Parent Page ID (where the database will be created)
# Get this from the Notion page URL after the last dash
NOTION_PARENT_PAGE_ID=your_page_id_here

# Optional: Customize the markdown file path if different
# MARKDOWN_FILE=docs/constructtrack_agile_project_plan.md
`;

  try {
    writeFileSync(envFile, envTemplate);
    console.log(chalk.green(`✅ Created template ${envFile} file`));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error creating ${envFile}: ${error.message}`));
    return false;
  }
}

function displaySetupInstructions() {
  console.log(chalk.blue.bold('\n🏗️  ConstructTrack Notion Importer Setup'));
  console.log(chalk.gray('='.repeat(50)));

  console.log(chalk.yellow('\n📋 Setup Steps:'));

  console.log(chalk.white('\n1. Create Notion Integration'));
  console.log(chalk.gray('   • Go to: https://www.notion.so/my-integrations'));
  console.log(chalk.gray('   • Click "New integration"'));
  console.log(chalk.gray('   • Name it: "ConstructTrack Importer"'));
  console.log(
    chalk.gray('   • Copy the Integration Token (starts with "secret_")')
  );

  console.log(chalk.white('\n2. Prepare Parent Page'));
  console.log(chalk.gray('   • Create a new page in Notion for the database'));
  console.log(chalk.gray('   • Share the page with your integration'));
  console.log(chalk.gray('   • Copy the page ID from the URL'));

  console.log(chalk.white('\n3. Configure Environment'));
  console.log(
    chalk.gray('   • Edit the .env file with your actual credentials')
  );
  console.log(
    chalk.gray('   • Replace NOTION_TOKEN with your integration token')
  );
  console.log(
    chalk.gray('   • Replace NOTION_PARENT_PAGE_ID with your page ID')
  );

  console.log(chalk.white('\n4. Run the Importer'));
  console.log(chalk.cyan('   npm run notion:import'));

  console.log(chalk.green("\n🎯 What You'll Get:"));
  console.log(chalk.gray('   • Complete Notion database with 8 epics'));
  console.log(chalk.gray('   • 16+ user stories with acceptance criteria'));
  console.log(chalk.gray('   • 120+ tasks with role assignments'));
  console.log(chalk.gray('   • All dependencies and relationships'));
  console.log(chalk.gray('   • Story point estimates for planning'));

  console.log(chalk.blue('\n🔗 Helpful Links:'));
  console.log(
    chalk.gray(
      '   • Notion Integrations: https://www.notion.so/my-integrations'
    )
  );
  console.log(
    chalk.gray('   • Notion API Docs: https://developers.notion.com/')
  );
}

function checkPrerequisites() {
  console.log(chalk.blue('🔍 Checking prerequisites...'));

  // Check if markdown file exists
  const markdownFile = 'docs/constructtrack_agile_project_plan.md';
  if (!existsSync(markdownFile)) {
    console.log(chalk.red(`❌ ${markdownFile} not found`));
    console.log(
      chalk.yellow('   Please ensure the agile project plan file exists')
    );
    return false;
  } else {
    console.log(chalk.green(`✅ Found ${markdownFile}`));
  }

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 16) {
    console.log(
      chalk.red(`❌ Node.js ${nodeVersion} detected. Node.js 16+ required.`)
    );
    console.log(chalk.yellow('   Please upgrade Node.js and try again.'));
    return false;
  } else {
    console.log(chalk.green(`✅ Node.js ${nodeVersion} - compatible`));
  }

  return true;
}

async function main() {
  console.log(chalk.blue.bold('🚀 ConstructTrack Notion Importer Setup'));
  console.log(chalk.gray('='.repeat(45)));

  // Check prerequisites
  if (!checkPrerequisites()) {
    process.exit(1);
  }

  // Create .env template
  console.log(chalk.blue('\n📝 Creating configuration template...'));
  createEnvTemplate();

  // Display setup instructions
  displaySetupInstructions();

  console.log(chalk.green.bold('\n✅ Setup completed!'));
  console.log(
    chalk.yellow('📝 Next: Edit the .env file with your Notion credentials')
  );
  console.log(chalk.cyan('🚀 Then run: npm run notion:import'));
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
