#!/usr/bin/env node

/**
 * Contract Testing CLI Tool
 * Runs API contract tests against OpenAPI specifications
 */

import fs from 'fs';
import path from 'path';

// import { fileURLToPath } from 'url';
import SwaggerParser from '@apidevtools/swagger-parser';
import chalk from 'chalk';
import { program } from 'commander';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Import contract testing framework
// Note: In a real implementation, you'd need to handle ES modules properly
const { ContractTestRunner, contractTestUtils } = await import(
  '../apps/web/src/lib/api/contract-testing.js'
);

// CLI configuration
program
  .name('contract-tests')
  .description('Run API contract tests against OpenAPI specifications')
  .version('1.0.0')
  .option(
    '-s, --spec <path>',
    'Path to OpenAPI specification file',
    'docs/api/openapi.yaml'
  )
  .option(
    '-u, --base-url <url>',
    'Base URL for API testing',
    'http://localhost:3001/api/v1'
  )
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('-e, --endpoints <list>', 'Comma-separated list of endpoints to test')
  .option('--no-request-validation', 'Disable request validation')
  .option('--no-response-validation', 'Disable response validation')
  .option('--strict', 'Enable strict mode (test deprecated endpoints)')
  .option('--generate-examples', 'Generate example requests/responses')
  .option(
    '-o, --output <path>',
    'Output directory for test results',
    'docs/api/contract-tests'
  )
  .option(
    '-f, --format <type>',
    'Output format (json|markdown|html)',
    'markdown'
  )
  .option('-v, --verbose', 'Verbose output')
  .option('--dry-run', 'Validate configuration without running tests');

program.parse();

const options = program.opts();

// Main execution
async function main() {
  try {
    console.log(chalk.blue.bold('🧪 API Contract Testing'));
    console.log(chalk.gray('='.repeat(40)));

    // Validate configuration
    await validateConfiguration();

    if (options.dryRun) {
      console.log(chalk.green('✅ Configuration is valid'));
      console.log(chalk.yellow('🏃 Dry run mode - skipping actual tests'));
      return;
    }

    // Parse OpenAPI specification
    console.log(chalk.yellow('📋 Parsing OpenAPI specification...'));
    const spec = await SwaggerParser.parse(options.spec);
    console.log(
      chalk.green(
        `✅ Loaded specification: ${spec.info.title} v${spec.info.version}`
      )
    );

    // Configure test runner
    const config = {
      baseUrl: options.baseUrl,
      timeout: parseInt(options.timeout),
      validateRequest: options.requestValidation,
      validateResponse: options.responseValidation,
      strictMode: options.strict,
      generateExamples: options.generateExamples,
    };

    if (options.verbose) {
      console.log(chalk.gray('Configuration:'), config);
    }

    // Determine endpoints to test
    const endpointsToTest = options.endpoints
      ? options.endpoints.split(',').map(e => e.trim())
      : undefined;

    if (endpointsToTest) {
      console.log(
        chalk.yellow(
          `🎯 Testing specific endpoints: ${endpointsToTest.join(', ')}`
        )
      );
    } else {
      const totalEndpoints = Object.keys(spec.paths || {}).length;
      console.log(chalk.yellow(`🎯 Testing all ${totalEndpoints} endpoints`));
    }

    // Run contract tests
    console.log(chalk.yellow('🧪 Running contract tests...'));
    const runner = new ContractTestRunner(config);
    const suite = await runner.runContractTests(spec, endpointsToTest);

    // Display results
    displayResults(suite);

    // Generate output files
    await generateOutputFiles(suite);

    // Exit with appropriate code
    const exitCode = suite.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error(chalk.red.bold('❌ Contract testing failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function validateConfiguration() {
  console.log(chalk.yellow('🔍 Validating configuration...'));

  // Check if spec file exists
  if (!fs.existsSync(options.spec)) {
    throw new Error(`OpenAPI specification file not found: ${options.spec}`);
  }

  // Check if base URL is reachable (if not dry run)
  if (!options.dryRun && options.baseUrl) {
    try {
      const healthUrl = `${options.baseUrl.replace('/api/v1', '')}/api/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.warn(
          chalk.yellow(`⚠️  API server health check failed: ${response.status}`)
        );
      } else {
        console.log(chalk.green('✅ API server is reachable'));
      }
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Could not reach API server: ${error.message}`)
      );
      console.warn(
        chalk.yellow('   Tests may fail if the server is not running')
      );
    }
  }

  // Validate timeout
  const timeout = parseInt(options.timeout);
  if (isNaN(timeout) || timeout <= 0) {
    throw new Error(`Invalid timeout value: ${options.timeout}`);
  }

  // Validate output format
  if (!['json', 'markdown', 'html'].includes(options.format)) {
    throw new Error(
      `Invalid output format: ${options.format}. Must be json, markdown, or html`
    );
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
    console.log(chalk.green(`✅ Created output directory: ${options.output}`));
  }

  console.log(chalk.green('✅ Configuration is valid'));
}

function displayResults(suite) {
  const { summary } = suite;

  console.log(chalk.blue.bold('\n📊 Test Results'));
  console.log(chalk.gray('='.repeat(20)));

  console.log(`${chalk.bold('Total:')} ${summary.total}`);
  console.log(`${chalk.green('Passed:')} ${summary.passed} ✅`);
  console.log(`${chalk.red('Failed:')} ${summary.failed} ❌`);
  console.log(`${chalk.yellow('Skipped:')} ${summary.skipped} ⏭️`);
  console.log(`${chalk.gray('Duration:')} ${summary.duration}ms`);

  if (summary.failed > 0) {
    console.log(chalk.red.bold('\n❌ Failed Tests:'));
    const failedTests = contractTestUtils.filterResults(suite, 'failed');

    failedTests.forEach(test => {
      console.log(chalk.red(`  • ${test.method} ${test.endpoint}`));
      test.errors.forEach(error => {
        console.log(chalk.gray(`    - ${error}`));
      });
    });
  }

  if (summary.skipped > 0 && options.verbose) {
    console.log(chalk.yellow.bold('\n⏭️  Skipped Tests:'));
    const skippedTests = contractTestUtils.filterResults(suite, 'skipped');

    skippedTests.forEach(test => {
      console.log(chalk.yellow(`  • ${test.method} ${test.endpoint}`));
      test.warnings.forEach(warning => {
        console.log(chalk.gray(`    - ${warning}`));
      });
    });
  }

  // Success rate
  const successRate =
    summary.total > 0
      ? ((summary.passed / summary.total) * 100).toFixed(1)
      : '0.0';

  console.log(chalk.blue(`\n📈 Success Rate: ${successRate}%`));
}

async function generateOutputFiles(suite) {
  console.log(chalk.yellow('\n📄 Generating output files...'));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = `contract-tests-${timestamp}`;

  try {
    // Always generate JSON
    const jsonPath = path.join(options.output, `${baseFilename}.json`);
    const jsonContent = contractTestUtils.exportResults(suite);
    fs.writeFileSync(jsonPath, jsonContent);
    console.log(chalk.green(`✅ JSON report: ${jsonPath}`));

    // Generate requested format
    if (options.format === 'markdown') {
      const markdownPath = path.join(options.output, `${baseFilename}.md`);
      const markdownContent = contractTestUtils.generateReport(suite);
      fs.writeFileSync(markdownPath, markdownContent);
      console.log(chalk.green(`✅ Markdown report: ${markdownPath}`));
    }

    if (options.format === 'html') {
      const htmlPath = path.join(options.output, `${baseFilename}.html`);
      const htmlContent = generateHtmlReport(suite);
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(chalk.green(`✅ HTML report: ${htmlPath}`));
    }

    // Generate summary file
    const summaryPath = path.join(options.output, 'latest-summary.json');
    const summaryContent = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: suite.summary,
        config: {
          spec: options.spec,
          baseUrl: options.baseUrl,
          endpoints: options.endpoints || 'all',
        },
      },
      null,
      2
    );
    fs.writeFileSync(summaryPath, summaryContent);
    console.log(chalk.green(`✅ Summary: ${summaryPath}`));
  } catch (error) {
    console.error(
      chalk.red(`❌ Failed to generate output files: ${error.message}`)
    );
  }
}

function generateHtmlReport(suite) {
  const { summary, results } = suite;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Contract Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .test-result { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .test-result.passed { border-left-color: #28a745; }
        .test-result.failed { border-left-color: #dc3545; }
        .test-result.skipped { border-left-color: #ffc107; }
        .error { color: #dc3545; font-size: 0.9em; margin-left: 20px; }
        .warning { color: #ffc107; font-size: 0.9em; margin-left: 20px; }
    </style>
</head>
<body>
    <h1>API Contract Test Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total:</strong> ${summary.total}</p>
        <p><strong class="passed">Passed:</strong> ${summary.passed}</p>
        <p><strong class="failed">Failed:</strong> ${summary.failed}</p>
        <p><strong class="skipped">Skipped:</strong> ${summary.skipped}</p>
        <p><strong>Duration:</strong> ${summary.duration}ms</p>
    </div>
    
    <h2>Test Results</h2>
    ${results
      .map(
        result => `
        <div class="test-result ${result.status}">
            <h3>${result.method} ${result.endpoint}</h3>
            <p><strong>Status:</strong> ${result.status}</p>
            <p><strong>Duration:</strong> ${result.duration}ms</p>
            ${
              result.errors.length > 0
                ? `
                <h4>Errors:</h4>
                ${result.errors.map(error => `<div class="error">• ${error}</div>`).join('')}
            `
                : ''
            }
            ${
              result.warnings.length > 0
                ? `
                <h4>Warnings:</h4>
                ${result.warnings.map(warning => `<div class="warning">• ${warning}</div>`).join('')}
            `
                : ''
            }
        </div>
    `
      )
      .join('')}
    
    <footer>
        <p><em>Generated on ${new Date().toISOString()}</em></p>
    </footer>
</body>
</html>
  `.trim();
}

// Run the CLI
main().catch(error => {
  console.error(chalk.red.bold('❌ Unexpected error:'), error);
  process.exit(1);
});
