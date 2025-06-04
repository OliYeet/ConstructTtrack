#!/usr/bin/env node

/**
 * OpenAPI Diff Script
 *
 * This script compares two versions of the OpenAPI specification to detect
 * breaking changes and generate a diff report.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  currentSpecPath: path.resolve(__dirname, '../docs/api/openapi.yaml'),
  previousSpecPath:
    process.argv[2] ||
    path.resolve(__dirname, '../docs/api/openapi.yaml.backup'),
  outputDir: path.resolve(__dirname, '../docs/api/validation'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  format: process.argv.includes('--json') ? 'json' : 'markdown',
};

/**
 * Main diff function
 */
async function generateOpenApiDiff() {
  console.log(chalk.blue.bold('🔄 OpenAPI Specification Diff'));
  console.log(chalk.gray('='.repeat(40)));

  try {
    // Check if files exist
    if (!fs.existsSync(CONFIG.currentSpecPath)) {
      throw new Error(`Current spec file not found: ${CONFIG.currentSpecPath}`);
    }

    if (!fs.existsSync(CONFIG.previousSpecPath)) {
      console.log(
        chalk.yellow(
          '⚠️  Previous spec file not found. Creating backup of current spec...'
        )
      );
      await createBackup();
      console.log(
        chalk.green('✅ Backup created. Run diff again after making changes.')
      );
      return;
    }

    // Generate diff
    const diffResult = await generateDiff();

    // Save diff report
    await saveDiffReport(diffResult);

    // Display results
    displayDiffResults(diffResult);
  } catch (error) {
    console.error(chalk.red.bold('❌ Diff generation failed:'), error.message);
    if (CONFIG.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Create backup of current spec
 */
async function createBackup() {
  const backupPath = CONFIG.currentSpecPath + '.backup';
  fs.copyFileSync(CONFIG.currentSpecPath, backupPath);
  console.log(chalk.green(`📋 Backup created: ${backupPath}`));
}

/**
 * Generate diff using openapi-diff
 */
async function generateDiff() {
  console.log(chalk.yellow('🔍 Generating OpenAPI diff...'));

  try {
    // Use openapi-diff to compare specifications
    const command = `npx openapi-diff ${CONFIG.previousSpecPath} ${CONFIG.currentSpecPath} --format json`;

    if (CONFIG.verbose) {
      console.log(chalk.gray(`Running: ${command}`));
    }

    const output = execSync(command, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..'),
    });

    const diffResult = JSON.parse(output);

    console.log(chalk.green('✅ Diff generated successfully'));

    return diffResult;
  } catch (error) {
    // openapi-diff might exit with non-zero code even for successful diffs
    if (error.stdout) {
      try {
        const diffResult = JSON.parse(error.stdout);
        console.log(chalk.green('✅ Diff generated successfully'));
        return diffResult;
      } catch (parseError) {
        throw new Error(`Failed to parse diff output: ${parseError.message}`);
      }
    }

    throw new Error(`Failed to generate diff: ${error.message}`);
  }
}

/**
 * Save diff report to file
 */
async function saveDiffReport(diffResult) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (CONFIG.format === 'json') {
      // Save JSON report
      const jsonReportPath = path.join(
        CONFIG.outputDir,
        `openapi-diff-${timestamp}.json`
      );
      fs.writeFileSync(jsonReportPath, JSON.stringify(diffResult, null, 2));
      console.log(chalk.green(`📊 JSON diff report saved: ${jsonReportPath}`));
    } else {
      // Save Markdown report
      const markdownReport = generateMarkdownReport(diffResult);
      const mdReportPath = path.join(
        CONFIG.outputDir,
        `openapi-diff-${timestamp}.md`
      );
      fs.writeFileSync(mdReportPath, markdownReport);
      console.log(
        chalk.green(`📊 Markdown diff report saved: ${mdReportPath}`)
      );
    }
  } catch (error) {
    console.warn(
      chalk.yellow(`⚠️  Failed to save diff report: ${error.message}`)
    );
  }
}

/**
 * Generate Markdown report from diff result
 */
function generateMarkdownReport(diffResult) {
  const timestamp = new Date().toISOString();

  let markdown = `# OpenAPI Specification Diff Report\n\n`;
  markdown += `**Generated:** ${timestamp}\n\n`;
  markdown += `**Previous Spec:** ${CONFIG.previousSpecPath}\n`;
  markdown += `**Current Spec:** ${CONFIG.currentSpecPath}\n\n`;

  // Summary
  markdown += `## Summary\n\n`;

  const breakingChanges = diffResult.breakingChanges || [];
  const nonBreakingChanges = diffResult.nonBreakingChanges || [];
  const unclassifiedChanges = diffResult.unclassifiedChanges || [];

  markdown += `- 🔴 **Breaking Changes:** ${breakingChanges.length}\n`;
  markdown += `- 🟡 **Non-Breaking Changes:** ${nonBreakingChanges.length}\n`;
  markdown += `- ⚪ **Unclassified Changes:** ${unclassifiedChanges.length}\n\n`;

  // Breaking Changes
  if (breakingChanges.length > 0) {
    markdown += `## 🔴 Breaking Changes\n\n`;
    markdown += `> ⚠️ These changes may break existing API clients and require version bumping.\n\n`;

    breakingChanges.forEach((change, index) => {
      markdown += `### ${index + 1}. ${change.type || 'Change'}\n\n`;
      markdown += `**Location:** \`${change.location || 'Unknown'}\`\n\n`;
      markdown += `**Description:** ${change.description || change.message || 'No description'}\n\n`;

      if (change.before && change.after) {
        markdown += `**Before:**\n\`\`\`yaml\n${JSON.stringify(change.before, null, 2)}\n\`\`\`\n\n`;
        markdown += `**After:**\n\`\`\`yaml\n${JSON.stringify(change.after, null, 2)}\n\`\`\`\n\n`;
      }

      markdown += `---\n\n`;
    });
  }

  // Non-Breaking Changes
  if (nonBreakingChanges.length > 0) {
    markdown += `## 🟡 Non-Breaking Changes\n\n`;
    markdown += `> ✅ These changes are backward compatible.\n\n`;

    nonBreakingChanges.forEach((change, index) => {
      markdown += `### ${index + 1}. ${change.type || 'Change'}\n\n`;
      markdown += `**Location:** \`${change.location || 'Unknown'}\`\n\n`;
      markdown += `**Description:** ${change.description || change.message || 'No description'}\n\n`;

      if (change.action) {
        markdown += `**Action:** ${change.action}\n\n`;
      }

      markdown += `---\n\n`;
    });
  }

  // Unclassified Changes
  if (unclassifiedChanges.length > 0) {
    markdown += `## ⚪ Unclassified Changes\n\n`;
    markdown += `> 🔍 These changes need manual review to determine impact.\n\n`;

    unclassifiedChanges.forEach((change, index) => {
      markdown += `### ${index + 1}. ${change.type || 'Change'}\n\n`;
      markdown += `**Location:** \`${change.location || 'Unknown'}\`\n\n`;
      markdown += `**Description:** ${change.description || change.message || 'No description'}\n\n`;
      markdown += `---\n\n`;
    });
  }

  // Recommendations
  markdown += `## 📋 Recommendations\n\n`;

  if (breakingChanges.length > 0) {
    markdown += `- 🔴 **Breaking changes detected!** Consider:\n`;
    markdown += `  - Incrementing major version (v1.0.0 → v2.0.0)\n`;
    markdown += `  - Providing migration guide for API consumers\n`;
    markdown += `  - Maintaining backward compatibility in a separate endpoint\n\n`;
  } else if (nonBreakingChanges.length > 0) {
    markdown += `- 🟡 **Non-breaking changes detected.** Consider:\n`;
    markdown += `  - Incrementing minor version (v1.0.0 → v1.1.0)\n`;
    markdown += `  - Updating API documentation\n`;
    markdown += `  - Notifying API consumers of new features\n\n`;
  } else {
    markdown += `- ✅ **No significant changes detected.**\n`;
    markdown += `  - Consider incrementing patch version if bug fixes were made\n\n`;
  }

  markdown += `## 🔗 Links\n\n`;
  markdown += `- [OpenAPI Specification](${CONFIG.currentSpecPath})\n`;
  markdown += `- [API Documentation](/docs)\n`;
  markdown += `- [Change Management Guidelines](/docs/api-change-management.md)\n\n`;

  return markdown;
}

/**
 * Display diff results in console
 */
function displayDiffResults(diffResult) {
  console.log(chalk.blue.bold('\n🔄 Diff Results'));
  console.log(chalk.gray('='.repeat(30)));

  const breakingChanges = diffResult.breakingChanges || [];
  const nonBreakingChanges = diffResult.nonBreakingChanges || [];
  const unclassifiedChanges = diffResult.unclassifiedChanges || [];

  console.log(`${chalk.red('🔴')} Breaking Changes: ${breakingChanges.length}`);
  console.log(
    `${chalk.yellow('🟡')} Non-Breaking Changes: ${nonBreakingChanges.length}`
  );
  console.log(
    `${chalk.gray('⚪')} Unclassified Changes: ${unclassifiedChanges.length}`
  );

  if (breakingChanges.length > 0) {
    console.log(chalk.red.bold('\n⚠️  BREAKING CHANGES DETECTED!'));
    console.log(
      chalk.red('This may require a major version bump and migration guide.')
    );

    if (CONFIG.verbose) {
      console.log(chalk.red.bold('\nBreaking Changes:'));
      breakingChanges.forEach((change, index) => {
        console.log(
          chalk.red(
            `  ${index + 1}. ${change.type || 'Change'} at ${change.location || 'unknown location'}`
          )
        );
        console.log(
          chalk.red(
            `     ${change.description || change.message || 'No description'}`
          )
        );
      });
    }
  } else if (nonBreakingChanges.length > 0) {
    console.log(chalk.yellow.bold('\n✅ Non-breaking changes detected'));
    console.log(chalk.yellow('Consider incrementing minor version.'));
  } else {
    console.log(chalk.green.bold('\n✅ No significant changes detected'));
  }

  // Version recommendation
  console.log(chalk.blue.bold('\n📋 Version Recommendation:'));
  if (breakingChanges.length > 0) {
    console.log(chalk.red('  Major version bump (e.g., v1.0.0 → v2.0.0)'));
  } else if (nonBreakingChanges.length > 0) {
    console.log(chalk.yellow('  Minor version bump (e.g., v1.0.0 → v1.1.0)'));
  } else {
    console.log(
      chalk.green('  Patch version bump (e.g., v1.0.0 → v1.0.1) if needed')
    );
  }
}

// Run diff if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateOpenApiDiff().catch(error => {
    console.error(chalk.red.bold('💥 Diff generation failed:'), error.message);
    process.exit(1);
  });
}
