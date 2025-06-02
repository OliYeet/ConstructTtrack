#!/usr/bin/env node

/**
 * ConstructTrack Workspace Validator
 *
 * Validates workspace configuration and package consistency
 * Ensures all packages follow the established conventions
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import chalk from 'chalk';

import { loadWorkspaces } from './utils/workspace-loader.js';

class WorkspaceValidator {
  constructor() {
    this.rootDir = process.cwd();
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Add error message
   */
  addError(message) {
    this.errors.push(message);
  }

  /**
   * Add warning message
   */
  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Read and parse JSON file
   */
  readJson(filePath) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      this.addError(`Failed to read ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate root package.json
   */
  validateRootPackage() {
    console.log(chalk.blue('🔍 Validating root package.json...'));

    const rootPkg = this.readJson(join(this.rootDir, 'package.json'));
    if (!rootPkg) return;

    // Check workspace configuration
    if (!rootPkg.workspaces) {
      this.addError('Root package.json missing workspaces configuration');
    } else {
      // Handle both array format and object format for workspaces
      let workspacesArray;
      if (Array.isArray(rootPkg.workspaces)) {
        workspacesArray = rootPkg.workspaces;
      } else if (
        rootPkg.workspaces &&
        Array.isArray(rootPkg.workspaces.packages)
      ) {
        workspacesArray = rootPkg.workspaces.packages;
      } else {
        this.addError(
          'Workspaces configuration is not in expected format (array or object with packages array)'
        );
        return;
      }

      // Dynamically validate workspace patterns by checking if they resolve to actual folders
      const actualWorkspaces = loadWorkspaces(this.rootDir);

      // Helper function to escape regex special characters
      const escapeRegex = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };

      // Verify that each workspace pattern resolves to at least one folder
      for (const pattern of workspacesArray) {
        const matchingWorkspaces = actualWorkspaces.filter(workspace => {
          // Safe glob matching - escape special characters then replace escaped \* with .*
          const escapedPattern = escapeRegex(pattern).replace('\\*', '.*');
          return new RegExp(`^${escapedPattern}$`).test(workspace);
        });

        if (matchingWorkspaces.length === 0) {
          this.addWarning(`Workspace pattern "${pattern}" does not match any existing folders`);
        }
      }
    }

    // Check required scripts
    const requiredScripts = [
      'build',
      'dev',
      'test',
      'lint',
      'clean',
      'packages:build',
      'deps:check',
      'format',
    ];

    for (const script of requiredScripts) {
      if (!rootPkg.scripts || !rootPkg.scripts[script]) {
        this.addWarning(`Missing recommended script: ${script}`);
      }
    }

    // Check if private
    if (!rootPkg.private) {
      this.addWarning('Root package should be private');
    }
  }

  /**
   * Validate individual workspace package
   */
  validateWorkspacePackage(workspacePath) {
    const packagePath = join(this.rootDir, workspacePath, 'package.json');

    if (!existsSync(packagePath)) {
      this.addError(`Missing package.json in ${workspacePath}`);
      return;
    }

    const pkg = this.readJson(packagePath);
    if (!pkg) return;

    // Check naming convention
    if (workspacePath.startsWith('packages/')) {
      if (!pkg.name || !pkg.name.startsWith('@constructtrack/')) {
        this.addError(
          `Package ${workspacePath} should use @constructtrack/ scope`
        );
      }
    }

    // Check version consistency
    if (!pkg.version) {
      this.addError(`Package ${workspacePath} missing version`);
    } else if (pkg.version !== '1.0.0' && !workspacePath.startsWith('apps/')) {
      this.addWarning(`Package ${workspacePath} version should be 1.0.0`);
    }

    // Check required scripts
    const requiredScripts = ['build'];
    if (workspacePath.startsWith('packages/')) {
      requiredScripts.push('dev');
    }

    for (const script of requiredScripts) {
      if (!pkg.scripts || !pkg.scripts[script]) {
        this.addError(
          `Package ${workspacePath} missing required script: ${script}`
        );
      }
    }

    // Check TypeScript configuration
    const tsConfigPath = join(this.rootDir, workspacePath, 'tsconfig.json');
    if (!existsSync(tsConfigPath)) {
      this.addWarning(`Package ${workspacePath} missing tsconfig.json`);
    }

    // Check internal dependency usage in both dependencies and devDependencies
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    for (const [depName, version] of Object.entries(allDeps)) {
      if (depName.startsWith('@constructtrack/') && version !== '*') {
        const depType = pkg.dependencies?.[depName] ? 'dependencies' : 'devDependencies';
        this.addWarning(
          `Package ${workspacePath} should use "*" for internal dependency ${depName} in ${depType}`
        );
      }
    }
  }

  /**
   * Validate TypeScript configuration
   */
  validateTypeScriptConfig() {
    console.log(chalk.blue('🔍 Validating TypeScript configuration...'));

    const rootTsConfig = join(this.rootDir, 'tsconfig.json');
    if (!existsSync(rootTsConfig)) {
      this.addError('Missing root tsconfig.json');
      return;
    }

    const tsConfig = this.readJson(rootTsConfig);
    if (!tsConfig) return;

    // Check if it's a project references setup
    if (!tsConfig.references) {
      this.addWarning(
        'Consider using TypeScript project references for better build performance'
      );
    }
  }

  /**
   * Validate dependency consistency
   */
  validateDependencyConsistency() {
    console.log(chalk.blue('🔍 Validating dependency consistency...'));

    const workspaces = loadWorkspaces(this.rootDir);
    const dependencyVersions = new Map();

    // Collect all dependency versions
    for (const workspace of workspaces) {
      const pkg = this.readJson(join(this.rootDir, workspace, 'package.json'));
      if (!pkg) continue;

      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      for (const [name, version] of Object.entries(allDeps)) {
        if (!name.startsWith('@constructtrack/')) {
          if (!dependencyVersions.has(name)) {
            dependencyVersions.set(name, new Set());
          }
          dependencyVersions.get(name).add(version);
        }
      }
    }

    // Check for version conflicts
    for (const [depName, versions] of dependencyVersions.entries()) {
      if (versions.size > 1) {
        this.addWarning(
          `Dependency ${depName} has multiple versions: ${Array.from(versions).join(', ')}`
        );
      }
    }
  }

  /**
   * Validate build order
   */
  validateBuildOrder() {
    console.log(chalk.blue('🔍 Validating build order...'));

    const packages = ['shared', 'supabase', 'ui'];
    const rootPkg = this.readJson(join(this.rootDir, 'package.json'));

    if (rootPkg && rootPkg.scripts && rootPkg.scripts['packages:build']) {
      const buildScript = rootPkg.scripts['packages:build'];

      // Check if packages are built in correct order
      let lastIndex = -1;
      for (const pkg of packages) {
        const index = buildScript.indexOf(`packages/${pkg}`);
        if (index === -1) {
          this.addError(`Package ${pkg} not found in packages:build script`);
        } else if (index < lastIndex) {
          this.addError(`Package ${pkg} built in wrong order`);
        } else {
          lastIndex = index;
        }
      }
    }
  }

  /**
   * Run all validations
   */
  validate() {
    console.log(chalk.blue('🔍 Validating ConstructTrack workspace...\n'));

    this.validateRootPackage();

    const workspaces = loadWorkspaces(this.rootDir);

    for (const workspace of workspaces) {
      this.validateWorkspacePackage(workspace);
    }

    this.validateTypeScriptConfig();
    this.validateDependencyConsistency();
    this.validateBuildOrder();

    // Report results
    console.log('\n' + chalk.blue('📊 Validation Results:'));
    console.log('');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(chalk.green('✅ All validations passed!'));
    } else {
      if (this.errors.length > 0) {
        console.log(chalk.red(`❌ ${this.errors.length} error(s) found:`));
        for (const error of this.errors) {
          console.log(chalk.red(`   • ${error}`));
        }
        console.log('');
      }

      if (this.warnings.length > 0) {
        console.log(
          chalk.yellow(`⚠️  ${this.warnings.length} warning(s) found:`)
        );
        for (const warning of this.warnings) {
          console.log(chalk.yellow(`   • ${warning}`));
        }
        console.log('');
      }
    }

    // Exit with error code if there are errors
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }
}

// Run validation
const validator = new WorkspaceValidator();
validator.validate();
