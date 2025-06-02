/**
 * Workspace Loader Utility
 * Shared utility for loading workspace configurations dynamically
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import chalk from 'chalk';

/**
 * Expand glob patterns to actual workspace directories
 */
function expandGlobPattern(pattern, rootDir = process.cwd()) {
  if (pattern.endsWith('/*')) {
    // Handle glob patterns like "apps/*" or "packages/*"
    const baseDir = pattern.slice(0, -2);
    const basePath = join(rootDir, baseDir);

    try {
      return readdirSync(basePath)
        .map(dir => join(baseDir, dir))
        .filter(dirPath => {
          try {
            const fullPath = join(rootDir, dirPath);
            const packageJsonPath = join(fullPath, 'package.json');
            // Check if it's a directory and has a package.json
            return (
              statSync(fullPath).isDirectory() &&
              statSync(packageJsonPath).isFile()
            );
          } catch {
            return false;
          }
        });
    } catch {
      return [];
    }
  }

  // Return as-is if not a glob pattern
  return [pattern];
}

/**
 * Load workspaces dynamically from root package.json
 */
export function loadWorkspaces(rootDir = process.cwd()) {
  try {
    const rootPackagePath = join(rootDir, 'package.json');
    const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));

    let workspacePatterns = [];

    // Handle both array format and object format for workspaces
    if (Array.isArray(rootPackage.workspaces)) {
      workspacePatterns = rootPackage.workspaces;
    } else if (
      rootPackage.workspaces &&
      Array.isArray(rootPackage.workspaces.packages)
    ) {
      workspacePatterns = rootPackage.workspaces.packages;
    } else {
      console.warn(
        chalk.yellow(
          'Warning: No workspaces configuration found in package.json'
        )
      );
      return [];
    }

    // Expand all glob patterns
    const expandedWorkspaces = workspacePatterns.flatMap(pattern =>
      expandGlobPattern(pattern, rootDir)
    );

    return expandedWorkspaces;
  } catch (error) {
    console.error(
      chalk.red('Error loading workspaces from package.json:'),
      error.message
    );
    // Fallback to hardcoded workspaces if loading fails
    return [
      'apps/web',
      'apps/mobile',
      'packages/shared',
      'packages/ui',
      'packages/supabase',
    ];
  }
}

/**
 * Get workspace patterns from package.json (without expansion)
 */
export function getWorkspacePatterns(rootDir = process.cwd()) {
  try {
    const rootPackagePath = join(rootDir, 'package.json');
    const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));

    // Handle both array format and object format for workspaces
    if (Array.isArray(rootPackage.workspaces)) {
      return rootPackage.workspaces;
    } else if (
      rootPackage.workspaces &&
      Array.isArray(rootPackage.workspaces.packages)
    ) {
      return rootPackage.workspaces.packages;
    } else {
      return [];
    }
  } catch (error) {
    console.error(
      chalk.red('Error reading workspace patterns:'),
      error.message
    );
    return [];
  }
}
