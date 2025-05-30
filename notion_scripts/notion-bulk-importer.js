#!/usr/bin/env node

import { Client } from '@notionhq/client';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import fs from 'fs/promises';

// Load environment variables
config();

/**
 * Simple Logger Class
 * Provides structured logging without external dependencies
 */
class SimpleLogger {
    constructor(enableFileLogging = true) {
        this.enableFileLogging = enableFileLogging;
        this.logFile = 'logs/import.log';
        this.errorFile = 'logs/import-error.log';
    }

    async ensureLogDirectory() {
        if (this.enableFileLogging) {
            try {
                await fs.mkdir('logs', { recursive: true });
            } catch (error) {
                // Directory might already exist, ignore error
            }
        }
    }

    formatMessage(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...data
        };
        return JSON.stringify(logEntry);
    }

    async writeToFile(filename, content) {
        if (this.enableFileLogging) {
            try {
                await fs.appendFile(filename, content + '\n');
            } catch (error) {
                // Silently fail file writing to avoid breaking the import
            }
        }
    }

    info(message, data = {}) {
        const formatted = this.formatMessage('INFO', message, data);
        console.log(chalk.blue(`[INFO] ${message}`), Object.keys(data).length > 0 ? data : '');
        this.writeToFile(this.logFile, formatted);
    }

    warn(message, data = {}) {
        const formatted = this.formatMessage('WARN', message, data);
        console.warn(chalk.yellow(`[WARN] ${message}`), Object.keys(data).length > 0 ? data : '');
        this.writeToFile(this.logFile, formatted);
    }

    error(message, data = {}) {
        const formatted = this.formatMessage('ERROR', message, data);
        console.error(chalk.red(`[ERROR] ${message}`), Object.keys(data).length > 0 ? data : '');
        this.writeToFile(this.errorFile, formatted);
        this.writeToFile(this.logFile, formatted);
    }

    debug(message, data = {}) {
        const formatted = this.formatMessage('DEBUG', message, data);
        // Only log debug in development or if DEBUG env var is set
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
            console.log(chalk.gray(`[DEBUG] ${message}`), Object.keys(data).length > 0 ? data : '');
        }
        this.writeToFile(this.logFile, formatted);
    }
}

/**
 * ConstructTrack Notion Bulk Importer
 *
 * Imports the complete enhanced project plan including:
 * - EPIC 0: Project Foundation & Development Setup
 * - EPIC 0.5: Cross-Cutting Infrastructure
 * - Enhanced Epics 1-8 with all missing foundational tasks
 * - Proper hierarchical relationships and granular task breakdown
 */
class NotionBulkImporter {
    constructor(token, databaseId) {
        this.notion = new Client({ auth: token });
        this.databaseId = databaseId;
        this.createdItems = new Map(); // Track created items to avoid duplicates
        this.importStats = {
            epics: 0,
            stories: 0,
            tasks: 0,
            errors: 0,
            startTime: Date.now()
        };

        // Setup simple structured logging
        this.logger = new SimpleLogger(true);

        // Rate limiting configuration
        this.rateLimitDelay = 100; // Base delay in ms
        this.maxRetries = 3;
        this.batchSize = 3; // Process items in batches

        // Track import results for rollback
        this.importResults = [];
    }

    /**
     * Rate limiting delay
     */
    async rateLimiter() {
        await this.delay(this.rateLimitDelay);
    }

    /**
     * Utility delay function
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate required properties
     */
    validateProperties(properties) {
        const required = ['Name', 'Type'];
        const missing = required.filter(prop => !properties[prop]);
        if (missing.length > 0) {
            throw new Error(`Missing required properties: ${missing.join(', ')}`);
        }

        // Validate property values
        if (typeof properties.Name !== 'string' || properties.Name.trim() === '') {
            throw new Error('Name must be a non-empty string');
        }

        const validTypes = ['Epic', 'Story', 'Task'];
        if (!validTypes.includes(properties.Type)) {
            throw new Error(`Type must be one of: ${validTypes.join(', ')}`);
        }
    }

    /**
     * Update progress tracking
     */
    updateProgress(current, total, type) {
        const percentage = Math.round((current / total) * 100);
        const elapsed = Date.now() - this.importStats.startTime;
        const rate = current / (elapsed / 1000);
        const eta = total > current ? Math.round((total - current) / rate) : 0;

        console.log(chalk.blue(`Progress: ${current}/${total} ${type} (${percentage}%) | Rate: ${rate.toFixed(1)}/s | ETA: ${eta}s`));
        this.logger.info('Import progress', { current, total, type, percentage, rate, eta });
    }

    /**
     * Cleanup resources and memory
     */
    cleanup() {
        this.logger.info('Cleaning up resources');
        this.createdItems.clear();
        this.importResults = [];
    }

    /**
     * Rollback changes in case of failure
     */
    async rollback() {
        if (this.createdItems.size === 0) {
            this.logger.info('No items to rollback');
            return;
        }

        console.log(chalk.yellow(`🔄 Rolling back ${this.createdItems.size} created items...`));
        this.logger.warn('Starting rollback process', { itemCount: this.createdItems.size });

        let rolledBack = 0;
        let rollbackErrors = 0;

        for (const [itemKey, pageId] of this.createdItems) {
            try {
                await this.rateLimiter();
                await this.notion.pages.update({
                    page_id: pageId,
                    archived: true
                });
                rolledBack++;
                this.logger.info('Rolled back item', { itemKey, pageId });
            } catch (error) {
                rollbackErrors++;
                this.logger.error('Failed to rollback item', { itemKey, pageId, error: error.message });
            }
        }

        console.log(chalk.yellow(`Rollback complete: ${rolledBack} items archived, ${rollbackErrors} errors`));
        this.logger.info('Rollback completed', { rolledBack, rollbackErrors });
    }

    /**
     * Main import function
     */
    async importCompleteProject() {
        console.log(chalk.blue('🚀 Starting ConstructTrack Complete Project Import'));
        console.log(chalk.gray(`Database ID: ${this.databaseId}`));
        this.logger.info('Starting complete project import', { databaseId: this.databaseId });

        try {
            // Ensure logs directory exists
            await this.ensureLogsDirectory();

            // Validate environment
            await this.validateEnvironment();

            // Clear existing items if requested
            await this.clearExistingItems();

            // Import all epics, stories, and tasks with error recovery
            const results = await this.importProjectStructure();

            // Display final statistics
            this.displayImportStats();
            this.displayImportResults(results);

            this.logger.info('Import completed successfully', {
                stats: this.importStats,
                results: results.filter(r => r.status === 'failed').length
            });

        } catch (error) {
            this.logger.error('Import failed', { error: error.message, stack: error.stack });
            console.error(chalk.red(`❌ Import failed: ${error.message}`));

            // Attempt rollback on critical failure
            if (this.createdItems.size > 0) {
                console.log(chalk.yellow('Attempting rollback...'));
                await this.rollback();
            }

            throw error;
        } finally {
            // Always cleanup resources
            this.cleanup();
        }
    }

    /**
     * Ensure logs directory exists
     */
    async ensureLogsDirectory() {
        await this.logger.ensureLogDirectory();
    }

    /**
     * Validate environment and configuration
     */
    async validateEnvironment() {
        if (!process.env.NOTION_TOKEN) {
            throw new Error('NOTION_TOKEN environment variable is required');
        }

        if (!process.env.NOTION_DATABASE_ID) {
            throw new Error('NOTION_DATABASE_ID environment variable is required');
        }

        // Test Notion API connection
        try {
            await this.notion.databases.retrieve({ database_id: this.databaseId });
            this.logger.info('Notion API connection validated');
        } catch (error) {
            throw new Error(`Failed to connect to Notion database: ${error.message}`);
        }
    }

    /**
     * Display import results summary
     */
    displayImportResults(results) {
        const successful = results.filter(r => r.status === 'success').length;
        const failed = results.filter(r => r.status === 'failed').length;

        console.log(chalk.green('\n📊 Import Results Summary:'));
        console.log(chalk.white(`  ✅ Successful Epics: ${successful}`));
        console.log(chalk.white(`  ❌ Failed Epics: ${failed}`));

        if (failed > 0) {
            console.log(chalk.red('\n❌ Failed Epics:'));
            results.filter(r => r.status === 'failed').forEach(result => {
                console.log(chalk.red(`  - ${result.epic}: ${result.error}`));
            });
        }
    }

    /**
     * Clear existing items to prevent duplicates
     */
    async clearExistingItems() {
        const spinner = ora('Checking for existing items...').start();
        this.logger.info('Starting to clear existing items');

        try {
            const response = await this.notion.databases.query({
                database_id: this.databaseId,
                page_size: 100
            });

            if (response.results.length > 0) {
                spinner.text = `Found ${response.results.length} existing items. Clearing...`;
                this.logger.info('Found existing items to clear', { count: response.results.length });

                let cleared = 0;
                let clearErrors = 0;

                for (const item of response.results) {
                    try {
                        await this.rateLimiter(); // Add rate limiting
                        await this.notion.pages.update({
                            page_id: item.id,
                            archived: true
                        });
                        cleared++;
                    } catch (error) {
                        clearErrors++;
                        this.logger.warn('Could not archive existing item', {
                            itemId: item.id,
                            error: error.message
                        });
                        console.log(chalk.yellow(`Warning: Could not archive item ${item.id}`));
                    }
                }

                this.logger.info('Existing items cleared', { cleared, clearErrors });
                spinner.succeed(`Existing items cleared: ${cleared} archived, ${clearErrors} errors`);
            } else {
                spinner.succeed('No existing items found');
                this.logger.info('No existing items found to clear');
            }

        } catch (error) {
            spinner.warn('Could not clear some existing items - continuing with import');
            this.logger.warn('Failed to clear existing items', { error: error.message });
            console.log(chalk.yellow(`Warning: ${error.message}`));
            // Continue with import instead of terminating
        }
    }

    /**
     * Import the complete project structure with error recovery
     */
    async importProjectStructure() {
        const projectData = this.getCompleteProjectData();
        const results = [];

        this.logger.info('Starting project structure import', {
            epicCount: projectData.epics.length
        });

        console.log(chalk.blue(`📋 Importing ${projectData.epics.length} epics...`));

        // Import epics with individual error handling
        for (let i = 0; i < projectData.epics.length; i++) {
            const epic = projectData.epics[i];
            this.updateProgress(i + 1, projectData.epics.length, 'epics');

            try {
                await this.importEpic(epic);
                results.push({ epic: epic.name, status: 'success' });
                this.logger.info('Epic imported successfully', { epicName: epic.name });

            } catch (error) {
                results.push({
                    epic: epic.name,
                    status: 'failed',
                    error: error.message
                });
                this.importStats.errors++;
                this.logger.error('Epic import failed', {
                    epicName: epic.name,
                    error: error.message,
                    stack: error.stack
                });
                console.error(chalk.red(`❌ Epic ${epic.name} failed: ${error.message}`));
                console.log(chalk.yellow('Continuing with next epic...'));
            }
        }

        return results;
    }

    /**
     * Import a single epic with all its stories and tasks
     */
    async importEpic(epicData) {
        const spinner = ora(`Importing ${epicData.name}...`).start();
        this.logger.info('Starting epic import', {
            epicName: epicData.name,
            storyCount: epicData.stories.length
        });

        try {
            // Create epic (no parent item needed)
            const epic = await this.createNotionPageWithRetry({
                Name: epicData.name,
                Type: 'Epic',
                Priority: epicData.priority,
                Timeline: epicData.timeline,
                'Team/Role': epicData.team,
                Status: 'Not started'
            });

            // Verify epic was created successfully
            if (!epic || !epic.id) {
                throw new Error(`Failed to create epic: ${epicData.name}`);
            }

            this.createdItems.set(epicData.id, epic.id);
            this.importStats.epics++;
            this.logger.info('Epic created successfully', {
                epicName: epicData.name,
                epicId: epic.id
            });

            spinner.text = `Importing ${epicData.stories.length} stories for ${epicData.name}...`;

            // Import stories in controlled batches to avoid overwhelming the API
            for (let i = 0; i < epicData.stories.length; i += this.batchSize) {
                const batch = epicData.stories.slice(i, i + this.batchSize);
                const batchPromises = batch.map(story => this.importStory(story, epic.id));

                try {
                    await Promise.all(batchPromises);
                } catch (error) {
                    // Log batch error but continue with individual story processing
                    this.logger.warn('Batch story import failed, falling back to sequential', {
                        epicName: epicData.name,
                        batchStart: i,
                        error: error.message
                    });

                    // Fallback to sequential processing for this batch
                    for (const story of batch) {
                        try {
                            await this.importStory(story, epic.id);
                        } catch (storyError) {
                            this.logger.error('Individual story import failed', {
                                storyName: story.name,
                                error: storyError.message
                            });
                        }
                    }
                }
            }

            const totalTasks = epicData.stories.reduce((sum, story) => sum + story.tasks.length, 0);
            spinner.succeed(`Imported ${epicData.name}: ${epicData.stories.length} stories, ${totalTasks} tasks`);
            this.logger.info('Epic import completed', {
                epicName: epicData.name,
                storiesCount: epicData.stories.length,
                tasksCount: totalTasks
            });

        } catch (error) {
            spinner.fail(`Failed to import ${epicData.name}`);
            this.logger.error('Epic import failed', {
                epicName: epicData.name,
                error: error.message,
                stack: error.stack
            });
            throw error; // Re-throw to be handled by importProjectStructure
        }
    }

    /**
     * Import a single story with all its tasks
     */
    async importStory(storyData, epicId) {
        try {
            // Verify parent epic exists
            if (!epicId) {
                throw new Error(`Parent epic ID is missing for story: ${storyData.name}`);
            }

            // Create story with proper parent relationship
            const story = await this.createNotionPageWithRetry({
                Name: storyData.name,
                Type: 'Story',
                'Story Points': storyData.storyPoints,
                'Parent item': epicId, // Pass the ID directly, conversion handled in createNotionPage
                Status: 'Not started'
            });

            // Verify story was created successfully
            if (!story || !story.id) {
                throw new Error(`Failed to create story: ${storyData.name}`);
            }

            this.createdItems.set(storyData.id, story.id);
            this.importStats.stories++;

            // Import tasks for this story
            for (const taskData of storyData.tasks) {
                await this.importTask(taskData, story.id);
            }

        } catch (error) {
            this.importStats.errors++;
            console.error(chalk.red(`Error importing story ${storyData.name}: ${error.message}`));
        }
    }

    /**
     * Import a single task
     */
    async importTask(taskData, storyId) {
        try {
            // Verify parent story exists
            if (!storyId) {
                throw new Error(`Parent story ID is missing for task: ${taskData.name}`);
            }

            // Create task with proper parent relationship
            const task = await this.createNotionPageWithRetry({
                Name: taskData.name,
                Type: 'Task',
                'Story Points': taskData.storyPoints,
                'Team/Role': taskData.team,
                'Parent item': storyId, // Pass the ID directly, conversion handled in createNotionPage
                Status: 'Not started'
            });

            // Store task ID for potential future reference
            const taskId = `${taskData.name}-${Date.now()}`;
            this.createdItems.set(taskId, task.id);
            this.importStats.tasks++;

        } catch (error) {
            this.importStats.errors++;
            console.error(chalk.red(`Error importing task ${taskData.name}: ${error.message}`));
        }
    }

    /**
     * Create a page in Notion database with retry logic
     */
    async createNotionPageWithRetry(properties, retries = this.maxRetries) {
        for (let i = 0; i < retries; i++) {
            try {
                await this.rateLimiter();
                return await this.createNotionPage(properties);
            } catch (error) {
                if (error.code === 'rate_limited' && i < retries - 1) {
                    const delay = Math.pow(2, i) * 1000; // Exponential backoff
                    this.logger.warn('Rate limited, retrying', {
                        attempt: i + 1,
                        delay,
                        error: error.message
                    });
                    await this.delay(delay);
                    continue;
                }

                if (i < retries - 1) {
                    this.logger.warn('Page creation failed, retrying', {
                        attempt: i + 1,
                        error: error.message
                    });
                    await this.delay(1000 * (i + 1)); // Linear backoff for other errors
                    continue;
                }

                throw error;
            }
        }
    }

    /**
     * Create a page in Notion database
     */
    async createNotionPage(properties) {
        // Validate properties before processing
        this.validateProperties(properties);

        const notionProperties = {};

        // Convert properties to Notion format
        for (const [key, value] of Object.entries(properties)) {
            if (key === 'Name') {
                notionProperties[key] = {
                    title: [{ text: { content: value } }]
                };
            } else if (key === 'Type') {
                notionProperties[key] = {
                    select: { name: value }
                };
            } else if (key === 'Story Points') {
                notionProperties[key] = {
                    number: value || 0
                };
            } else if (key === 'Status') {
                notionProperties[key] = {
                    status: { name: value }
                };
            } else if (key === 'Priority') {
                // Map our priority values to Notion select options
                const priorityMapping = {
                    'P0 (Critical)': 'P0',
                    'P1 (High)': 'P1',
                    'P2 (Medium)': 'P2',
                    'P3 (Low)': 'P3'
                };
                const mappedPriority = priorityMapping[value] || value;
                notionProperties[key] = {
                    select: { name: mappedPriority }
                };
            } else if (key === 'Parent item') {
                // Handle parent item relation properly
                if (value) {
                    notionProperties[key] = {
                        relation: [{ id: value }]
                    };
                }
            } else {
                notionProperties[key] = {
                    rich_text: [{ text: { content: value || '' } }]
                };
            }
        }

        try {
            const result = await this.notion.pages.create({
                parent: { database_id: this.databaseId },
                properties: notionProperties
            });

            this.logger.debug('Page created successfully', {
                pageId: result.id,
                name: properties.Name,
                type: properties.Type
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to create Notion page', {
                properties,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Display import statistics
     */
    displayImportStats() {
        const duration = Date.now() - this.importStats.startTime;
        const totalItems = this.importStats.epics + this.importStats.stories + this.importStats.tasks;
        const rate = totalItems / (duration / 1000);

        console.log(chalk.green('\n✅ Import Complete!'));
        console.log(chalk.blue('📊 Import Statistics:'));
        console.log(chalk.white(`  📋 Epics: ${this.importStats.epics}`));
        console.log(chalk.white(`  📖 Stories: ${this.importStats.stories}`));
        console.log(chalk.white(`  ✅ Tasks: ${this.importStats.tasks}`));
        console.log(chalk.white(`  🎯 Total Items: ${totalItems}`));
        console.log(chalk.white(`  ⏱️  Duration: ${Math.round(duration / 1000)}s`));
        console.log(chalk.white(`  ⚡ Rate: ${rate.toFixed(1)} items/second`));

        if (this.importStats.errors > 0) {
            console.log(chalk.red(`  ❌ Errors: ${this.importStats.errors}`));
        }

        this.logger.info('Import statistics', {
            epics: this.importStats.epics,
            stories: this.importStats.stories,
            tasks: this.importStats.tasks,
            totalItems,
            duration,
            rate,
            errors: this.importStats.errors
        });
    }

    /**
     * Get the complete enhanced project data structure
     */
    getCompleteProjectData() {
        return {
            epics: [
                // EPIC 0: Project Foundation & Development Setup
                {
                    id: 'epic-0',
                    name: '🚀 EPIC 0: Project Foundation & Development Setup',
                    priority: 'P0 (Critical)',
                    timeline: 'Week 0-1',
                    team: '2 Backend, 2 Frontend, 1 DevOps',
                    stories: [
                        {
                            id: 'story-0-1',
                            name: '🛠️ Story 0.1: Development Environment & Project Initialization',
                            storyPoints: 14,
                            tasks: [
                                { name: '🚀 Initialize Next.js project with TypeScript', team: 'Frontend', storyPoints: 2 },
                                { name: '📱 Create React Native project with Expo', team: 'Frontend', storyPoints: 3 },
                                { name: '🗄️ Setup Supabase project and database', team: 'Backend', storyPoints: 2 },
                                { name: '🔧 Configure development environment (ESLint, Prettier, Husky)', team: 'Frontend', storyPoints: 2 },
                                { name: '📦 Setup package management and dependency strategy', team: 'Backend', storyPoints: 1 },
                                { name: '🌿 Initialize Git repository with branching strategy', team: 'DevOps', storyPoints: 1 },
                                { name: '🔐 Setup environment variable management', team: 'DevOps', storyPoints: 2 },
                                { name: '📚 Create project documentation structure', team: 'Backend', storyPoints: 1 }
                            ]
                        },
                        {
                            id: 'story-0-2',
                            name: '🏗️ Story 0.2: Core Architecture & API Design',
                            storyPoints: 19,
                            tasks: [
                                { name: '🏗️ Design overall system architecture', team: 'Backend', storyPoints: 3 },
                                { name: '📋 Create API specification and documentation', team: 'Backend', storyPoints: 3 },
                                { name: '🗄️ Design database schema and relationships', team: 'Backend', storyPoints: 5 },
                                { name: '🔄 Setup database migrations system', team: 'Backend', storyPoints: 2 },
                                { name: '🔌 Implement base API structure with error handling', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Setup testing framework and initial tests', team: 'QA', storyPoints: 3 }
                            ]
                        }
                    ]
                },

                // EPIC 0.5: Cross-Cutting Infrastructure
                {
                    id: 'epic-0-5',
                    name: '⚙️ EPIC 0.5: Cross-Cutting Infrastructure',
                    priority: 'P0 (Critical)',
                    timeline: 'Week 1-2',
                    team: '1 Backend, 1 DevOps, 1 QA',
                    stories: [
                        {
                            id: 'story-0-5-1',
                            name: '📊 Story 0.5.1: Logging, Monitoring & Error Handling',
                            storyPoints: 12,
                            tasks: [
                                { name: '📊 Setup application logging infrastructure', team: 'DevOps', storyPoints: 3 },
                                { name: '🚨 Implement global error handling system', team: 'Backend', storyPoints: 3 },
                                { name: '📈 Setup performance monitoring (APM)', team: 'DevOps', storyPoints: 3 },
                                { name: '🔔 Configure alerting and notification system', team: 'DevOps', storyPoints: 2 },
                                { name: '📋 Create error tracking and reporting system', team: 'Backend', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-0-5-2',
                            name: '🛡️ Story 0.5.2: Security & Compliance Foundation',
                            storyPoints: 12,
                            tasks: [
                                { name: '🛡️ Implement security headers and CORS policies', team: 'Backend', storyPoints: 2 },
                                { name: '🔐 Setup API rate limiting and throttling', team: 'Backend', storyPoints: 2 },
                                { name: '📋 Create data privacy compliance framework', team: 'Backend', storyPoints: 3 },
                                { name: '🔍 Setup security scanning and vulnerability assessment', team: 'DevOps', storyPoints: 3 },
                                { name: '📚 Create security documentation and guidelines', team: 'Backend', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-0-5-3',
                            name: '🔄 Story 0.5.3: Development Workflow & Quality',
                            storyPoints: 14,
                            tasks: [
                                { name: '🔄 Setup CI/CD pipeline for development', team: 'DevOps', storyPoints: 5 },
                                { name: '📋 Create code review guidelines and process', team: 'Backend', storyPoints: 2 },
                                { name: '📚 Setup API documentation automation', team: 'Backend', storyPoints: 2 },
                                { name: '🧪 Implement automated testing pipeline', team: 'QA', storyPoints: 3 },
                                { name: '📊 Setup code coverage and quality metrics', team: 'QA', storyPoints: 2 }
                            ]
                        }
                    ]
                },

                // EPIC 0.75: Technical Infrastructure & Integrations
                {
                    id: 'epic-0-75',
                    name: '🔧 EPIC 0.75: Technical Infrastructure & Integrations',
                    priority: 'P0 (Critical)',
                    timeline: 'Week 2-4',
                    team: '3 Backend, 1 DevOps, 1 QA',
                    stories: [
                        {
                            id: 'story-0-75-1',
                            name: '📋 Story 0.75.1: API Design & Documentation Foundation',
                            storyPoints: 35,
                            tasks: [
                                { name: '📋 Design RESTful API specification', team: 'Backend', storyPoints: 5 },
                                { name: '🔄 Implement GraphQL schema design', team: 'Backend', storyPoints: 5 },
                                { name: '📚 Setup OpenAPI/Swagger documentation', team: 'Backend', storyPoints: 3 },
                                { name: '🔐 Implement API authentication middleware', team: 'Backend', storyPoints: 3 },
                                { name: '⚡ Setup API rate limiting and throttling', team: 'Backend', storyPoints: 2 },
                                { name: '📊 Implement API versioning strategy', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Setup API contract testing', team: 'QA', storyPoints: 3 },
                                { name: '📈 Implement API monitoring and metrics', team: 'Backend', storyPoints: 3 },
                                { name: '🔍 Setup API request/response logging', team: 'Backend', storyPoints: 2 },
                                { name: '🛡️ Implement API security headers', team: 'Backend', storyPoints: 2 },
                                { name: '📊 Setup API performance monitoring', team: 'Backend', storyPoints: 2 },
                                { name: '🔄 Implement API caching strategies', team: 'Backend', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-0-75-2',
                            name: '🗄️ Story 0.75.2: Database Architecture & Migration System',
                            storyPoints: 25,
                            tasks: [
                                { name: '🔄 Implement database migration system', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Create seed data and fixtures', team: 'Backend', storyPoints: 2 },
                                { name: '🔄 Setup database versioning strategy', team: 'Backend', storyPoints: 2 },
                                { name: '🛡️ Design Supabase Row Level Security policies', team: 'Backend', storyPoints: 5 },
                                { name: '🔐 Implement RLS for fiber network data', team: 'Backend', storyPoints: 3 },
                                { name: '👥 Setup organization-based data isolation', team: 'Backend', storyPoints: 3 },
                                { name: '📍 Implement PostGIS integration with Supabase', team: 'Backend', storyPoints: 5 },
                                { name: '🗺️ Setup geospatial indexing and queries', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Test RLS policy enforcement', team: 'QA', storyPoints: 2 },
                                { name: '📊 Setup database performance monitoring', team: 'Backend', storyPoints: 1 }
                            ]
                        },
                        {
                            id: 'story-0-75-3',
                            name: '⚡ Story 0.75.3: Real-time Data & WebSocket Infrastructure',
                            storyPoints: 30,
                            tasks: [
                                { name: '🔧 Setup WebSocket infrastructure', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Design real-time data protocols', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Implement event sourcing system', team: 'Backend', storyPoints: 5 },
                                { name: '📈 Setup real-time monitoring', team: 'DevOps', storyPoints: 3 },
                                { name: '⚡ Optimize real-time performance', team: 'Backend', storyPoints: 3 },
                                { name: '⚡ Configure Supabase real-time subscriptions', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Implement real-time conflict resolution', team: 'Backend', storyPoints: 5 },
                                { name: '📊 Setup real-time performance monitoring', team: 'Backend', storyPoints: 2 },
                                { name: '🔔 Implement real-time notification system', team: 'Backend', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-0-75-4',
                            name: '🔗 Story 0.75.4: Third-Party Service Integrations',
                            storyPoints: 30,
                            tasks: [
                                { name: '📧 Setup email service integration', team: 'Backend', storyPoints: 3 },
                                { name: '📱 Setup SMS notification service', team: 'Backend', storyPoints: 3 },
                                { name: '☁️ Setup cloud storage integration', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Setup analytics service integration', team: 'Backend', storyPoints: 3 },
                                { name: '🔐 Setup identity provider integration', team: 'Backend', storyPoints: 5 },
                                { name: '💳 Setup payment processing integration', team: 'Backend', storyPoints: 5 },
                                { name: '📋 Setup document generation service', team: 'Backend', storyPoints: 3 },
                                { name: '🌤️ Setup weather service integration', team: 'Backend', storyPoints: 2 },
                                { name: '🗺️ Setup geocoding service integration', team: 'Backend', storyPoints: 3 }
                            ]
                        }
                    ]
                },

                // EPIC 1: Core Authentication & Project Foundation (Enhanced)
                {
                    id: 'epic-1',
                    name: '🔐 EPIC 1: Core Authentication & Project Foundation',
                    priority: 'P0 (Critical)',
                    timeline: 'Weeks 1-3 (3 sprints)',
                    team: '2 Backend, 2 Frontend, 1 UI/UX, 1 QA',
                    stories: [
                        {
                            id: 'story-1-0',
                            name: '🎨 Story 1.0: Authentication Planning & Design',
                            storyPoints: 9,
                            tasks: [
                                { name: '🎨 Create authentication UI/UX wireframes', team: 'UI/UX', storyPoints: 3 },
                                { name: '🔐 Design role-based access control matrix', team: 'Backend', storyPoints: 2 },
                                { name: '📋 Define authentication API endpoints', team: 'Backend', storyPoints: 2 },
                                { name: '🛡️ Research legal compliance requirements', team: 'Backend', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-1-1',
                            name: '👤 Story 1.1: User Authentication System',
                            storyPoints: 22,
                            tasks: [
                                { name: '⚙️ Setup Supabase authentication', team: 'Backend', storyPoints: 3 },
                                { name: '🔧 Setup Supabase authentication policies', team: 'Backend', storyPoints: 2 },
                                { name: '🔧 Implement user registration API', team: 'Backend', storyPoints: 2 },
                                { name: '🎨 Create login/register UI components', team: 'Frontend', storyPoints: 5 },
                                { name: '🛡️ Implement role-based access control', team: 'Backend', storyPoints: 5 },
                                { name: '📱 Add authentication to React Native app', team: 'Frontend', storyPoints: 3 },
                                { name: '🧪 Write authentication tests', team: 'QA', storyPoints: 2 },
                                { name: '🧪 Create authentication integration tests', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-1-2',
                            name: '📋 Story 1.2: Basic Project Management',
                            storyPoints: 18,
                            tasks: [
                                { name: '🗄️ Design project database schema', team: 'Backend', storyPoints: 2 },
                                { name: '🔌 Create project CRUD APIs', team: 'Backend', storyPoints: 3 },
                                { name: '📝 Build project creation form', team: 'Frontend', storyPoints: 3 },
                                { name: '📊 Implement project dashboard', team: 'Frontend', storyPoints: 5 },
                                { name: '📱 Add project management to mobile', team: 'Frontend', storyPoints: 3 },
                                { name: '🧪 Create project management tests', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-1-3',
                            name: '🔐 Story 1.3: Advanced Security & Session Management',
                            storyPoints: 20,
                            tasks: [
                                { name: '🔐 Implement JWT token management', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Setup session refresh and rotation', team: 'Backend', storyPoints: 3 },
                                { name: '🛡️ Implement password security policies', team: 'Backend', storyPoints: 2 },
                                { name: '🔒 Add two-factor authentication', team: 'Backend', storyPoints: 5 },
                                { name: '📱 Implement biometric authentication for mobile', team: 'Frontend', storyPoints: 3 },
                                { name: '🔍 Add audit logging for authentication', team: 'Backend', storyPoints: 2 },
                                { name: '🧪 Security testing for authentication', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-1-4',
                            name: '👥 Story 1.4: User Management & Permissions',
                            storyPoints: 22,
                            tasks: [
                                { name: '👥 Design user hierarchy and organization structure', team: 'Backend', storyPoints: 3 },
                                { name: '🔐 Implement granular permission system', team: 'Backend', storyPoints: 5 },
                                { name: '👤 Create user profile management', team: 'Frontend', storyPoints: 3 },
                                { name: '🏢 Implement organization/company management', team: 'Backend', storyPoints: 3 },
                                { name: '📧 Add user invitation and onboarding', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Implement user deactivation and data retention', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 User management testing suite', team: 'QA', storyPoints: 2 }
                            ]
                        }
                    ]
                },

                // EPIC 2: MapBox Integration & Fiber Network Visualization (Enhanced)
                {
                    id: 'epic-2',
                    name: '🗺️ EPIC 2: MapBox Integration & Fiber Network Visualization',
                    priority: 'P0 (Critical)',
                    timeline: 'Weeks 4-8 (5 sprints)',
                    team: '3 Frontend, 1 Backend, 1 UI/UX, 1 QA',
                    stories: [
                        {
                            id: 'story-2-0',
                            name: '🏗️ Story 2.0: Mapping Architecture & Planning',
                            storyPoints: 14,
                            tasks: [
                                { name: '🗺️ Setup MapBox account and API key management', team: 'DevOps', storyPoints: 1 },
                                { name: '🏗️ Design geospatial data architecture', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Research fiber network data standards', team: 'Backend', storyPoints: 2 },
                                { name: '🎨 Create map interface wireframes', team: 'UI/UX', storyPoints: 3 },
                                { name: '⚡ Design offline-first architecture', team: 'Backend', storyPoints: 5 }
                            ]
                        },
                        {
                            id: 'story-2-1',
                            name: '🌐 Story 2.1: Interactive Fiber Network Map',
                            storyPoints: 32,
                            tasks: [
                                { name: '🗺️ Setup MapBox GL JS integration', team: 'Frontend', storyPoints: 5 },
                                { name: '🗄️ Create fiber route data model', team: 'Backend', storyPoints: 3 },
                                { name: '🎨 Design route rendering algorithms', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Create basic line/polygon rendering', team: 'Frontend', storyPoints: 3 },
                                { name: '🎨 Implement route styling and colors', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Add route interaction and selection', team: 'Frontend', storyPoints: 3 },
                                { name: '💾 Add offline map caching', team: 'Frontend', storyPoints: 5 },
                                { name: '🎛️ Create map controls', team: 'Frontend', storyPoints: 3 },
                                { name: '⚡ Implement real-time updates', team: 'Backend', storyPoints: 5 },
                                { name: '📱 Mobile map optimization', team: 'Frontend', storyPoints: 5 },
                                { name: '🧪 Map testing suite', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-2-2',
                            name: '🏗️ Story 2.2: Work Area Management',
                            storyPoints: 21,
                            tasks: [
                                { name: '🔧 Implement polygon drawing tools', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Create work area data model', team: 'Backend', storyPoints: 3 },
                                { name: '🔧 Build area assignment interface', team: 'Frontend', storyPoints: 3 },
                                { name: '🔧 Add geofencing for mobile', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Implement progress tracking', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Work area testing', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-2-3',
                            name: '🌐 Story 2.3: Advanced Mapping Features',
                            storyPoints: 28,
                            tasks: [
                                { name: '📍 Implement GPS coordinate management', team: 'Backend', storyPoints: 3 },
                                { name: '🗺️ Add satellite and terrain map layers', team: 'Frontend', storyPoints: 3 },
                                { name: '📏 Implement distance and area measurement tools', team: 'Frontend', storyPoints: 3 },
                                { name: '🔍 Add map search and geocoding', team: 'Frontend', storyPoints: 3 },
                                { name: '📌 Implement custom map markers and icons', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Create map styling and themes', team: 'Frontend', storyPoints: 2 },
                                { name: '📱 Optimize map performance for mobile', team: 'Frontend', storyPoints: 5 },
                                { name: '💾 Implement map data caching strategy', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Add map data synchronization', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Advanced mapping testing', team: 'QA', storyPoints: 1 }
                            ]
                        },
                        {
                            id: 'story-2-4',
                            name: '🏗️ Story 2.4: Fiber Infrastructure Data Management',
                            storyPoints: 25,
                            tasks: [
                                { name: '🗄️ Design fiber network database schema', team: 'Backend', storyPoints: 5 },
                                { name: '📊 Implement fiber asset management', team: 'Backend', storyPoints: 3 },
                                { name: '🔌 Create fiber connection tracking', team: 'Backend', storyPoints: 3 },
                                { name: '📋 Add equipment and material inventory', team: 'Backend', storyPoints: 3 },
                                { name: '🏠 Implement customer premise mapping', team: 'Backend', storyPoints: 3 },
                                { name: '📈 Add network capacity planning', team: 'Backend', storyPoints: 3 },
                                { name: '🔍 Implement fiber network search', team: 'Frontend', storyPoints: 2 },
                                { name: '📊 Create network analytics dashboard', team: 'Frontend', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-2-5',
                            name: '🏗️ Story 2.5: Advanced MapBox & Geospatial Features',
                            storyPoints: 35,
                            tasks: [
                                { name: '📏 Implement fiber route calculation algorithms', team: 'Backend', storyPoints: 8 },
                                { name: '🔄 Setup map tile caching strategy', team: 'Backend', storyPoints: 3 },
                                { name: '📱 Implement offline map tile management', team: 'Frontend', storyPoints: 5 },
                                { name: '⚡ Implement map clustering for large datasets', team: 'Frontend', storyPoints: 5 },
                                { name: '🎨 Setup dynamic map styling based on data', team: 'Frontend', storyPoints: 3 },
                                { name: '📊 Implement map performance monitoring', team: 'Frontend', storyPoints: 2 },
                                { name: '🗺️ Add 3D visualization for fiber routes', team: 'Frontend', storyPoints: 5 },
                                { name: '📍 Implement precision GPS coordinate validation', team: 'Backend', storyPoints: 2 },
                                { name: '🔄 Setup map data synchronization protocols', team: 'Backend', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-2-6',
                            name: '🏗️ Story 2.6: Fiber Industry Compliance & Regulatory',
                            storyPoints: 30,
                            tasks: [
                                { name: '📋 Implement FCC compliance reporting', team: 'Backend', storyPoints: 5 },
                                { name: '🏗️ Setup utility locating integration (811)', team: 'Backend', storyPoints: 8 },
                                { name: '📊 Implement environmental impact tracking', team: 'Backend', storyPoints: 3 },
                                { name: '🛡️ Setup OSHA safety compliance tracking', team: 'Backend', storyPoints: 3 },
                                { name: '📋 Implement permit management system', team: 'Backend', storyPoints: 5 },
                                { name: '🏗️ Add right-of-way management', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Implement regulatory reporting dashboard', team: 'Frontend', storyPoints: 3 }
                            ]
                        }
                    ]
                },

                // EPIC 3: Customer Documentation & Site Surveys (Enhanced)
                {
                    id: 'epic-3',
                    name: '📋 EPIC 3: Customer Documentation & Site Surveys',
                    priority: 'P0 (Critical)',
                    timeline: 'Weeks 6-10 (5 sprints)',
                    team: '2 Frontend, 2 Backend, 1 UI/UX, 1 QA',
                    stories: [
                        {
                            id: 'story-3-0',
                            name: '📋 Story 3.0: Forms Architecture & Legal Planning',
                            storyPoints: 11,
                            tasks: [
                                { name: '📋 Research fiber installation legal requirements', team: 'Backend', storyPoints: 3 },
                                { name: '🏗️ Design document storage architecture', team: 'Backend', storyPoints: 3 },
                                { name: '🔐 Plan digital signature legal compliance', team: 'Backend', storyPoints: 2 },
                                { name: '📱 Design mobile-first form UX', team: 'UI/UX', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-3-1',
                            name: '📝 Story 3.1: Digital Site Survey Forms',
                            storyPoints: 35,
                            tasks: [
                                { name: '🔧 Design site survey form schema', team: 'Backend', storyPoints: 3 },
                                { name: '🎨 Design form component architecture', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Implement basic form field types', team: 'Frontend', storyPoints: 3 },
                                { name: '🎨 Create form validation system', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Add conditional field logic', team: 'Frontend', storyPoints: 3 },
                                { name: '🎨 Implement form preview functionality', team: 'Frontend', storyPoints: 2 },
                                { name: '🔧 Implement signature capture', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Build photo integration', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Add offline form storage', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Create form submission API', team: 'Backend', storyPoints: 3 },
                                { name: '📱 Mobile form optimization', team: 'Frontend', storyPoints: 3 },
                                { name: '🎨 Form testing suite', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-3-2',
                            name: '📄 Story 3.2: Customer Agreement Management',
                            storyPoints: 21,
                            tasks: [
                                { name: '🔧 Create document management system', team: 'Backend', storyPoints: 5 },
                                { name: '🔧 Build agreement form interface', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Implement automatic form selection', team: 'Backend', storyPoints: 3 },
                                { name: '🔧 Add customer delivery system', team: 'Backend', storyPoints: 3 },
                                { name: '🛡️ Legal compliance features', team: 'Frontend', storyPoints: 3 },
                                { name: '🧪 Agreement testing', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-3-3',
                            name: '📋 Story 3.3: Advanced Form Features & Workflows',
                            storyPoints: 30,
                            tasks: [
                                { name: '🔄 Implement form versioning and history', team: 'Backend', storyPoints: 3 },
                                { name: '📝 Add form templates and customization', team: 'Frontend', storyPoints: 5 },
                                { name: '🔗 Implement form linking and dependencies', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Add form analytics and completion tracking', team: 'Backend', storyPoints: 3 },
                                { name: '🔔 Implement form notifications and reminders', team: 'Backend', storyPoints: 3 },
                                { name: '📱 Add offline form synchronization', team: 'Frontend', storyPoints: 5 },
                                { name: '🎨 Create form builder interface', team: 'Frontend', storyPoints: 5 },
                                { name: '🧪 Advanced form testing', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-3-4',
                            name: '📸 Story 3.4: Site Documentation & Media Management',
                            storyPoints: 25,
                            tasks: [
                                { name: '📸 Implement site photo documentation', team: 'Frontend', storyPoints: 3 },
                                { name: '🎥 Add video recording capabilities', team: 'Frontend', storyPoints: 3 },
                                { name: '📋 Create site inspection checklists', team: 'Frontend', storyPoints: 3 },
                                { name: '🗺️ Implement site mapping and measurements', team: 'Frontend', storyPoints: 5 },
                                { name: '📊 Add site condition assessment tools', team: 'Frontend', storyPoints: 3 },
                                { name: '🔄 Implement media synchronization', team: 'Backend', storyPoints: 3 },
                                { name: '📋 Create site report generation', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Site documentation testing', team: 'QA', storyPoints: 2 }
                            ]
                        }
                    ]
                },

                // EPIC 4: Mobile App & Photo Documentation (Enhanced)
                {
                    id: 'epic-4',
                    name: '📱 EPIC 4: Mobile App & Photo Documentation',
                    priority: 'P0 (Critical)',
                    timeline: 'Weeks 8-12 (5 sprints)',
                    team: '3 Frontend, 1 Backend, 1 QA',
                    stories: [
                        {
                            id: 'story-4-0',
                            name: '📱 Story 4.0: Mobile Architecture & Setup',
                            storyPoints: 15,
                            tasks: [
                                { name: '📱 Setup React Native development environment', team: 'Frontend', storyPoints: 2 },
                                { name: '🔧 Configure mobile build pipeline', team: 'DevOps', storyPoints: 3 },
                                { name: '📸 Design photo storage and sync architecture', team: 'Backend', storyPoints: 5 },
                                { name: '🗺️ Plan GPS and location services integration', team: 'Frontend', storyPoints: 2 },
                                { name: '🔋 Design battery and performance optimization strategy', team: 'Frontend', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-4-1',
                            name: '📸 Story 4.1: Photo-to-Location Mapping',
                            storyPoints: 34,
                            tasks: [
                                { name: '🔧 Implement GPS photo tagging', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Create photo categorization system', team: 'Backend', storyPoints: 3 },
                                { name: '🔧 Build photo map markers', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Implement photo comparison', team: 'Frontend', storyPoints: 5 },
                                { name: '🎨 Design offline storage architecture', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Implement local photo caching', team: 'Frontend', storyPoints: 3 },
                                { name: '🎨 Create sync queue management', team: 'Frontend', storyPoints: 3 },
                                { name: '🎨 Add conflict resolution for photos', team: 'Frontend', storyPoints: 2 },
                                { name: '🔧 Create photo sync system', team: 'Backend', storyPoints: 5 },
                                { name: '📸 Photo organization interface', team: 'Frontend', storyPoints: 3 },
                                { name: '📸 Photo testing suite', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-4-2',
                            name: '✅ Story 4.2: Fiber Installation Task Management',
                            storyPoints: 16,
                            tasks: [
                                { name: '🔧 Create task data model', team: 'Backend', storyPoints: 3 },
                                { name: '🔧 Build mobile task interface', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Implement task notifications', team: 'Backend', storyPoints: 3 },
                                { name: '🔧 Add offline task management', team: 'Frontend', storyPoints: 5 },
                                { name: '🧪 Task workflow testing', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-4-3',
                            name: '📱 Story 4.3: Advanced Mobile Features',
                            storyPoints: 32,
                            tasks: [
                                { name: '🔋 Implement battery optimization', team: 'Frontend', storyPoints: 3 },
                                { name: '📶 Add network connectivity management', team: 'Frontend', storyPoints: 3 },
                                { name: '📱 Implement push notifications', team: 'Frontend', storyPoints: 3 },
                                { name: '🔄 Add background sync capabilities', team: 'Frontend', storyPoints: 5 },
                                { name: '📍 Implement location tracking and geofencing', team: 'Frontend', storyPoints: 5 },
                                { name: '🎨 Create mobile-optimized UI components', team: 'Frontend', storyPoints: 5 },
                                { name: '📊 Add mobile analytics and crash reporting', team: 'Frontend', storyPoints: 3 },
                                { name: '🔐 Implement mobile security features', team: 'Frontend', storyPoints: 3 },
                                { name: '🧪 Mobile performance testing', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-4-4',
                            name: '🔄 Story 4.4: Advanced Offline Architecture & Sync',
                            storyPoints: 45,
                            tasks: [
                                { name: '🏗️ Design offline data storage strategy', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Implement conflict resolution algorithms', team: 'Backend', storyPoints: 5 },
                                { name: '📊 Setup offline data synchronization queues', team: 'Backend', storyPoints: 3 },
                                { name: '⚡ Implement incremental sync protocols', team: 'Backend', storyPoints: 5 },
                                { name: '🛡️ Setup offline data encryption', team: 'Backend', storyPoints: 3 },
                                { name: '💾 Implement local data storage', team: 'Frontend', storyPoints: 3 },
                                { name: '📊 Add sync progress tracking', team: 'Frontend', storyPoints: 2 },
                                { name: '🔔 Implement sync notifications', team: 'Frontend', storyPoints: 2 },
                                { name: '⚡ Optimize sync performance', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Implement delta sync', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Test offline scenarios and edge cases', team: 'QA', storyPoints: 5 },
                                { name: '🧪 Sync testing suite', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-4-5',
                            name: '📱 Story 4.5: React Native Platform-Specific Implementation',
                            storyPoints: 35,
                            tasks: [
                                { name: '📱 Setup iOS-specific build configuration', team: 'Frontend', storyPoints: 3 },
                                { name: '🤖 Setup Android-specific build configuration', team: 'Frontend', storyPoints: 3 },
                                { name: '📱 Implement iOS background processing', team: 'Frontend', storyPoints: 5 },
                                { name: '🤖 Implement Android background processing', team: 'Frontend', storyPoints: 5 },
                                { name: '🔐 Setup iOS Keychain integration', team: 'Frontend', storyPoints: 2 },
                                { name: '🔐 Setup Android Keystore integration', team: 'Frontend', storyPoints: 2 },
                                { name: '📸 Implement native camera module', team: 'Frontend', storyPoints: 5 },
                                { name: '📍 Setup native GPS module', team: 'Frontend', storyPoints: 3 },
                                { name: '📱 Implement native file system access', team: 'Frontend', storyPoints: 3 },
                                { name: '🔔 Setup platform-specific push notifications', team: 'Frontend', storyPoints: 3 },
                                { name: '🧪 Platform-specific testing', team: 'QA', storyPoints: 1 }
                            ]
                        },
                        {
                            id: 'story-4-6',
                            name: '🔧 Story 4.6: Field Worker Technical Tools',
                            storyPoints: 30,
                            tasks: [
                                { name: '🔧 Implement fiber splice documentation', team: 'Frontend', storyPoints: 5 },
                                { name: '📊 Setup OTDR (Optical Time Domain Reflectometer) integration', team: 'Backend', storyPoints: 8 },
                                { name: '🔌 Implement fiber testing equipment integration', team: 'Backend', storyPoints: 8 },
                                { name: '📏 Setup cable length and loss calculations', team: 'Backend', storyPoints: 5 },
                                { name: '🏗️ Implement conduit and infrastructure tracking', team: 'Backend', storyPoints: 5 },
                                { name: '🔧 Add fiber termination documentation', team: 'Frontend', storyPoints: 3 },
                                { name: '📊 Implement signal strength monitoring', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Field equipment testing', team: 'QA', storyPoints: 2 }
                            ]
                        }
                    ]
                },

                // EPIC 5: WhatsApp Integration & Communication (Enhanced)
                {
                    id: 'epic-5',
                    name: '💬 EPIC 5: WhatsApp Integration & Communication',
                    priority: 'P1 (High)',
                    timeline: 'Weeks 10-14 (5 sprints)',
                    team: '2 Backend, 1 Frontend, 1 QA',
                    stories: [
                        {
                            id: 'story-5-0',
                            name: '🏗️ Story 5.0: WhatsApp Integration Architecture & Setup',
                            storyPoints: 12,
                            tasks: [
                                { name: '📱 Research WhatsApp Business API requirements', team: 'Backend', storyPoints: 2 },
                                { name: '🔐 Setup WhatsApp Business account and verification', team: 'DevOps', storyPoints: 2 },
                                { name: '🏗️ Design microservices architecture for chat processing', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Plan file storage strategy for media exports', team: 'Backend', storyPoints: 2 },
                                { name: '🔒 Design data privacy compliance for chat data', team: 'Backend', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-5-1',
                            name: '📤 Story 5.1: WhatsApp Chat Export Processing',
                            storyPoints: 31,
                            tasks: [
                                { name: '🔧 Setup Express.js microservice', team: 'Backend', storyPoints: 5 },
                                { name: '📋 Research WhatsApp export file formats', team: 'Backend', storyPoints: 1 },
                                { name: '🎨 Parse WhatsApp text format', team: 'Backend', storyPoints: 2 },
                                { name: '🎨 Extract media file references', team: 'Backend', storyPoints: 2 },
                                { name: '🎨 Handle timestamp and metadata parsing', team: 'Backend', storyPoints: 2 },
                                { name: '🎨 Implement error handling for malformed exports', team: 'Backend', storyPoints: 2 },
                                { name: '🔧 Create batch processing system', team: 'Backend', storyPoints: 5 },
                                { name: '🔄 Design batch processing queue architecture', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Implement processing progress tracking', team: 'Backend', storyPoints: 2 },
                                { name: '🔧 Build import interface', team: 'Frontend', storyPoints: 5 },
                                { name: '🔧 Add media organization', team: 'Backend', storyPoints: 5 },
                                { name: '🔗 Integrate with photo system', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Create chat parser unit tests', team: 'QA', storyPoints: 2 },
                                { name: '🧪 WhatsApp import testing', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-5-2',
                            name: '🤖 Story 5.2: AI-Powered Media Organization',
                            storyPoints: 17,
                            tasks: [
                                { name: '🤖 Integrate AI image analysis', team: 'Backend', storyPoints: 5 },
                                { name: '🔧 Implement OCR processing', team: 'Backend', storyPoints: 3 },
                                { name: '🔧 Create smart categorization', team: 'Backend', storyPoints: 5 },
                                { name: '🔧 Build search interface', team: 'Frontend', storyPoints: 3 },
                                { name: '🤖 AI processing testing', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-5-3',
                            name: '📊 Story 5.3: Data Management & Performance for WhatsApp',
                            storyPoints: 15,
                            tasks: [
                                { name: '📊 Implement GDPR compliance for chat data', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Create data retention and archival policies', team: 'Backend', storyPoints: 2 },
                                { name: '⚡ Implement chat processing performance optimization', team: 'Backend', storyPoints: 3 },
                                { name: '📈 Add WhatsApp analytics and metrics', team: 'Backend', storyPoints: 3 },
                                { name: '🔐 Setup chat data encryption at rest', team: 'Backend', storyPoints: 2 },
                                { name: '📋 Create WhatsApp compliance documentation', team: 'Backend', storyPoints: 2 }
                            ]
                        }
                    ]
                },

                // EPIC 6: Advanced Features & Reporting (Enhanced)
                {
                    id: 'epic-6',
                    name: '📊 EPIC 6: Advanced Features & Reporting',
                    priority: 'P2 (Medium)',
                    timeline: 'Weeks 12-18 (6 sprints)',
                    team: '2 Frontend, 1 Backend, 1 QA',
                    stories: [
                        {
                            id: 'story-6-0',
                            name: '🏗️ Story 6.0: Reporting Infrastructure & Weather API Setup',
                            storyPoints: 11,
                            tasks: [
                                { name: '🌤️ Research and select weather API provider', team: 'Backend', storyPoints: 1 },
                                { name: '🔐 Setup weather API account and key management', team: 'DevOps', storyPoints: 1 },
                                { name: '📊 Design reporting data warehouse architecture', team: 'Backend', storyPoints: 5 },
                                { name: '📋 Plan report template system architecture', team: 'Backend', storyPoints: 3 },
                                { name: '🎤 Research voice-to-text API options', team: 'Backend', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-6-1',
                            name: '📋 Story 6.1: Daily Reports & Weather Integration',
                            storyPoints: 18,
                            tasks: [
                                { name: '🌤️ Integrate weather API', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Design weather data storage schema', team: 'Backend', storyPoints: 2 },
                                { name: '🔄 Implement weather data caching strategy', team: 'Backend', storyPoints: 2 },
                                { name: '📝 Create daily report templates', team: 'Frontend', storyPoints: 5 },
                                { name: '🎤 Implement voice note integration', team: 'Frontend', storyPoints: 5 },
                                { name: '📱 Design mobile voice recording UX', team: 'UI/UX', storyPoints: 2 },
                                { name: '📄 Build report generation system', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Create weather integration tests', team: 'QA', storyPoints: 2 },
                                { name: '🧪 Daily report testing', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-6-2',
                            name: '📈 Story 6.2: Advanced Analytics Dashboard',
                            storyPoints: 28,
                            tasks: [
                                { name: '🔧 Design analytics data model', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Design analytics data aggregation strategy', team: 'Backend', storyPoints: 3 },
                                { name: '🎨 Create dashboard wireframes and UX design', team: 'UI/UX', storyPoints: 3 },
                                { name: '⚡ Implement real-time data streaming architecture', team: 'Backend', storyPoints: 5 },
                                { name: '📈 Design KPI and metrics framework', team: 'Backend', storyPoints: 2 },
                                { name: '🎨 Implement basic chart components', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Create data filtering interface', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Build real-time data display', team: 'Frontend', storyPoints: 3 },
                                { name: '🎨 Add dashboard customization features', team: 'Frontend', storyPoints: 2 },
                                { name: '🎨 Implement dashboard export functionality', team: 'Frontend', storyPoints: 2 },
                                { name: '🔧 Implement real-time metrics', team: 'Backend', storyPoints: 5 },
                                { name: '🔧 Build report export system', team: 'Backend', storyPoints: 3 },
                                { name: '🔧 Add performance tracking', team: 'Backend', storyPoints: 5 },
                                { name: '📊 Analytics testing', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-6-3',
                            name: '📊 Story 6.3: Data Management & Performance for Reporting',
                            storyPoints: 18,
                            tasks: [
                                { name: '📊 Create data retention and archival policies for reports', team: 'Backend', storyPoints: 2 },
                                { name: '⚡ Add analytics query performance optimization', team: 'Backend', storyPoints: 3 },
                                { name: '📈 Implement report caching and optimization', team: 'Backend', storyPoints: 3 },
                                { name: '🔐 Setup analytics data security and access control', team: 'Backend', storyPoints: 3 },
                                { name: '📋 Create reporting compliance framework', team: 'Backend', storyPoints: 2 },
                                { name: '🔄 Implement automated report generation', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Add report scheduling and delivery', team: 'Backend', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-6-4',
                            name: '🎤 Story 6.4: Voice Notes & Advanced Features',
                            storyPoints: 22,
                            tasks: [
                                { name: '🎤 Setup voice-to-text service integration', team: 'Backend', storyPoints: 3 },
                                { name: '📱 Implement mobile voice recording interface', team: 'Frontend', storyPoints: 3 },
                                { name: '🔧 Create voice note storage and management', team: 'Backend', storyPoints: 3 },
                                { name: '🎨 Build voice note playback interface', team: 'Frontend', storyPoints: 2 },
                                { name: '📝 Implement voice note transcription', team: 'Backend', storyPoints: 3 },
                                { name: '🔍 Add voice note search functionality', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Create voice note analytics', team: 'Backend', storyPoints: 2 },
                                { name: '🧪 Voice note testing suite', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-6-5',
                            name: '📊 Story 6.5: Data Processing & Analytics Infrastructure',
                            storyPoints: 40,
                            tasks: [
                                { name: '📊 Setup data warehouse architecture', team: 'Backend', storyPoints: 8 },
                                { name: '🔄 Implement ETL pipelines', team: 'Backend', storyPoints: 5 },
                                { name: '📈 Setup time-series data handling', team: 'Backend', storyPoints: 5 },
                                { name: '🔍 Implement full-text search', team: 'Backend', storyPoints: 5 },
                                { name: '📊 Setup data backup and recovery', team: 'DevOps', storyPoints: 5 },
                                { name: '🔄 Implement data archival policies', team: 'Backend', storyPoints: 3 },
                                { name: '📈 Setup predictive analytics engine', team: 'Backend', storyPoints: 5 },
                                { name: '🔍 Implement advanced search algorithms', team: 'Backend', storyPoints: 3 },
                                { name: '🧪 Data processing testing', team: 'QA', storyPoints: 1 }
                            ]
                        },
                        {
                            id: 'story-6-6',
                            name: '🔄 Story 6.6: Advanced CI/CD & DevOps Infrastructure',
                            storyPoints: 35,
                            tasks: [
                                { name: '🔧 Setup GitHub Actions workflows', team: 'DevOps', storyPoints: 3 },
                                { name: '🧪 Configure automated testing pipeline', team: 'DevOps', storyPoints: 3 },
                                { name: '📱 Setup mobile app build automation', team: 'DevOps', storyPoints: 5 },
                                { name: '🚀 Configure deployment automation', team: 'DevOps', storyPoints: 3 },
                                { name: '📊 Setup pipeline monitoring and alerts', team: 'DevOps', storyPoints: 2 },
                                { name: '🔐 Implement deployment security scanning', team: 'DevOps', storyPoints: 3 },
                                { name: '🔄 Setup blue-green deployment strategy', team: 'DevOps', storyPoints: 5 },
                                { name: '📊 Implement deployment rollback mechanisms', team: 'DevOps', storyPoints: 3 },
                                { name: '🔍 Setup deployment audit logging', team: 'DevOps', storyPoints: 2 },
                                { name: '🧪 CI/CD pipeline testing', team: 'QA', storyPoints: 1 }
                            ]
                        }
                    ]
                },

                // EPIC 7: Quality Assurance & Performance (Enhanced)
                {
                    id: 'epic-7',
                    name: '🧪 EPIC 7: Quality Assurance & Performance',
                    priority: 'P1 (High)',
                    timeline: 'Weeks 16-20 (4 sprints)',
                    team: '1 Frontend, 1 Backend, 2 QA',
                    stories: [
                        {
                            id: 'story-7-0',
                            name: '🏗️ Story 7.0: Testing Infrastructure Foundation',
                            storyPoints: 17,
                            tasks: [
                                { name: '🧪 Setup test environment infrastructure', team: 'DevOps', storyPoints: 3 },
                                { name: '📊 Configure test data management system', team: 'QA', storyPoints: 3 },
                                { name: '🔧 Setup automated testing pipeline', team: 'DevOps', storyPoints: 5 },
                                { name: '📱 Configure mobile device testing lab', team: 'QA', storyPoints: 3 },
                                { name: '🛡️ Setup security testing tools and scanners', team: 'DevOps', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-7-1',
                            name: '🔬 Story 7.1: Comprehensive Testing Suite',
                            storyPoints: 42,
                            tasks: [
                                { name: '🔧 Setup testing infrastructure', team: 'QA', storyPoints: 5 },
                                { name: '📋 Create testing strategy documentation', team: 'QA', storyPoints: 2 },
                                { name: '🔄 Implement test data factories and fixtures', team: 'QA', storyPoints: 3 },
                                { name: '📊 Setup test coverage reporting', team: 'QA', storyPoints: 2 },
                                { name: '🧪 Create API contract testing', team: 'QA', storyPoints: 3 },
                                { name: '📱 Implement cross-browser testing', team: 'QA', storyPoints: 2 },
                                { name: '🎨 Write backend API unit tests', team: 'QA', storyPoints: 3 },
                                { name: '🎨 Create frontend component unit tests', team: 'QA', storyPoints: 3 },
                                { name: '🎨 Implement database layer unit tests', team: 'QA', storyPoints: 2 },
                                { name: '🎨 Add utility function unit tests', team: 'QA', storyPoints: 1 },
                                { name: '🎨 Create API integration test suite', team: 'QA', storyPoints: 3 },
                                { name: '🎨 Build database integration tests', team: 'QA', storyPoints: 2 },
                                { name: '🎨 Implement third-party service integration tests', team: 'QA', storyPoints: 3 },
                                { name: '🎨 Add end-to-end workflow tests', team: 'QA', storyPoints: 3 },
                                { name: '🔧 Add performance testing', team: 'QA', storyPoints: 5 },
                                { name: '🛡️ Security testing implementation', team: 'QA', storyPoints: 5 },
                                { name: '📱 Mobile device testing', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-7-2',
                            name: '⚡ Story 7.2: Performance Optimization & Monitoring',
                            storyPoints: 25,
                            tasks: [
                                { name: '📊 Implement performance regression testing', team: 'QA', storyPoints: 3 },
                                { name: '⚡ Create load testing suite', team: 'QA', storyPoints: 5 },
                                { name: '📈 Setup performance monitoring and alerting', team: 'DevOps', storyPoints: 3 },
                                { name: '🔧 Implement database query optimization', team: 'Backend', storyPoints: 3 },
                                { name: '🎨 Frontend performance optimization', team: 'Frontend', storyPoints: 3 },
                                { name: '📱 Mobile app performance optimization', team: 'Frontend', storyPoints: 3 },
                                { name: '🌐 API response time optimization', team: 'Backend', storyPoints: 3 },
                                { name: '📊 Create performance benchmarking', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-7-3',
                            name: '🛡️ Story 7.3: Security & Compliance Testing',
                            storyPoints: 20,
                            tasks: [
                                { name: '🛡️ Implement compliance testing automation', team: 'QA', storyPoints: 3 },
                                { name: '🔐 Setup penetration testing framework', team: 'QA', storyPoints: 3 },
                                { name: '📋 Create security audit procedures', team: 'QA', storyPoints: 2 },
                                { name: '🔍 Implement vulnerability scanning', team: 'DevOps', storyPoints: 3 },
                                { name: '📊 Setup security monitoring and logging', team: 'DevOps', storyPoints: 3 },
                                { name: '🛡️ Create data privacy testing suite', team: 'QA', storyPoints: 3 },
                                { name: '📋 Implement GDPR compliance testing', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-7-4',
                            name: '🧪 Story 7.4: Advanced Testing Infrastructure',
                            storyPoints: 30,
                            tasks: [
                                { name: '🧪 Setup test environment provisioning', team: 'DevOps', storyPoints: 5 },
                                { name: '📊 Implement test data management', team: 'QA', storyPoints: 3 },
                                { name: '🔄 Setup test automation framework', team: 'QA', storyPoints: 5 },
                                { name: '📱 Configure mobile device testing farm', team: 'QA', storyPoints: 5 },
                                { name: '🌐 Setup cross-browser testing infrastructure', team: 'QA', storyPoints: 3 },
                                { name: '📊 Implement test reporting and analytics', team: 'QA', storyPoints: 3 },
                                { name: '🔄 Setup continuous testing pipeline', team: 'QA', storyPoints: 3 },
                                { name: '🧪 Create test environment monitoring', team: 'DevOps', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-7-5',
                            name: '⚡ Story 7.5: Comprehensive Performance Testing',
                            storyPoints: 25,
                            tasks: [
                                { name: '⚡ Setup load testing infrastructure', team: 'QA', storyPoints: 5 },
                                { name: '📊 Implement stress testing scenarios', team: 'QA', storyPoints: 3 },
                                { name: '🔄 Setup endurance testing', team: 'QA', storyPoints: 3 },
                                { name: '📱 Implement mobile performance testing', team: 'QA', storyPoints: 3 },
                                { name: '🗺️ Setup MapBox performance testing', team: 'QA', storyPoints: 3 },
                                { name: '📊 Implement database performance testing', team: 'QA', storyPoints: 3 },
                                { name: '🌐 Setup API performance testing', team: 'QA', storyPoints: 3 },
                                { name: '📈 Create performance benchmarking', team: 'QA', storyPoints: 2 }
                            ]
                        }
                    ]
                },

                // EPIC 8: Deployment & Production Readiness (Enhanced)
                {
                    id: 'epic-8',
                    name: '🚀 EPIC 8: Deployment & Production Readiness',
                    priority: 'P0 (Critical)',
                    timeline: 'Weeks 20-24 (4 sprints)',
                    team: '1 Backend, 1 Frontend, 1 QA, 1 DevOps',
                    stories: [
                        {
                            id: 'story-8-0',
                            name: '🏗️ Story 8.0: Infrastructure Planning & Environment Setup',
                            storyPoints: 13,
                            tasks: [
                                { name: '☁️ Research and select cloud provider', team: 'DevOps', storyPoints: 2 },
                                { name: '🏗️ Design production architecture diagram', team: 'DevOps', storyPoints: 3 },
                                { name: '🔐 Plan security and compliance requirements', team: 'DevOps', storyPoints: 3 },
                                { name: '📊 Design disaster recovery strategy', team: 'DevOps', storyPoints: 3 },
                                { name: '💰 Create infrastructure cost analysis', team: 'DevOps', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-8-1',
                            name: '☁️ Story 8.1: Production Infrastructure Setup',
                            storyPoints: 35,
                            tasks: [
                                { name: '🌐 Setup domain and DNS management', team: 'DevOps', storyPoints: 2 },
                                { name: '🔒 Configure SSL certificates and HTTPS', team: 'DevOps', storyPoints: 2 },
                                { name: '📊 Implement infrastructure as code (IaC)', team: 'DevOps', storyPoints: 5 },
                                { name: '🔄 Setup database replication and failover', team: 'DevOps', storyPoints: 5 },
                                { name: '📱 Configure mobile app distribution', team: 'DevOps', storyPoints: 3 },
                                { name: '🎨 Configure cloud networking and VPC', team: 'DevOps', storyPoints: 2 },
                                { name: '🎨 Setup container orchestration platform', team: 'DevOps', storyPoints: 3 },
                                { name: '🎨 Configure load balancers and CDN', team: 'DevOps', storyPoints: 2 },
                                { name: '🎨 Implement auto-scaling policies', team: 'DevOps', storyPoints: 2 },
                                { name: '🎨 Setup production databases', team: 'DevOps', storyPoints: 3 },
                                { name: '🔧 Implement CI/CD pipeline', team: 'DevOps', storyPoints: 5 },
                                { name: '📊 Configure monitoring systems', team: 'DevOps', storyPoints: 5 },
                                { name: '💾 Setup backup systems', team: 'DevOps', storyPoints: 3 },
                                { name: '🛡️ Security hardening', team: 'DevOps', storyPoints: 5 },
                                { name: '🧪 Production testing', team: 'QA', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-8-2',
                            name: '📊 Story 8.2: Production Monitoring & Maintenance',
                            storyPoints: 14,
                            tasks: [
                                { name: '📊 Setup application performance monitoring', team: 'DevOps', storyPoints: 3 },
                                { name: '🚨 Configure alerting and incident response', team: 'DevOps', storyPoints: 3 },
                                { name: '📋 Create runbook and operational procedures', team: 'DevOps', storyPoints: 3 },
                                { name: '🔄 Implement automated backup verification', team: 'DevOps', storyPoints: 2 },
                                { name: '📈 Setup capacity planning and scaling', team: 'DevOps', storyPoints: 3 }
                            ]
                        },
                        {
                            id: 'story-8-3',
                            name: '🌍 Story 8.3: Global Deployment & Compliance',
                            storyPoints: 18,
                            tasks: [
                                { name: '🌍 Setup data sovereignty and geographic compliance', team: 'DevOps', storyPoints: 3 },
                                { name: '🔐 Implement multi-region security policies', team: 'DevOps', storyPoints: 3 },
                                { name: '📊 Setup global performance monitoring', team: 'DevOps', storyPoints: 3 },
                                { name: '🔄 Implement cross-region data replication', team: 'DevOps', storyPoints: 5 },
                                { name: '📋 Create international compliance documentation', team: 'DevOps', storyPoints: 2 },
                                { name: '🧪 Global deployment testing', team: 'QA', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-8-4',
                            name: '⚡ Story 8.4: Production Performance Optimization',
                            storyPoints: 16,
                            tasks: [
                                { name: '⚡ Implement production performance tuning', team: 'DevOps', storyPoints: 3 },
                                { name: '📊 Setup production metrics and KPIs', team: 'DevOps', storyPoints: 3 },
                                { name: '🔧 Optimize production database performance', team: 'DevOps', storyPoints: 3 },
                                { name: '🌐 Implement CDN and caching strategies', team: 'DevOps', storyPoints: 3 },
                                { name: '📈 Setup auto-scaling and load balancing', team: 'DevOps', storyPoints: 2 },
                                { name: '🔄 Implement production health checks', team: 'DevOps', storyPoints: 2 }
                            ]
                        },
                        {
                            id: 'story-8-5',
                            name: '🏢 Story 8.5: Enterprise Integration & Scalability',
                            storyPoints: 35,
                            tasks: [
                                { name: '🏢 Setup enterprise SSO integration', team: 'Backend', storyPoints: 5 },
                                { name: '📊 Implement enterprise reporting APIs', team: 'Backend', storyPoints: 5 },
                                { name: '🔐 Setup enterprise security compliance', team: 'DevOps', storyPoints: 5 },
                                { name: '📈 Implement horizontal scaling architecture', team: 'DevOps', storyPoints: 5 },
                                { name: '🌐 Setup multi-tenant architecture', team: 'Backend', storyPoints: 8 },
                                { name: '📊 Implement enterprise audit logging', team: 'Backend', storyPoints: 3 },
                                { name: '🔄 Setup enterprise backup strategies', team: 'DevOps', storyPoints: 3 },
                                { name: '🧪 Enterprise integration testing', team: 'QA', storyPoints: 1 }
                            ]
                        },
                        {
                            id: 'story-8-6',
                            name: '🚀 Story 8.6: Production Deployment & Maintenance',
                            storyPoints: 30,
                            tasks: [
                                { name: '🚀 Setup production deployment pipeline', team: 'DevOps', storyPoints: 5 },
                                { name: '📊 Implement production monitoring dashboard', team: 'DevOps', storyPoints: 3 },
                                { name: '🔔 Setup production alerting system', team: 'DevOps', storyPoints: 3 },
                                { name: '📋 Create production runbooks', team: 'DevOps', storyPoints: 3 },
                                { name: '🔄 Setup automated production maintenance', team: 'DevOps', storyPoints: 3 },
                                { name: '📊 Implement production capacity planning', team: 'DevOps', storyPoints: 3 },
                                { name: '🛡️ Setup production security monitoring', team: 'DevOps', storyPoints: 3 },
                                { name: '📈 Implement production cost optimization', team: 'DevOps', storyPoints: 3 },
                                { name: '🔄 Setup disaster recovery procedures', team: 'DevOps', storyPoints: 5 },
                                { name: '🧪 Production deployment testing', team: 'QA', storyPoints: 1 }
                            ]
                        }
                    ]
                }
            ]
        };
    }
}

// Main execution
async function main() {
    try {
        const importer = new NotionBulkImporter(
            process.env.NOTION_TOKEN,
            process.env.NOTION_DATABASE_ID
        );

        await importer.importCompleteProject();

    } catch (error) {
        console.error(chalk.red(`❌ Bulk import failed: ${error.message}`));
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { NotionBulkImporter };
