#!/usr/bin/env node

/**
 * OpenAPI Specification Validation Script
 *
 * This script validates the OpenAPI specification against the actual API implementation
 * to ensure they stay in sync and prevent specification drift.
 *
 * Features:
 * - Validates OpenAPI spec syntax and structure
 * - Compares spec against actual API endpoints
 * - Checks for missing or extra endpoints
 * - Validates response schemas
 * - Generates validation reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import SwaggerParser from '@apidevtools/swagger-parser';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  openApiSpecPath: path.resolve(__dirname, '../docs/api/openapi.yaml'),
  apiImplementationPath: path.resolve(__dirname, '../apps/web/src/app/api'),
  outputDir: path.resolve(__dirname, '../docs/api/validation'),
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api/v1',
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  fix: process.argv.includes('--fix'),
  generateReport: process.argv.includes('--report'),
};

// Validation results
const results = {
  specValidation: { passed: false, errors: [], warnings: [] },
  implementationValidation: { passed: false, errors: [], warnings: [] },
  endpointComparison: { passed: false, errors: [], warnings: [] },
  schemaValidation: { passed: false, errors: [], warnings: [] },
  summary: { totalErrors: 0, totalWarnings: 0, passed: false },
};

/**
 * Main validation function
 */
async function validateOpenAPI() {
  console.log(chalk.blue.bold('🔍 OpenAPI Specification Validation'));
  console.log(chalk.gray('='.repeat(50)));

  try {
    // Step 1: Validate OpenAPI spec syntax
    await validateSpecSyntax();

    // Step 2: Discover actual API endpoints
    const actualEndpoints = await discoverApiEndpoints();

    // Step 3: Compare spec vs implementation
    await compareSpecWithImplementation(actualEndpoints);

    // Step 4: Validate schemas
    await validateSchemas();

    // Step 5: Compute summary & display results
    displayResults(); // <- computes summary

    // Step 6: Generate validation report (now has correct summary)
    if (CONFIG.generateReport) {
      await generateValidationReport();
    }

    // Exit with appropriate code
    process.exit(results.summary.passed ? 0 : 1);
  } catch (error) {
    console.error(chalk.red.bold('❌ Validation failed:'), error.message);
    if (CONFIG.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Validate OpenAPI specification syntax and structure
 */
async function validateSpecSyntax() {
  console.log(chalk.yellow('📋 Validating OpenAPI specification syntax...'));

  try {
    if (!fs.existsSync(CONFIG.openApiSpecPath)) {
      throw new Error(`OpenAPI spec file not found: ${CONFIG.openApiSpecPath}`);
    }

    // Parse and validate the OpenAPI spec
    const api = await SwaggerParser.validate(CONFIG.openApiSpecPath);

    results.specValidation.passed = true;
    console.log(chalk.green('✅ OpenAPI specification is valid'));

    if (CONFIG.verbose) {
      console.log(chalk.gray(`   Title: ${api.info.title}`));
      console.log(chalk.gray(`   Version: ${api.info.version}`));
      console.log(
        chalk.gray(`   Paths: ${Object.keys(api.paths || {}).length}`)
      );
    }

    return api;
  } catch (error) {
    results.specValidation.passed = false;
    results.specValidation.errors.push({
      type: 'SPEC_SYNTAX_ERROR',
      message: error.message,
      file: CONFIG.openApiSpecPath,
    });

    console.log(chalk.red('❌ OpenAPI specification validation failed'));
    if (CONFIG.verbose) {
      console.error(chalk.red(`   Error: ${error.message}`));
    }

    throw error;
  }
}

/**
 * Discover actual API endpoints from the implementation
 */
async function discoverApiEndpoints() {
  console.log(
    chalk.yellow('🔍 Discovering API endpoints from implementation...')
  );

  const endpoints = new Map();

  try {
    await scanDirectory(CONFIG.apiImplementationPath, endpoints);

    console.log(chalk.green(`✅ Found ${endpoints.size} API endpoints`));

    if (CONFIG.verbose) {
      for (const [path, methods] of endpoints) {
        console.log(
          chalk.gray(`   ${path}: ${Array.from(methods).join(', ')}`)
        );
      }
    }

    // Mark implementation validation as passed if we get here
    results.implementationValidation.passed = true;

    return endpoints;
  } catch (error) {
    results.implementationValidation.passed = false;
    results.implementationValidation.errors.push({
      type: 'IMPLEMENTATION_SCAN_ERROR',
      message: error.message,
      path: CONFIG.apiImplementationPath,
    });

    console.log(chalk.red('❌ Failed to scan API implementation'));
    throw error;
  }
}

/**
 * Recursively scan directory for API route files
 */
async function scanDirectory(dirPath, endpoints, basePath = '') {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory() && !item.startsWith('__')) {
      // Recursively scan subdirectories
      const newBasePath = basePath + '/' + item;
      await scanDirectory(itemPath, endpoints, newBasePath);
    } else if (item === 'route.ts' || item === 'route.js') {
      // Found a route file
      const routePath = basePath || '/';
      const methods = await extractHttpMethods(itemPath);
      endpoints.set(routePath, methods);
    }
  }
}

/**
 * Extract HTTP methods from a route file
 */
async function extractHttpMethods(filePath) {
  const methods = new Set();

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Look for exported HTTP method functions
    const httpMethods = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
    ];

    for (const method of httpMethods) {
      // Check for both named exports and default exports
      const patterns = [
        new RegExp(`export\\s+async\\s+function\\s+${method}`, 'i'),
        new RegExp(`export\\s+function\\s+${method}`, 'i'),
        new RegExp(`export\\s+const\\s+${method}\\s*=`, 'i'),
        new RegExp(`exports\\.${method}\\s*=`, 'i'),
      ];

      if (patterns.some(pattern => pattern.test(content))) {
        methods.add(method);
      }
    }
  } catch {
    console.warn(chalk.yellow(`⚠️  Could not read route file: ${filePath}`));
  }

  return methods;
}

/**
 * Compare OpenAPI spec with actual implementation
 */
async function compareSpecWithImplementation(actualEndpoints) {
  console.log(
    chalk.yellow('🔄 Comparing specification with implementation...')
  );

  try {
    const api = await SwaggerParser.parse(CONFIG.openApiSpecPath);
    const specPaths = Object.keys(api.paths || {});
    const actualPaths = Array.from(actualEndpoints.keys());

    // Find missing endpoints in spec
    const missingInSpec = actualPaths.filter(path => !specPaths.includes(path));

    // Find missing endpoints in implementation
    const missingInImplementation = specPaths.filter(
      path => !actualPaths.includes(path)
    );

    // Find method mismatches
    const methodMismatches = [];

    for (const [path, actualMethods] of actualEndpoints) {
      if (api.paths[path]) {
        const specMethods = Object.keys(api.paths[path]).map(m =>
          m.toUpperCase()
        );
        const actualMethodsArray = Array.from(actualMethods);

        const missingInSpecMethods = actualMethodsArray.filter(
          m => !specMethods.includes(m)
        );
        const missingInImplMethods = specMethods.filter(
          m => !actualMethodsArray.includes(m)
        );

        if (
          missingInSpecMethods.length > 0 ||
          missingInImplMethods.length > 0
        ) {
          methodMismatches.push({
            path,
            missingInSpec: missingInSpecMethods,
            missingInImplementation: missingInImplMethods,
          });
        }
      }
    }

    // Record results
    if (
      missingInSpec.length === 0 &&
      missingInImplementation.length === 0 &&
      methodMismatches.length === 0
    ) {
      results.endpointComparison.passed = true;
      console.log(
        chalk.green('✅ Specification and implementation are in sync')
      );
    } else {
      results.endpointComparison.passed = false;

      if (missingInSpec.length > 0) {
        results.endpointComparison.errors.push({
          type: 'MISSING_IN_SPEC',
          message: `Endpoints found in implementation but missing in spec: ${missingInSpec.join(', ')}`,
          paths: missingInSpec,
        });
      }

      if (missingInImplementation.length > 0) {
        results.endpointComparison.errors.push({
          type: 'MISSING_IN_IMPLEMENTATION',
          message: `Endpoints found in spec but missing in implementation: ${missingInImplementation.join(', ')}`,
          paths: missingInImplementation,
        });
      }

      if (methodMismatches.length > 0) {
        results.endpointComparison.errors.push({
          type: 'METHOD_MISMATCH',
          message: 'HTTP method mismatches found',
          mismatches: methodMismatches,
        });
      }

      console.log(
        chalk.red('❌ Specification and implementation are out of sync')
      );
    }
  } catch (error) {
    results.endpointComparison.passed = false;
    results.endpointComparison.errors.push({
      type: 'COMPARISON_ERROR',
      message: error.message,
    });

    console.log(chalk.red('❌ Failed to compare spec with implementation'));
    throw error;
  }
}

/**
 * Validate OpenAPI schemas
 */
async function validateSchemas() {
  console.log(chalk.yellow('🔍 Validating OpenAPI schemas...'));

  try {
    const api = await SwaggerParser.parse(CONFIG.openApiSpecPath);

    // Basic schema validation - check if components exist and are properly structured
    const components = api.components || {};
    const schemas = components.schemas || {};

    // Check for common schema issues
    let schemaIssues = 0;

    for (const [schemaName, schema] of Object.entries(schemas)) {
      // Check for missing required properties
      if (schema.type === 'object' && schema.required && schema.properties) {
        for (const requiredProp of schema.required) {
          if (!schema.properties[requiredProp]) {
            results.schemaValidation.warnings.push({
              type: 'MISSING_REQUIRED_PROPERTY',
              message: `Schema '${schemaName}' requires property '${requiredProp}' but it's not defined in properties`,
              schema: schemaName,
              property: requiredProp,
            });
            schemaIssues++;
          }
        }
      }
    }

    // Mark as passed if no critical issues
    results.schemaValidation.passed = true;
    console.log(chalk.green('✅ Schema validation completed'));

    if (schemaIssues > 0) {
      results.schemaValidation.passed = false;
      console.log(chalk.red(`❌ Found ${schemaIssues} schema issues`));
    }
  } catch (error) {
    results.schemaValidation.passed = false;
    results.schemaValidation.errors.push({
      type: 'SCHEMA_VALIDATION_ERROR',
      message: error.message,
    });

    console.log(chalk.red('❌ Schema validation failed'));
    throw error;
  }
}

/**
 * Generate detailed validation report
 */
async function generateValidationReport() {
  console.log(chalk.yellow('📊 Generating validation report...'));

  try {
    // Ensure output directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      results: results,
      summary: {
        totalErrors: results.summary.totalErrors,
        totalWarnings: results.summary.totalWarnings,
        passed: results.summary.passed,
      },
    };

    const reportPath = path.join(
      CONFIG.outputDir,
      `validation-report-${Date.now()}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(chalk.green(`✅ Validation report generated: ${reportPath}`));
  } catch (error) {
    console.warn(
      chalk.yellow(`⚠️  Failed to generate report: ${error.message}`)
    );
  }
}

/**
 * Display validation results
 */
function displayResults() {
  console.log(chalk.blue.bold('\n📋 Validation Results'));
  console.log(chalk.gray('='.repeat(30)));

  // Calculate totals
  const allResults = [
    results.specValidation,
    results.implementationValidation,
    results.endpointComparison,
    results.schemaValidation,
  ];

  results.summary.totalErrors = allResults.reduce(
    (sum, r) => sum + r.errors.length,
    0
  );
  results.summary.totalWarnings = allResults.reduce(
    (sum, r) => sum + r.warnings.length,
    0
  );
  results.summary.passed = allResults.every(r => r.passed);

  // Display summary
  console.log(
    `${results.summary.passed ? chalk.green('✅') : chalk.red('❌')} Overall: ${results.summary.passed ? 'PASSED' : 'FAILED'}`
  );
  console.log(`${chalk.red('🔴')} Errors: ${results.summary.totalErrors}`);
  console.log(
    `${chalk.yellow('🟡')} Warnings: ${results.summary.totalWarnings}`
  );

  // Display detailed results if there are issues
  if (results.summary.totalErrors > 0 || CONFIG.verbose) {
    console.log(chalk.blue.bold('\n📝 Detailed Results:'));

    for (const [category, result] of Object.entries(results)) {
      if (category === 'summary') continue;

      console.log(`\n${chalk.cyan(category)}:`);

      if (result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(chalk.red(`  ❌ ${error.message}`));
          if (CONFIG.verbose && error.details) {
            console.log(
              chalk.gray(`     ${JSON.stringify(error.details, null, 2)}`)
            );
          }
        });
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          console.log(chalk.yellow(`  ⚠️  ${warning.message}`));
        });
      }

      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log(chalk.green('  ✅ No issues found'));
      }
    }
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateOpenAPI().catch(error => {
    console.error(
      chalk.red.bold('💥 Validation script failed:'),
      error.message
    );
    process.exit(1);
  });
}
