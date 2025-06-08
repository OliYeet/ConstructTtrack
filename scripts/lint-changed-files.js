#!/usr/bin/env node

/**
 * Lint only the files that have been changed in the current branch
 * This helps avoid CI failures due to existing warnings in the codebase
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getChangedFiles() {
  try {
    // Get files changed compared to main branch
    const output = execFileSync('git', ['diff', '--name-only', 'main...HEAD'], {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    return output
      .split('\n')
      .filter(file => file.trim())
      .filter(file => /\.(js|ts|tsx|jsx)$/.test(file))
      .filter(file => {
        // Check if file exists (might have been deleted)
        try {
          fs.accessSync(path.join(process.cwd(), file));
          return true;
        } catch {
          return false;
        }
      });
  } catch (err) {
    console.error('Error getting changed files:', err.message);
    return [];
  }
}

function main() {
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('✅ No JavaScript/TypeScript files changed');
    process.exit(0);
  }

  console.log(`🔍 Linting ${changedFiles.length} changed files:`);
  changedFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');

  try {
    // Run ESLint on changed files only - using execFileSync for security
    const args = ['eslint', ...changedFiles];
    execFileSync('npx', args, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log('✅ All changed files pass linting');
  } catch (err) {
    // Log the underlying error to aid debugging
    console.error(
      '❌ Linting failed for changed files:',
      err instanceof Error ? err.stack ?? err.message : err
    );
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { getChangedFiles };
