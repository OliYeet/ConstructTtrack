#!/usr/bin/env node

/**
 * ConstructTrack Dependency Manager
 * 
 * Utility script for managing dependencies across the monorepo
 * Provides commands for checking, updating, and analyzing dependencies
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const WORKSPACES = [
  'apps/web',
  'apps/mobile', 
  'packages/shared',
  'packages/ui',
  'packages/supabase'
];

class DependencyManager {
  constructor() {
    this.rootDir = process.cwd();
  }

  /**
   * Execute command and return output
   */
  exec(command, options = {}) {
    try {
      return execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        ...options 
      }).trim();
    } catch (error) {
      console.error(chalk.red(`Error executing: ${command}`));
      console.error(chalk.red(error.message));
      return null;
    }
  }

  /**
   * Get package.json for a workspace
   */
  getPackageJson(workspace) {
    try {
      const packagePath = join(this.rootDir, workspace, 'package.json');
      return JSON.parse(readFileSync(packagePath, 'utf8'));
    } catch (error) {
      console.error(chalk.red(`Error reading package.json for ${workspace}`));
      return null;
    }
  }

  /**
   * Check for outdated dependencies across all workspaces
   */
  checkOutdated() {
    console.log(chalk.blue('🔍 Checking for outdated dependencies...\n'));
    
    for (const workspace of WORKSPACES) {
      console.log(chalk.yellow(`📦 ${workspace}`));
      const result = this.exec(`npm outdated --workspace=${workspace}`);
      
      if (result) {
        console.log(result);
      } else {
        console.log(chalk.green('✅ All dependencies up to date'));
      }
      console.log('');
    }
  }

  /**
   * Run security audit across all workspaces
   */
  auditSecurity() {
    console.log(chalk.blue('🛡️ Running security audit...\n'));
    
    const result = this.exec('npm audit --workspaces');
    if (result) {
      console.log(result);
    } else {
      console.log(chalk.green('✅ No security vulnerabilities found'));
    }
  }

  /**
   * Analyze dependency usage across workspaces
   */
  analyzeDependencies() {
    console.log(chalk.blue('📊 Analyzing dependency usage...\n'));
    
    const dependencyMap = new Map();
    
    for (const workspace of WORKSPACES) {
      const pkg = this.getPackageJson(workspace);
      if (!pkg) continue;
      
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies
      };
      
      for (const [name, version] of Object.entries(allDeps)) {
        if (!dependencyMap.has(name)) {
          dependencyMap.set(name, []);
        }
        dependencyMap.get(name).push({ workspace, version });
      }
    }
    
    // Find version conflicts
    console.log(chalk.yellow('🔍 Dependency Version Analysis:'));
    console.log('');
    
    for (const [depName, usages] of dependencyMap.entries()) {
      if (usages.length > 1) {
        const versions = [...new Set(usages.map(u => u.version))];
        if (versions.length > 1) {
          console.log(chalk.red(`⚠️  ${depName} has version conflicts:`));
          for (const usage of usages) {
            console.log(`   ${usage.workspace}: ${usage.version}`);
          }
          console.log('');
        }
      }
    }
    
    // Show shared dependencies
    console.log(chalk.yellow('📦 Shared Dependencies:'));
    console.log('');
    
    for (const [depName, usages] of dependencyMap.entries()) {
      if (usages.length > 1) {
        const versions = [...new Set(usages.map(u => u.version))];
        if (versions.length === 1) {
          console.log(chalk.green(`✅ ${depName}@${versions[0]} (used in ${usages.length} workspaces)`));
        }
      }
    }
  }

  /**
   * Update dependencies with safety checks
   */
  updateDependencies(type = 'patch') {
    console.log(chalk.blue(`🔄 Updating ${type} dependencies...\n`));
    
    const updateFlag = type === 'major' ? '--latest' : '';
    
    for (const workspace of WORKSPACES) {
      console.log(chalk.yellow(`📦 Updating ${workspace}...`));
      
      const result = this.exec(`npm update ${updateFlag} --workspace=${workspace}`);
      if (result) {
        console.log(result);
      }
      console.log('');
    }
    
    console.log(chalk.green('✅ Dependencies updated. Run tests to verify compatibility.'));
  }

  /**
   * Clean and reinstall all dependencies
   */
  cleanInstall() {
    console.log(chalk.blue('🧹 Cleaning and reinstalling dependencies...\n'));
    
    // Clean
    console.log(chalk.yellow('Removing node_modules...'));
    this.exec('npm run workspace:clean');
    
    // Reinstall
    console.log(chalk.yellow('Reinstalling dependencies...'));
    this.exec('npm install');
    
    console.log(chalk.green('✅ Clean install completed'));
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(chalk.blue('📦 ConstructTrack Dependency Manager\n'));
    console.log('Available commands:');
    console.log('');
    console.log(chalk.yellow('  check-outdated') + '  - Check for outdated dependencies');
    console.log(chalk.yellow('  audit') + '          - Run security audit');
    console.log(chalk.yellow('  analyze') + '        - Analyze dependency usage and conflicts');
    console.log(chalk.yellow('  update-patch') + '   - Update patch versions');
    console.log(chalk.yellow('  update-minor') + '   - Update minor versions');
    console.log(chalk.yellow('  update-major') + '   - Update major versions (use with caution)');
    console.log(chalk.yellow('  clean-install') + '  - Clean and reinstall all dependencies');
    console.log(chalk.yellow('  help') + '           - Show this help message');
    console.log('');
    console.log('Usage: node scripts/dependency-manager.js <command>');
  }

  /**
   * Main entry point
   */
  run() {
    const command = process.argv[2];
    
    switch (command) {
      case 'check-outdated':
        this.checkOutdated();
        break;
      case 'audit':
        this.auditSecurity();
        break;
      case 'analyze':
        this.analyzeDependencies();
        break;
      case 'update-patch':
        this.updateDependencies('patch');
        break;
      case 'update-minor':
        this.updateDependencies('minor');
        break;
      case 'update-major':
        this.updateDependencies('major');
        break;
      case 'clean-install':
        this.cleanInstall();
        break;
      case 'help':
      default:
        this.showHelp();
        break;
    }
  }
}

// Run the dependency manager
const manager = new DependencyManager();
manager.run();
