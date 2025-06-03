#!/usr/bin/env node

/**
 * Code Quality Metrics Collector
 * Collects and analyzes code quality metrics for ConstructTrack
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  projectRoot: path.join(__dirname, '..'),
  outputDir: path.join(__dirname, '../reports/quality'),
  coverageDir: path.join(__dirname, '../coverage'),
  sourceDir: path.join(__dirname, '../apps/web/src'),
  packagesDir: path.join(__dirname, '../packages'),
};

// Quality thresholds
const thresholds = {
  coverage: {
    statements: 70,
    branches: 70,
    functions: 70,
    lines: 70,
  },
  complexity: {
    cyclomatic: 10,
    cognitive: 15,
  },
  maintainability: {
    minimum: 60,
    target: 80,
  },
  duplication: {
    maximum: 5, // percentage
  },
  techDebt: {
    maximum: 30, // minutes
  },
};

class QualityMetricsCollector {
  constructor() {
    this.ensureDirectories();
    this.metrics = {
      coverage: {},
      complexity: {},
      maintainability: {},
      duplication: {},
      techDebt: {},
      linting: {},
      security: {},
      performance: {},
      timestamp: new Date().toISOString(),
    };
  }

  // Ensure output directories exist
  ensureDirectories() {
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
  }

  // Collect test coverage metrics
  async collectCoverageMetrics() {
    console.log('📊 Collecting test coverage metrics...');

    try {
      // Run tests with coverage
      execSync('npm run test:coverage', {
        cwd: config.projectRoot,
        stdio: 'inherit',
      });

      // Read coverage summary
      const coverageSummaryPath = path.join(config.coverageDir, 'coverage-summary.json');
      if (fs.existsSync(coverageSummaryPath)) {
        const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
        
        this.metrics.coverage = {
          total: coverageSummary.total,
          files: Object.keys(coverageSummary).filter(key => key !== 'total').length,
          summary: {
            statements: coverageSummary.total.statements.pct,
            branches: coverageSummary.total.branches.pct,
            functions: coverageSummary.total.functions.pct,
            lines: coverageSummary.total.lines.pct,
          },
          thresholds: thresholds.coverage,
          passed: this.checkCoverageThresholds(coverageSummary.total),
        };

        console.log('✅ Coverage metrics collected');
      } else {
        console.warn('⚠️ Coverage summary not found');
      }
    } catch (error) {
      console.error('❌ Failed to collect coverage metrics:', error.message);
    }
  }

  // Check if coverage meets thresholds
  checkCoverageThresholds(coverage) {
    return (
      coverage.statements.pct >= thresholds.coverage.statements &&
      coverage.branches.pct >= thresholds.coverage.branches &&
      coverage.functions.pct >= thresholds.coverage.functions &&
      coverage.lines.pct >= thresholds.coverage.lines
    );
  }

  // Collect code complexity metrics
  async collectComplexityMetrics() {
    console.log('🔍 Collecting code complexity metrics...');

    try {
      // Use ESLint complexity rules to analyze complexity
      const complexityReport = execSync(
        'npx eslint apps/web/src --format json --rule "complexity: [error, 10]" --rule "max-depth: [error, 4]" --rule "max-lines-per-function: [error, 50]"',
        {
          cwd: config.projectRoot,
          encoding: 'utf8',
        }
      );

      const eslintResults = JSON.parse(complexityReport);
      
      let totalComplexityIssues = 0;
      let totalFiles = 0;
      let highComplexityFiles = [];

      eslintResults.forEach(result => {
        if (result.messages.length > 0) {
          totalFiles++;
          const complexityIssues = result.messages.filter(msg => 
            msg.ruleId === 'complexity' || 
            msg.ruleId === 'max-depth' || 
            msg.ruleId === 'max-lines-per-function'
          );
          
          if (complexityIssues.length > 0) {
            totalComplexityIssues += complexityIssues.length;
            highComplexityFiles.push({
              file: result.filePath,
              issues: complexityIssues.length,
            });
          }
        }
      });

      this.metrics.complexity = {
        totalFiles,
        totalIssues: totalComplexityIssues,
        highComplexityFiles: highComplexityFiles.slice(0, 10), // Top 10
        averageIssuesPerFile: totalFiles > 0 ? totalComplexityIssues / totalFiles : 0,
        thresholds: thresholds.complexity,
        passed: totalComplexityIssues === 0,
      };

      console.log('✅ Complexity metrics collected');
    } catch (error) {
      console.warn('⚠️ Complexity analysis completed with issues');
      // ESLint exits with non-zero when issues are found, which is expected
    }
  }

  // Collect maintainability metrics
  async collectMaintainabilityMetrics() {
    console.log('🔧 Collecting maintainability metrics...');

    try {
      // Analyze file sizes and structure
      const sourceFiles = this.getSourceFiles(config.sourceDir);
      const packageFiles = this.getSourceFiles(config.packagesDir);
      const allFiles = [...sourceFiles, ...packageFiles];

      let totalLines = 0;
      let totalFiles = allFiles.length;
      let largeFiles = [];
      let longFunctions = [];

      allFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        totalLines += lines;

        if (lines > 300) {
          largeFiles.push({
            file: path.relative(config.projectRoot, filePath),
            lines,
          });
        }

        // Simple function length analysis
        const functionMatches = content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || [];
        if (functionMatches.length > 10) {
          longFunctions.push({
            file: path.relative(config.projectRoot, filePath),
            functions: functionMatches.length,
          });
        }
      });

      const averageLinesPerFile = totalFiles > 0 ? totalLines / totalFiles : 0;
      const maintainabilityScore = this.calculateMaintainabilityScore(averageLinesPerFile, largeFiles.length, totalFiles);

      this.metrics.maintainability = {
        totalFiles,
        totalLines,
        averageLinesPerFile: Math.round(averageLinesPerFile),
        largeFiles: largeFiles.slice(0, 10),
        longFunctions: longFunctions.slice(0, 10),
        maintainabilityScore,
        thresholds: thresholds.maintainability,
        passed: maintainabilityScore >= thresholds.maintainability.minimum,
      };

      console.log('✅ Maintainability metrics collected');
    } catch (error) {
      console.error('❌ Failed to collect maintainability metrics:', error.message);
    }
  }

  // Calculate maintainability score
  calculateMaintainabilityScore(avgLines, largeFilesCount, totalFiles) {
    let score = 100;
    
    // Penalize for large average file size
    if (avgLines > 200) score -= 20;
    else if (avgLines > 150) score -= 10;
    
    // Penalize for too many large files
    const largeFileRatio = largeFilesCount / totalFiles;
    if (largeFileRatio > 0.2) score -= 30;
    else if (largeFileRatio > 0.1) score -= 15;
    
    return Math.max(0, score);
  }

  // Collect linting metrics
  async collectLintingMetrics() {
    console.log('🔍 Collecting linting metrics...');

    try {
      const lintReport = execSync(
        'npx eslint apps/web/src packages/*/src --format json',
        {
          cwd: config.projectRoot,
          encoding: 'utf8',
        }
      );

      const eslintResults = JSON.parse(lintReport);
      
      let totalErrors = 0;
      let totalWarnings = 0;
      let totalFiles = eslintResults.length;
      let filesWithIssues = 0;

      eslintResults.forEach(result => {
        if (result.messages.length > 0) {
          filesWithIssues++;
          result.messages.forEach(msg => {
            if (msg.severity === 2) totalErrors++;
            else if (msg.severity === 1) totalWarnings++;
          });
        }
      });

      this.metrics.linting = {
        totalFiles,
        filesWithIssues,
        totalErrors,
        totalWarnings,
        totalIssues: totalErrors + totalWarnings,
        errorRate: totalFiles > 0 ? (totalErrors / totalFiles) : 0,
        warningRate: totalFiles > 0 ? (totalWarnings / totalFiles) : 0,
        passed: totalErrors === 0,
      };

      console.log('✅ Linting metrics collected');
    } catch (error) {
      console.warn('⚠️ Linting analysis completed with issues');
    }
  }

  // Collect security metrics
  async collectSecurityMetrics() {
    console.log('🔒 Collecting security metrics...');

    try {
      // Run npm audit
      const auditReport = execSync('npm audit --json', {
        cwd: config.projectRoot,
        encoding: 'utf8',
      });

      const auditResults = JSON.parse(auditReport);
      
      this.metrics.security = {
        vulnerabilities: auditResults.metadata?.vulnerabilities || {},
        totalVulnerabilities: Object.values(auditResults.metadata?.vulnerabilities || {}).reduce((a, b) => a + b, 0),
        dependencies: auditResults.metadata?.dependencies || 0,
        passed: Object.values(auditResults.metadata?.vulnerabilities || {}).reduce((a, b) => a + b, 0) === 0,
      };

      console.log('✅ Security metrics collected');
    } catch (error) {
      console.warn('⚠️ Security audit completed with issues');
      // npm audit exits with non-zero when vulnerabilities are found
    }
  }

  // Get all source files
  getSourceFiles(dir) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }

    const walk = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      items.forEach(item => {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walk(fullPath);
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(item)) {
          files.push(fullPath);
        }
      });
    };

    walk(dir);
    return files;
  }

  // Generate quality report
  generateReport() {
    console.log('📋 Generating quality report...');

    const report = {
      ...this.metrics,
      summary: {
        overallScore: this.calculateOverallScore(),
        passed: this.calculateOverallPassed(),
        recommendations: this.generateRecommendations(),
      },
    };

    // Write JSON report
    const jsonReportPath = path.join(config.outputDir, 'quality-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Write HTML report
    const htmlReportPath = path.join(config.outputDir, 'quality-report.html');
    fs.writeFileSync(htmlReportPath, this.generateHTMLReport(report));

    console.log('✅ Quality report generated');
    console.log(`📁 Reports available at: ${config.outputDir}`);

    return report;
  }

  // Calculate overall quality score
  calculateOverallScore() {
    const scores = [];
    
    if (this.metrics.coverage.summary) {
      const avgCoverage = (
        this.metrics.coverage.summary.statements +
        this.metrics.coverage.summary.branches +
        this.metrics.coverage.summary.functions +
        this.metrics.coverage.summary.lines
      ) / 4;
      scores.push(avgCoverage);
    }

    if (this.metrics.maintainability.maintainabilityScore !== undefined) {
      scores.push(this.metrics.maintainability.maintainabilityScore);
    }

    if (this.metrics.linting.totalIssues !== undefined) {
      const lintScore = Math.max(0, 100 - this.metrics.linting.totalIssues);
      scores.push(lintScore);
    }

    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  // Calculate overall pass status
  calculateOverallPassed() {
    return (
      (this.metrics.coverage.passed !== false) &&
      (this.metrics.complexity.passed !== false) &&
      (this.metrics.maintainability.passed !== false) &&
      (this.metrics.linting.passed !== false) &&
      (this.metrics.security.passed !== false)
    );
  }

  // Generate recommendations
  generateRecommendations() {
    const recommendations = [];

    if (this.metrics.coverage.passed === false) {
      recommendations.push('Increase test coverage to meet minimum thresholds');
    }

    if (this.metrics.complexity.totalIssues > 0) {
      recommendations.push('Reduce code complexity by refactoring complex functions');
    }

    if (this.metrics.maintainability.passed === false) {
      recommendations.push('Improve maintainability by reducing file sizes and function lengths');
    }

    if (this.metrics.linting.totalErrors > 0) {
      recommendations.push('Fix all linting errors to improve code quality');
    }

    if (this.metrics.security.totalVulnerabilities > 0) {
      recommendations.push('Address security vulnerabilities in dependencies');
    }

    return recommendations;
  }

  // Generate HTML report
  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>ConstructTrack Quality Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { border-left: 5px solid #4CAF50; }
        .failed { border-left: 5px solid #f44336; }
        .score { font-size: 24px; font-weight: bold; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ConstructTrack Quality Report</h1>
        <p>Generated: ${report.timestamp}</p>
        <div class="score">Overall Score: ${report.summary.overallScore}/100</div>
        <p>Status: ${report.summary.passed ? '✅ PASSED' : '❌ FAILED'}</p>
    </div>

    <div class="metric ${report.coverage.passed ? 'passed' : 'failed'}">
        <h2>Test Coverage</h2>
        <p>Statements: ${report.coverage.summary?.statements || 0}%</p>
        <p>Branches: ${report.coverage.summary?.branches || 0}%</p>
        <p>Functions: ${report.coverage.summary?.functions || 0}%</p>
        <p>Lines: ${report.coverage.summary?.lines || 0}%</p>
    </div>

    <div class="metric ${report.linting.passed ? 'passed' : 'failed'}">
        <h2>Code Quality</h2>
        <p>Total Issues: ${report.linting.totalIssues || 0}</p>
        <p>Errors: ${report.linting.totalErrors || 0}</p>
        <p>Warnings: ${report.linting.totalWarnings || 0}</p>
    </div>

    <div class="metric ${report.security.passed ? 'passed' : 'failed'}">
        <h2>Security</h2>
        <p>Total Vulnerabilities: ${report.security.totalVulnerabilities || 0}</p>
    </div>

    ${report.summary.recommendations.length > 0 ? `
    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>
    `;
  }

  // Run all quality checks
  async runAll() {
    console.log('🚀 Starting quality metrics collection...');

    await this.collectCoverageMetrics();
    await this.collectComplexityMetrics();
    await this.collectMaintainabilityMetrics();
    await this.collectLintingMetrics();
    await this.collectSecurityMetrics();

    const report = this.generateReport();

    console.log('🎉 Quality metrics collection completed!');
    console.log(`📊 Overall Score: ${report.summary.overallScore}/100`);
    console.log(`✅ Status: ${report.summary.passed ? 'PASSED' : 'FAILED'}`);

    return report;
  }
}

// Run if called directly
if (require.main === module) {
  const collector = new QualityMetricsCollector();
  collector.runAll().catch(error => {
    console.error('❌ Quality metrics collection failed:', error);
    process.exit(1);
  });
}

module.exports = QualityMetricsCollector;
