const fs = require('fs');
const path = require('path');

const nextJest = require('next/jest');

// Get the absolute path to the current directory (apps/web)
const currentDir = __dirname;

// Resolve the Next.js app directory relative to this config file
const nextAppDir = path.resolve(currentDir, './');

// Resolve paths to project root and packages directory
const projectRoot = path.resolve(currentDir, '../../');
const packagesDir = path.resolve(projectRoot, 'packages');

// Helper function to safely resolve package paths
function resolvePackagePath(packageName, subPath = '') {
  const packagePath = path.resolve(packagesDir, packageName);
  const fullPath = subPath ? path.resolve(packagePath, subPath) : packagePath;

  // Check if the path exists to provide better error messages
  if (!fs.existsSync(packagePath)) {
    console.warn(`Warning: Package directory not found: ${packagePath}`);
  }

  return fullPath;
}

// Create Jest config using Next.js preset
const createJestConfig = nextJest({
  // Path to the Next.js app directory
  dir: nextAppDir,
});

// Custom Jest configuration
const customJestConfig = {
  // Setup files to run before each test
  setupFilesAfterEnv: [
    // Path to test setup file relative to project root
    path.resolve(currentDir, 'src/tests/setup.ts'),
  ],

  // Module name mapping for path aliases
  moduleNameMapper: {
    // Map @ alias to src directory (relative to current app)
    '^@/(.*)$': path.resolve(currentDir, 'src/$1'),

    // Map @constructtrack packages to their actual locations using helper function
    '^@constructtrack/shared$': resolvePackagePath('shared', 'index.ts'),
    '^@constructtrack/shared/(.*)$': resolvePackagePath('shared', '$1'),
    '^@constructtrack/supabase$': resolvePackagePath('supabase', 'index.ts'),
    '^@constructtrack/supabase/(.*)$': resolvePackagePath('supabase', '$1'),
    '^@constructtrack/ui$': resolvePackagePath('ui', 'index.ts'),
    '^@constructtrack/ui/(.*)$': resolvePackagePath('ui', '$1'),
  },

  // Test environment
  testEnvironment: 'jest-environment-node',

  // Directories to search for tests (relative to current app)
  roots: [
    // Source directory containing tests
    path.resolve(currentDir, 'src'),
  ],

  // Test file patterns (using absolute paths for robustness)
  testMatch: [
    // Match test files in __tests__ directories
    path.resolve(currentDir, 'src/**/__tests__/**/*.{js,jsx,ts,tsx}'),
    // Match files with .test or .spec extensions
    path.resolve(currentDir, 'src/**/*.{test,spec}.{js,jsx,ts,tsx}'),
  ],

  // Files to ignore during testing (using absolute paths)
  testPathIgnorePatterns: [
    // Ignore Next.js build directory
    path.resolve(currentDir, '.next/'),
    // Ignore node_modules (both local and workspace root)
    path.resolve(currentDir, 'node_modules/'),
    path.resolve(projectRoot, 'node_modules/'),
    // Ignore build output directories
    path.resolve(currentDir, 'dist/'),
    path.resolve(currentDir, 'build/'),
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform configuration
  transform: {
    // TypeScript files (using absolute path to tsconfig)
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      // TypeScript configuration file path (relative to current app)
      tsconfig: path.resolve(currentDir, 'tsconfig.json'),
    }],
  },

  // Coverage configuration (using absolute paths for robustness)
  collectCoverageFrom: [
    // Include source files for coverage (relative to current app)
    path.resolve(currentDir, 'src/**/*.{js,jsx,ts,tsx}'),
    // Exclude specific patterns (using absolute paths)
    `!${path.resolve(currentDir, 'src/**/*.d.ts')}`,
    `!${path.resolve(currentDir, 'src/tests/**')}`,
    `!${path.resolve(currentDir, 'src/**/__tests__/**')}`,
  ],

  // Coverage output directory (relative to current app)
  coverageDirectory: path.resolve(currentDir, 'coverage'),

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Global setup and teardown
  globalSetup: undefined,
  globalTeardown: undefined,

  // Maximum number of concurrent workers
  maxWorkers: '50%',

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,
};

// Export the Jest configuration
module.exports = createJestConfig(customJestConfig);
