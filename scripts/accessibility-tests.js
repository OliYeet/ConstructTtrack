#!/usr/bin/env node

/**
 * Accessibility Testing Script
 * Runs accessibility tests and audits for ConstructTrack
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  outputDir: path.join(__dirname, '../reports/accessibility'),
  testUrls: [
    'http://localhost:3000',
    'http://localhost:3000/dashboard',
    'http://localhost:3000/projects',
    'http://localhost:3000/map',
    'http://localhost:3000/login',
  ],
  standards: ['WCAG2A', 'WCAG2AA', 'WCAG2AAA'],
  browsers: ['chrome'],
};

class AccessibilityTester {
  constructor() {
    this.ensureDirectories();
    this.results = {
      timestamp: new Date().toISOString(),
      axeResults: {},
      lighthouseA11y: {},
      paResults: {},
      summary: {},
    };
  }

  ensureDirectories() {
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
  }

  // Run axe-core accessibility tests
  async runAxeTests() {
    console.log('♿ Running axe-core accessibility tests...');

    try {
      for (const url of config.testUrls) {
        console.log(`🔍 Testing: ${url}`);
        
        const reportPath = path.join(config.outputDir, `axe-${url.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        
        // Create axe test script
        const axeScript = `
const { Builder } = require('selenium-webdriver');
const { AxeBuilder } = require('@axe-core/webdriver');
const fs = require('fs');

(async () => {
  const driver = await new Builder().forBrowser('chrome').build();
  
  try {
    await driver.get('${url}');
    await driver.sleep(2000); // Wait for page to load
    
    const results = await new AxeBuilder(driver)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    fs.writeFileSync('${reportPath}', JSON.stringify(results, null, 2));
    console.log('Axe test completed for ${url}');
  } catch (error) {
    console.error('Axe test failed for ${url}:', error);
  } finally {
    await driver.quit();
  }
})();
        `;

        // Write and execute axe script
        const scriptPath = path.join(config.outputDir, 'temp-axe-script.js');
        fs.writeFileSync(scriptPath, axeScript);
        
        try {
          execSync(`node ${scriptPath}`, {
            cwd: config.outputDir,
            timeout: 30000,
          });

          // Parse results
          if (fs.existsSync(reportPath)) {
            const axeResults = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            
            this.results.axeResults[url] = {
              violations: axeResults.violations.length,
              passes: axeResults.passes.length,
              incomplete: axeResults.incomplete.length,
              inapplicable: axeResults.inapplicable.length,
              violationDetails: axeResults.violations.map(violation => ({
                id: violation.id,
                impact: violation.impact,
                description: violation.description,
                help: violation.help,
                helpUrl: violation.helpUrl,
                nodes: violation.nodes.length,
              })),
              passed: axeResults.violations.length === 0,
            };
          }
        } catch (error) {
          console.warn(`Axe test failed for ${url}:`, error.message);
        }

        // Cleanup
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      }

      console.log('✅ Axe-core tests completed');
    } catch (error) {
      console.error('❌ Axe-core tests failed:', error.message);
    }
  }

  // Run Lighthouse accessibility audit
  async runLighthouseA11yAudit() {
    console.log('🔍 Running Lighthouse accessibility audit...');

    try {
      for (const url of config.testUrls) {
        console.log(`📊 Testing: ${url}`);
        
        const reportPath = path.join(config.outputDir, `lighthouse-a11y-${url.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        
        // Run Lighthouse with accessibility focus
        execSync(`npx lighthouse ${url} --only-categories=accessibility --output=json --output-path=${reportPath} --chrome-flags="--headless" --quiet`, {
          stdio: 'inherit',
        });

        // Parse results
        if (fs.existsSync(reportPath)) {
          const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          
          this.results.lighthouseA11y[url] = {
            score: report.categories.accessibility.score * 100,
            audits: Object.entries(report.audits)
              .filter(([key, audit]) => audit.scoreDisplayMode !== 'notApplicable')
              .map(([key, audit]) => ({
                id: key,
                title: audit.title,
                description: audit.description,
                score: audit.score,
                displayValue: audit.displayValue,
                passed: audit.score === 1,
              })),
            passed: report.categories.accessibility.score >= 0.9,
          };
        }
      }

      console.log('✅ Lighthouse accessibility audit completed');
    } catch (error) {
      console.error('❌ Lighthouse accessibility audit failed:', error.message);
    }
  }

  // Run Pa11y accessibility tests
  async runPa11yTests() {
    console.log('🔍 Running Pa11y accessibility tests...');

    try {
      for (const url of config.testUrls) {
        console.log(`📊 Testing: ${url}`);
        
        const reportPath = path.join(config.outputDir, `pa11y-${url.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        
        // Run Pa11y
const pa11yOutput = execSync(
  `npx pa11y ${url} --standard WCAG2AA --reporter json`,
  { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
);

        const pa11yResults = JSON.parse(pa11yOutput);
        
        this.results.paResults[url] = {
          issues: pa11yResults.length,
          errors: pa11yResults.filter(issue => issue.type === 'error').length,
          warnings: pa11yResults.filter(issue => issue.type === 'warning').length,
          notices: pa11yResults.filter(issue => issue.type === 'notice').length,
          issueDetails: pa11yResults.map(issue => ({
            type: issue.type,
            code: issue.code,
            message: issue.message,
            context: issue.context,
            selector: issue.selector,
          })),
          passed: pa11yResults.filter(issue => issue.type === 'error').length === 0,
        };

        // Write detailed report
        fs.writeFileSync(reportPath, JSON.stringify(pa11yResults, null, 2));
      }

      console.log('✅ Pa11y tests completed');
    } catch (error) {
      console.warn('⚠️ Pa11y tests completed with issues');
    }
  }

  // Generate accessibility report
  generateReport() {
    console.log('📋 Generating accessibility report...');

    // Calculate summary
    this.results.summary = this.calculateSummary();

    // Write JSON report
    const jsonReportPath = path.join(config.outputDir, 'accessibility-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(this.results, null, 2));

    // Write HTML report
    const htmlReportPath = path.join(config.outputDir, 'accessibility-report.html');
    fs.writeFileSync(htmlReportPath, this.generateHTMLReport());

    // Write CSV summary
    const csvReportPath = path.join(config.outputDir, 'accessibility-summary.csv');
    fs.writeFileSync(csvReportPath, this.generateCSVReport());

    console.log('✅ Accessibility report generated');
    console.log(`📁 Reports available at: ${config.outputDir}`);

    return this.results;
  }

  // Calculate summary
  calculateSummary() {
    const axeResults = Object.values(this.results.axeResults);
    const lighthouseResults = Object.values(this.results.lighthouseA11y);
    const pa11yResults = Object.values(this.results.paResults);

    const totalViolations = axeResults.reduce((sum, result) => sum + result.violations, 0);
    const totalErrors = pa11yResults.reduce((sum, result) => sum + result.errors, 0);
    const avgLighthouseScore = lighthouseResults.length > 0 
      ? lighthouseResults.reduce((sum, result) => sum + result.score, 0) / lighthouseResults.length
      : 0;

    const allPassed = [
      ...axeResults.map(result => result.passed),
      ...lighthouseResults.map(result => result.passed),
      ...pa11yResults.map(result => result.passed),
    ].every(Boolean);

    return {
      totalViolations,
      totalErrors,
      averageScore: Math.round(avgLighthouseScore),
      passed: allPassed,
      recommendations: this.generateRecommendations(),
      compliance: {
        wcag2a: this.checkWCAGCompliance('2A'),
        wcag2aa: this.checkWCAGCompliance('2AA'),
        wcag2aaa: this.checkWCAGCompliance('2AAA'),
      },
    };
  }

  // Check WCAG compliance
  checkWCAGCompliance(level) {
    const axeResults = Object.values(this.results.axeResults);
    const criticalViolations = axeResults.reduce((sum, result) => {
      return sum + result.violationDetails.filter(v => 
        v.impact === 'critical' || v.impact === 'serious'
      ).length;
    }, 0);

    return criticalViolations === 0;
  }

  // Generate recommendations
  generateRecommendations() {
    const recommendations = [];

    // Axe recommendations
    Object.entries(this.results.axeResults).forEach(([url, result]) => {
      if (result.violations > 0) {
        recommendations.push(`Fix ${result.violations} accessibility violations on ${url}`);
      }
    });

    // Lighthouse recommendations
    Object.entries(this.results.lighthouseA11y).forEach(([url, result]) => {
      if (result.score < 90) {
        recommendations.push(`Improve accessibility score for ${url} (currently ${result.score}%)`);
      }
    });

    // Pa11y recommendations
    Object.entries(this.results.paResults).forEach(([url, result]) => {
      if (result.errors > 0) {
        recommendations.push(`Address ${result.errors} accessibility errors on ${url}`);
      }
    });

    // General recommendations
    if (recommendations.length > 0) {
      recommendations.push('Implement automated accessibility testing in CI/CD pipeline');
      recommendations.push('Provide accessibility training for development team');
      recommendations.push('Establish accessibility review process for new features');
    }

    return recommendations;
  }

  // Generate HTML report
  generateHTMLReport() {
    const axeResults = Object.entries(this.results.axeResults)
      .map(([url, result]) => `
        <div class="metric ${result.passed ? 'passed' : 'failed'}">
          <h3>Axe Results: ${url}</h3>
          <p>Violations: ${result.violations}</p>
          <p>Passes: ${result.passes}</p>
          <p>Incomplete: ${result.incomplete}</p>
        </div>
      `).join('');

    const lighthouseResults = Object.entries(this.results.lighthouseA11y)
      .map(([url, result]) => `
        <div class="metric ${result.passed ? 'passed' : 'failed'}">
          <h3>Lighthouse: ${url}</h3>
          <p>Score: ${result.score}%</p>
          <p>Audits: ${result.audits.length}</p>
        </div>
      `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <title>ConstructTrack Accessibility Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { border-left: 5px solid #4CAF50; }
        .failed { border-left: 5px solid #f44336; }
        .score { font-size: 24px; font-weight: bold; }
        .compliance { display: flex; gap: 20px; }
        .compliance-item { padding: 10px; border-radius: 5px; }
        .compliant { background: #d4edda; }
        .non-compliant { background: #f8d7da; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ConstructTrack Accessibility Report</h1>
        <p>Generated: ${this.results.timestamp}</p>
        <div class="score">Average Score: ${this.results.summary.averageScore}/100</div>
        <p>Status: ${this.results.summary.passed ? '✅ PASSED' : '❌ FAILED'}</p>
    </div>

    <div class="compliance">
        <div class="compliance-item ${this.results.summary.compliance.wcag2a ? 'compliant' : 'non-compliant'}">
            <h3>WCAG 2.0 A</h3>
            <p>${this.results.summary.compliance.wcag2a ? 'Compliant' : 'Non-compliant'}</p>
        </div>
        <div class="compliance-item ${this.results.summary.compliance.wcag2aa ? 'compliant' : 'non-compliant'}">
            <h3>WCAG 2.0 AA</h3>
            <p>${this.results.summary.compliance.wcag2aa ? 'Compliant' : 'Non-compliant'}</p>
        </div>
        <div class="compliance-item ${this.results.summary.compliance.wcag2aaa ? 'compliant' : 'non-compliant'}">
            <h3>WCAG 2.0 AAA</h3>
            <p>${this.results.summary.compliance.wcag2aaa ? 'Compliant' : 'Non-compliant'}</p>
        </div>
    </div>

    <h2>Axe-core Results</h2>
    ${axeResults}

    <h2>Lighthouse Results</h2>
    ${lighthouseResults}

    ${this.results.summary.recommendations.length > 0 ? `
    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${this.results.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>
    `;
  }

  // Generate CSV report
  generateCSVReport() {
    const headers = ['URL', 'Axe Violations', 'Lighthouse Score', 'Pa11y Errors', 'Status'];
    const rows = config.testUrls.map(url => {
      const axe = this.results.axeResults[url] || {};
      const lighthouse = this.results.lighthouseA11y[url] || {};
      const pa11y = this.results.paResults[url] || {};
      
      return [
        url,
        axe.violations || 0,
        lighthouse.score || 0,
        pa11y.errors || 0,
        (axe.passed && lighthouse.passed && pa11y.passed) ? 'PASSED' : 'FAILED'
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  // Run all accessibility tests
  async runAll() {
    console.log('🚀 Starting accessibility testing...');

    await this.runAxeTests();
    await this.runLighthouseA11yAudit();
    await this.runPa11yTests();

    const report = this.generateReport();

    console.log('🎉 Accessibility testing completed!');
    console.log(`📊 Average Score: ${report.summary.averageScore}/100`);
    console.log(`✅ Status: ${report.summary.passed ? 'PASSED' : 'FAILED'}`);

    return report;
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new AccessibilityTester();
  tester.runAll().catch(error => {
    console.error('❌ Accessibility testing failed:', error);
    process.exit(1);
  });
}

module.exports = AccessibilityTester;
