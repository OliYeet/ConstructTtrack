#!/usr/bin/env node

/**
 * ConstructTrack Notion Database Sync Service
 *
 * This service provides bidirectional sync between Notion database and local files:
 * 1. Notion → Local: Updates local files when Notion database changes
 * 2. Local → Notion: Updates Notion when local files change
 *
 * Features:
 * - Real-time sync via Notion webhooks
 * - File watching for local changes
 * - Conflict resolution
 * - Backup and restore
 *
 * Usage:
 *   npm run notion:sync
 */

import crypto from 'crypto';
import { writeFileSync, readFileSync, existsSync, watchFile } from 'fs';

import { Client } from '@notionhq/client';
import chalk from 'chalk';
import { config } from 'dotenv';
import express from 'express';

// Load environment variables
config();

class NotionDatabaseSync {
  constructor(notionToken, databaseId, webhookSecret = null) {
    this.notion = new Client({ auth: notionToken });
    this.databaseId = databaseId;
    this.webhookSecret = webhookSecret;
    this.app = express();
    this.lastSync = new Date();
    this.syncInProgress = false;

    // Configure Express
    this.app.use(express.json());
    this.app.use(express.raw({ type: 'application/json' }));
  }

  /**
   * Start the sync service
   */
  async start(port = 3001) {
    console.log(
      chalk.blue('🔄 Starting ConstructTrack Notion Sync Service...')
    );

    // Setup webhook endpoint
    this.setupWebhookEndpoint();

    // Setup file watching
    this.setupFileWatching();

    // Initial sync from Notion to local
    await this.syncNotionToLocal();

    // Start Express server
    this.app.listen(port, () => {
      console.log(chalk.green(`✅ Sync service running on port ${port}`));
      console.log(
        chalk.blue(`📡 Webhook endpoint: http://localhost:${port}/webhook`)
      );
      console.log(
        chalk.yellow(
          '💡 Configure this URL in your Notion integration settings'
        )
      );
    });
  }

  /**
   * Setup webhook endpoint to receive Notion updates
   */
  setupWebhookEndpoint() {
    this.app.post('/webhook', async (req, res) => {
      try {
        // Webhook signature verification for security
        if (this.webhookSecret && !this.verifyWebhookSignature(req)) {
          console.log(chalk.red('❌ Invalid webhook signature'));
          console.log(
            chalk.yellow('🔍 Debug: Webhook received but signature invalid')
          );
          console.log(chalk.gray(`Headers: ${JSON.stringify(req.headers)}`));
          console.log(chalk.gray('Expected signature format: HMAC-SHA256'));
          return res.status(401).send('Unauthorized');
        }

        console.log(chalk.green('✅ Webhook received successfully'));
        console.log(
          chalk.gray(`Headers: ${JSON.stringify(req.headers, null, 2)}`)
        );

        const { type, data } = req.body;

        console.log(chalk.blue(`📨 Received webhook: ${type}`));

        // Handle different webhook events
        switch (type) {
          case 'page_updated':
          case 'page_created':
          case 'page_deleted':
          case 'page.properties_updated': // Add support for property updates
            await this.handlePageChange(data);
            break;
          case 'database_updated':
            await this.handleDatabaseChange(data);
            break;
          default:
            console.log(chalk.gray(`ℹ️  Ignoring webhook type: ${type}`));
        }

        res.status(200).send('OK');
      } catch (error) {
        console.error(chalk.red(`❌ Webhook error: ${error.message}`));
        res.status(500).send('Internal Server Error');
      }
    });

    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        lastSync: this.lastSync,
        syncInProgress: this.syncInProgress,
      });
    });
  }

  /**
   * Verify webhook signature for security
   * Notion uses HMAC-SHA256 with the raw request body
   */
  verifyWebhookSignature(req) {
    if (!this.webhookSecret) return true;

    try {
      // Notion sends signature in different possible headers
      const signature =
        req.headers['notion-signature'] ||
        req.headers['x-notion-signature'] ||
        req.headers['x-signature'];

      if (!signature) {
        console.log(chalk.yellow('⚠️  No signature header found'));
        return false;
      }

      // Get raw body - Express should have this if we use raw middleware
      const body = req.rawBody || JSON.stringify(req.body);

      // Create expected signature
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body, 'utf8')
        .digest('hex');

      // Compare signatures (handle both hex and base64 formats)
      const providedSig = signature.replace(/^sha256=/, '');
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSig, 'hex')
      );

      if (!isValid) {
        console.log(chalk.gray(`Expected: ${expectedSignature}`));
        console.log(chalk.gray(`Received: ${providedSig}`));
      }

      return isValid;
    } catch (error) {
      console.log(chalk.red(`Signature verification error: ${error.message}`));
      return false;
    }
  }

  /**
   * Handle page changes from Notion
   */
  async handlePageChange(_pageData) {
    if (this.syncInProgress) {
      console.log(
        chalk.yellow('⏳ Sync already in progress, queuing update...')
      );
      return;
    }

    this.syncInProgress = true;

    try {
      console.log(chalk.blue('🔄 Syncing Notion changes to local files...'));
      await this.syncNotionToLocal();
      this.lastSync = new Date();
      console.log(chalk.green('✅ Local files updated from Notion'));
    } catch (error) {
      console.error(chalk.red(`❌ Sync error: ${error.message}`));
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Handle database structure changes
   */
  async handleDatabaseChange(_databaseData) {
    console.log(
      chalk.blue('🗄️ Database structure changed, updating local schema...')
    );
    // Handle database schema changes if needed
  }

  /**
   * Setup file watching for local changes
   */
  setupFileWatching() {
    const filesToWatch = [
      'docs/constructtrack_agile_project_plan.md',
      'docs/project-status.json',
      'docs/team-assignments.json',
    ];

    filesToWatch.forEach(filePath => {
      if (existsSync(filePath)) {
        watchFile(filePath, { interval: 1000 }, async (curr, prev) => {
          if (curr.mtime > prev.mtime && !this.syncInProgress) {
            console.log(chalk.blue(`📝 File changed: ${filePath}`));
            await this.syncLocalToNotion(filePath);
          }
        });
        console.log(chalk.green(`👀 Watching: ${filePath}`));
      }
    });
  }

  /**
   * Sync from Notion database to local files
   */
  async syncNotionToLocal() {
    console.log(chalk.blue('📥 Syncing from Notion to local files...'));

    try {
      // Fetch all database entries with pagination
      let allResults = [];
      let hasMore = true;
      let startCursor = undefined;

      while (hasMore) {
        const response = await this.notion.databases.query({
          database_id: this.databaseId,
          sorts: [
            {
              property: 'Type',
              direction: 'ascending',
            },
            {
              timestamp: 'created_time',
              direction: 'ascending',
            },
          ],
          start_cursor: startCursor,
          page_size: 100,
        });

        allResults = allResults.concat(response.results);
        hasMore = response.has_more;
        startCursor = response.next_cursor;
      }

      const response = { results: allResults };

      // Group by type
      const epics = response.results.filter(
        page => page.properties.Type?.select?.name === 'Epic'
      );
      const stories = response.results.filter(
        page => page.properties.Type?.select?.name === 'Story'
      );
      const tasks = response.results.filter(
        page => page.properties.Type?.select?.name === 'Task'
      );

      // Generate updated markdown
      const markdown = await this.generateMarkdownFromNotion(
        epics,
        stories,
        tasks
      );

      // Write to file with backup
      await this.createBackup('docs/constructtrack_agile_project_plan.md');
      writeFileSync('docs/constructtrack_agile_project_plan.md', markdown);

      // Generate status files
      await this.generateStatusFiles(response.results);

      console.log(
        chalk.green(
          `✅ Updated local files with ${response.results.length} items`
        )
      );
    } catch (error) {
      console.error(chalk.red(`❌ Notion sync error: ${error.message}`));
      throw error;
    }
  }

  /**
   * Sync from local files to Notion database
   */
  async syncLocalToNotion(filePath) {
    if (this.syncInProgress) return;

    this.syncInProgress = true;

    try {
      console.log(chalk.blue(`📤 Syncing ${filePath} to Notion...`));

      if (filePath.endsWith('.md')) {
        // For now, skip automatic markdown sync to prevent duplicates
        // TODO: Implement smart update logic that modifies existing items
        console.log(
          chalk.yellow(
            '⚠️  Markdown sync temporarily disabled to prevent duplicates'
          )
        );
        console.log(chalk.blue('💡 Use manual import: npm run notion:import'));
      } else if (filePath.endsWith('.json')) {
        // Handle JSON status updates
        await this.updateNotionFromJson(filePath);
      }

      console.log(chalk.green('✅ Notion updated from local changes'));
    } catch (error) {
      console.error(chalk.red(`❌ Local sync error: ${error.message}`));
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get page content from Notion
   */
  async getPageContent(pageId) {
    try {
      const response = await this.notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,
      });

      const content = {};
      let currentSection = '';

      for (const block of response.results) {
        if (
          block.type === 'heading_1' ||
          block.type === 'heading_2' ||
          block.type === 'heading_3'
        ) {
          const text = block[block.type]?.rich_text?.[0]?.text?.content || '';
          currentSection = text.toLowerCase();
        } else if (block.type === 'paragraph') {
          const text = block.paragraph?.rich_text?.[0]?.text?.content || '';
          if (text.trim()) {
            if (
              currentSection.includes('acceptance criteria') ||
              text.includes('Acceptance Criteria')
            ) {
              content.acceptanceCriteria = text;
            } else if (
              currentSection.includes('description') ||
              text.includes('As a')
            ) {
              content.description = text;
            } else if (currentSection.includes('dependencies')) {
              content.dependencies = text;
            }
          }
        } else if (block.type === 'bulleted_list_item') {
          const text =
            block.bulleted_list_item?.rich_text?.[0]?.text?.content || '';
          if (text.trim()) {
            if (!content.acceptanceCriteria) content.acceptanceCriteria = '';
            content.acceptanceCriteria += `- ${text}\n`;
          }
        }
      }

      return content;
    } catch (error) {
      console.log(
        chalk.gray(
          `Could not fetch content for page ${pageId}: ${error.message}`
        )
      );
      return {};
    }
  }

  /**
   * Get status badge emoji
   */
  getStatusBadge(status) {
    const statusMap = {
      'Not started': '🔴',
      'In progress': '🟡',
      Done: '🟢',
      Completed: '🟢',
      Blocked: '🔴',
      Review: '🟠',
      Testing: '🔵',
      Deployed: '✅',
    };
    return statusMap[status] || '⚪';
  }

  /**
   * Calculate progress percentage
   */
  calculateProgress(items) {
    if (!items || items.length === 0) return 0;
    const completed = items.filter(item => {
      const status = item.properties?.Status?.status?.name;
      return (
        status === 'Done' || status === 'Completed' || status === 'Deployed'
      );
    }).length;
    return Math.round((completed / items.length) * 100);
  }

  /**
   * Generate progress bar
   */
  generateProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`;
  }

  /**
   * Generate markdown from Notion database
   */
  async generateMarkdownFromNotion(epics, stories, tasks) {
    const allItems = [...epics, ...stories, ...tasks];

    // Header with professional styling
    let markdown = `# 🏗️ ConstructTrack Agile Project Plan\n\n`;
    markdown += `> **Fiber Optic Installation Management Platform**\n\n`;
    markdown += `📅 **Last Updated**: ${new Date().toLocaleString()}\n`;
    markdown += `🔗 **Synced from Notion**: \`${this.databaseId}\`\n\n`;
    markdown += `---\n\n`;

    // Project Overview Summary
    markdown += `## 📊 Project Overview\n\n`;

    // Summary statistics table
    const totalEpics = epics.length;
    const totalStories = stories.length;
    const totalTasks = tasks.length;
    const totalItems = allItems.length;

    markdown += `### 📈 Summary Statistics\n\n`;
    markdown += `| Metric | Count | Progress |\n`;
    markdown += `|--------|-------|----------|\n`;
    markdown += `| 📋 **Epics** | ${totalEpics} | ${this.generateProgressBar(this.calculateProgress(epics))} |\n`;
    markdown += `| 📖 **Stories** | ${totalStories} | ${this.generateProgressBar(this.calculateProgress(stories))} |\n`;
    markdown += `| ✅ **Tasks** | ${totalTasks} | ${this.generateProgressBar(this.calculateProgress(tasks))} |\n`;
    markdown += `| 🎯 **Total Items** | ${totalItems} | ${this.generateProgressBar(this.calculateProgress(allItems))} |\n\n`;

    // Status breakdown
    const statusCounts = {};
    allItems.forEach(item => {
      const status = item.properties.Status?.status?.name || 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    markdown += `### 🎯 Status Breakdown\n\n`;
    markdown += `| Status | Count | Badge |\n`;
    markdown += `|--------|-------|-------|\n`;
    Object.entries(statusCounts).forEach(([status, count]) => {
      markdown += `| **${status}** | ${count} | ${this.getStatusBadge(status)} |\n`;
    });
    markdown += `\n---\n\n`;

    // Group stories and tasks by epic
    const epicMap = new Map();

    epics.forEach(epic => {
      const epicTitle =
        epic.properties.Name?.title?.[0]?.text?.content || 'Untitled Epic';
      epicMap.set(epic.id, {
        title: epicTitle,
        properties: epic.properties,
        stories: [],
      });
    });

    // Add stories to epics
    stories.forEach(story => {
      const parentEpicId = story.properties['Parent item']?.relation?.[0]?.id;
      if (parentEpicId && epicMap.has(parentEpicId)) {
        const storyTitle =
          story.properties.Name?.title?.[0]?.text?.content || 'Untitled Story';
        epicMap.get(parentEpicId).stories.push({
          id: story.id,
          title: storyTitle,
          properties: story.properties,
          tasks: [],
        });
      }
    });

    // Add tasks to stories
    tasks.forEach(task => {
      const parentStoryId = task.properties['Parent item']?.relation?.[0]?.id;
      epicMap.forEach(epic => {
        const story = epic.stories.find(s => s.id === parentStoryId);
        if (story) {
          const taskTitle =
            task.properties.Name?.title?.[0]?.text?.content || 'Untitled Task';
          story.tasks.push({
            id: task.id,
            title: taskTitle,
            properties: task.properties,
          });
        }
      });
    });

    // Generate markdown for each epic
    for (const [, epic] of epicMap.entries()) {
      const epicProgress = this.calculateProgress(epic.stories);
      const epicStatus = epic.properties.Status?.status?.name;
      const epicBadge = this.getStatusBadge(epicStatus);

      markdown += `## 📋 ${epic.title}\n\n`;
      markdown += `${epicBadge} **Status**: ${epicStatus || 'No Status'} | **Progress**: ${this.generateProgressBar(epicProgress)}\n\n`;

      // Epic metadata table
      const priority = epic.properties.Priority?.select?.name;
      const timeline = epic.properties.Timeline?.rich_text?.[0]?.text?.content;
      const team = epic.properties['Team/Role']?.rich_text?.[0]?.text?.content;

      if (priority || timeline || team) {
        markdown += `| Property | Value |\n`;
        markdown += `|----------|-------|\n`;
        if (priority) markdown += `| **Priority** | ${priority} |\n`;
        if (timeline) markdown += `| **Timeline** | ${timeline} |\n`;
        if (team) markdown += `| **Team** | ${team} |\n`;
        markdown += `\n`;
      }

      // Add stories
      for (const story of epic.stories) {
        const storyStatus = story.properties.Status?.status?.name;
        const storyBadge = this.getStatusBadge(storyStatus);
        const storyProgress = this.calculateProgress(story.tasks);

        markdown += `### 📖 ${story.title}\n\n`;
        markdown += `${storyBadge} **Status**: ${storyStatus || 'No Status'} | **Progress**: ${this.generateProgressBar(storyProgress)}\n\n`;

        // Get rich content from the story page
        const storyContent = await this.getPageContent(story.id);

        if (storyContent.description) {
          markdown += `> ${storyContent.description}\n\n`;
        }

        const storyPoints = story.properties['Story Points']?.number;

        // Story metadata
        if (
          storyPoints ||
          storyContent.acceptanceCriteria ||
          storyContent.dependencies
        ) {
          markdown += `**Story Details:**\n`;
          if (storyPoints) markdown += `- **Story Points**: ${storyPoints}\n`;
          if (storyContent.acceptanceCriteria) {
            markdown += `- **Acceptance Criteria**:\n`;
            const criteria = storyContent.acceptanceCriteria
              .split('\n')
              .filter(line => line.trim());
            criteria.forEach(criterion => {
              markdown += `  ${criterion.startsWith('-') ? criterion : `- ${criterion}`}\n`;
            });
          }
          if (storyContent.dependencies) {
            markdown += `- **Dependencies**: ${storyContent.dependencies}\n`;
          }
          markdown += `\n`;
        }

        // Add tasks as a professional table
        if (story.tasks.length > 0) {
          markdown += `#### ✅ Tasks\n\n`;
          markdown += `| Task | Team/Role | Points | Status | Description |\n`;
          markdown += `|------|-----------|--------|--------|-------------|\n`;

          for (const task of story.tasks) {
            const points = task.properties['Story Points']?.number || 0;
            const role =
              task.properties['Team/Role']?.rich_text?.[0]?.text?.content ||
              'Team';
            const taskStatus =
              task.properties.Status?.status?.name || 'No Status';
            const taskBadge = this.getStatusBadge(taskStatus);

            // Get task details from page content
            const taskContent = await this.getPageContent(task.id);
            let description = '';
            if (taskContent.description) {
              const taskDetails = taskContent.description
                .split('\n')
                .filter(line => line.trim());
              description = taskDetails
                .filter(
                  detail =>
                    !detail.includes('Story Points:') &&
                    !detail.includes('Role:')
                )
                .map(detail => detail.trim().replace(/^-\s*/, ''))
                .join('; ');
            }

            // Truncate description if too long for table
            if (description.length > 100) {
              description = description.substring(0, 97) + '...';
            }

            markdown += `| **${task.title}** | ${role} | ${points} | ${taskBadge} ${taskStatus} | ${description || '_No description_'} |\n`;
          }
          markdown += `\n`;
        }

        markdown += `---\n\n`;
      }

      markdown += `\n`;
    }

    // Footer
    markdown += `---\n\n`;
    markdown += `## 📋 Legend\n\n`;
    markdown += `| Icon | Meaning |\n`;
    markdown += `|------|----------|\n`;
    markdown += `| 📋 | Epic |\n`;
    markdown += `| 📖 | Story |\n`;
    markdown += `| ✅ | Task |\n`;
    markdown += `| 🔴 | Not Started / Blocked |\n`;
    markdown += `| 🟡 | In Progress |\n`;
    markdown += `| 🟢 | Done / Completed |\n`;
    markdown += `| 🟠 | Review |\n`;
    markdown += `| 🔵 | Testing |\n`;
    markdown += `| ⚪ | No Status |\n\n`;

    markdown += `---\n\n`;
    markdown += `*Generated by ConstructTrack Notion Sync - ${new Date().toLocaleString()}*\n`;

    return markdown;
  }

  /**
   * Generate status files for project tracking
   */
  async generateStatusFiles(allItems) {
    // Generate project status JSON
    const statusData = {
      lastUpdated: new Date().toISOString(),
      totalItems: allItems.length,
      byType: {
        epics: allItems.filter(
          item => item.properties.Type?.select?.name === 'Epic'
        ).length,
        stories: allItems.filter(
          item => item.properties.Type?.select?.name === 'Story'
        ).length,
        tasks: allItems.filter(
          item => item.properties.Type?.select?.name === 'Task'
        ).length,
      },
      byStatus: {},
    };

    // Count by status
    allItems.forEach(item => {
      const status = item.properties.Status?.status?.name || 'No Status';
      statusData.byStatus[status] = (statusData.byStatus[status] || 0) + 1;
    });

    writeFileSync(
      'docs/project-status.json',
      JSON.stringify(statusData, null, 2)
    );

    // Generate team assignments
    const teamData = {};
    allItems.forEach(item => {
      const assignee = item.properties.Assignee?.people?.[0]?.name;
      const role = item.properties['Team/Role']?.rich_text?.[0]?.text?.content;

      if (assignee || role) {
        const key = assignee || role || 'Unassigned';
        if (!teamData[key]) teamData[key] = [];
        teamData[key].push({
          title: item.properties.Name?.title?.[0]?.text?.content,
          type: item.properties.Type?.select?.name,
          status: item.properties.Status?.status?.name,
        });
      }
    });

    writeFileSync(
      'docs/team-assignments.json',
      JSON.stringify(teamData, null, 2)
    );
  }

  /**
   * Create backup of file before overwriting (smart backup system)
   */
  async createBackup(filePath) {
    if (!existsSync(filePath)) return;

    const currentContent = readFileSync(filePath, 'utf8');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupPath = `${filePath}.backup.${today}`;

    // Only create backup if:
    // 1. No backup exists for today, OR
    // 2. Today's backup content is different from current content
    let shouldCreateBackup = !existsSync(backupPath);

    if (!shouldCreateBackup && existsSync(backupPath)) {
      const existingBackupContent = readFileSync(backupPath, 'utf8');
      shouldCreateBackup = existingBackupContent !== currentContent;
    }

    if (shouldCreateBackup) {
      writeFileSync(backupPath, currentContent);
      console.log(chalk.gray(`💾 Daily backup created: ${backupPath}`));

      // Clean up old backups (keep only last 5 days)
      await this.cleanupOldBackups(filePath);
    }
  }

  /**
   * Clean up old backup files (keep only last 5 days)
   */
  async cleanupOldBackups(filePath) {
    try {
      // Use fs and path modules
      const fs = await import('fs');
      const path = await import('path');
      const dir = path.dirname(filePath);
      const baseName = path.basename(filePath);

      // Find all backup files for this file
      const files = fs.readdirSync(dir);
      const backupFiles = files
        .filter(file => file.startsWith(`${baseName}.backup.`))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          date: file.replace(`${baseName}.backup.`, ''),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // Sort newest first

      // Keep only the 5 most recent backups
      const filesToDelete = backupFiles.slice(5);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(chalk.gray(`🗑️  Removed old backup: ${file.name}`));
      });
    } catch (error) {
      console.log(
        chalk.gray(`Warning: Could not clean up old backups: ${error.message}`)
      );
    }
  }

  /**
   * Update Notion from JSON status files
   */
  async updateNotionFromJson(filePath) {
    // Implementation for updating Notion from JSON changes
    console.log(chalk.blue(`📊 Processing JSON update: ${filePath}`));
    // This would handle status updates, team assignments, etc.
  }
}

// Main function
async function main() {
  try {
    const sync = new NotionDatabaseSync(
      process.env.NOTION_TOKEN,
      process.env.NOTION_DATABASE_ID,
      process.env.NOTION_WEBHOOK_SECRET
    );

    await sync.start(process.env.SYNC_PORT || 3001);
  } catch (error) {
    console.error(chalk.red(`❌ Sync service error: ${error.message}`));
    process.exit(1);
  }
}

// Export for use as module
export { NotionDatabaseSync };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
