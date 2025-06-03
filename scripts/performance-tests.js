#!/usr/bin/env node

/**
 * Performance Testing Script
 * Runs performance tests and benchmarks for ConstructTrack
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  outputDir: path.join(__dirname, '../reports/performance'),
  lighthouseConfig: path.join(__dirname, '../lighthouse.config.js'),
  testUrls: [
    'http://localhost:3000',
    'http://localhost:3000/dashboard',
    'http://localhost:3000/projects',
    'http://localhost:3000/map',
  ],
  budgets: {
    loadTime: 3000, // 3 seconds
    firstContentfulPaint: 1500, // 1.5 seconds
    largestContentfulPaint: 2500, // 2.5 seconds
    cumulativeLayoutShift: 0.1,
    firstInputDelay: 100, // 100ms
  },
};

class PerformanceTester {
  constructor() {
    this.ensureDirectories();
    this.results = {
      timestamp: new Date().toISOString(),
      lighthouse: {},
      bundleSize: {},
      loadTesting: {},
      summary: {},
    };
  }

  ensureDirectories() {
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
  }

  // Run Lighthouse performance audit
  async runLighthouseAudit() {
    console.log('🔍 Running Lighthouse performance audit...');

    try {
      for (const url of config.testUrls) {
        console.log(`📊 Testing: ${url}`);
        
        const reportPath = path.join(config.outputDir, `lighthouse-${url.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        
        // Run Lighthouse
        execSync(`npx lighthouse ${url} --output=json --output-path=${reportPath} --chrome-flags="--headless" --quiet`, {
          stdio: 'inherit',
        });

        // Parse results
        if (fs.existsSync(reportPath)) {
          const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          
          this.results.lighthouse[url] = {
            performance: report.categories.performance.score * 100,
            accessibility: report.categories.accessibility.score * 100,
            bestPractices: report.categories['best-practices'].score * 100,
            seo: report.categories.seo.score * 100,
            metrics: {
              firstContentfulPaint: report.audits['first-contentful-paint'].numericValue,
              largestContentfulPaint: report.audits['largest-contentful-paint'].numericValue,
              firstInputDelay: report.audits['max-potential-fid'].numericValue,
              cumulativeLayoutShift: report.audits['cumulative-layout-shift'].numericValue,
              speedIndex: report.audits['speed-index'].numericValue,
              totalBlockingTime: report.audits['total-blocking-time'].numericValue,
            },
            passed: this.checkPerformanceBudget(report.audits),
          };
        }
      }

      console.log('✅ Lighthouse audit completed');
    } catch (error) {
      console.error('❌ Lighthouse audit failed:', error.message);
    }
  }

  // Check performance budget
  checkPerformanceBudget(audits) {
    const metrics = {
      firstContentfulPaint: audits['first-contentful-paint'].numericValue,
      largestContentfulPaint: audits['largest-contentful-paint'].numericValue,
      firstInputDelay: audits['max-potential-fid'].numericValue,
      cumulativeLayoutShift: audits['cumulative-layout-shift'].numericValue,
    };

    return (
      metrics.firstContentfulPaint <= config.budgets.firstContentfulPaint &&
      metrics.largestContentfulPaint <= config.budgets.largestContentfulPaint &&
      metrics.firstInputDelay <= config.budgets.firstInputDelay &&
      metrics.cumulativeLayoutShift <= config.budgets.cumulativeLayoutShift
    );
  }

  // Analyze bundle size
  async analyzeBundleSize() {
    console.log('📦 Analyzing bundle size...');

    try {
      // Build the application
      execSync('npm run build', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
      });

      // Analyze bundle
      const buildDir = path.join(__dirname, '../apps/web/.next');
      const staticDir = path.join(buildDir, 'static');

      if (fs.existsSync(staticDir)) {
        const bundleStats = this.getBundleStats(staticDir);
        
        this.results.bundleSize = {
          ...bundleStats,
          budgets: {
            totalSize: 2 * 1024 * 1024, // 2MB
            jsSize: 1 * 1024 * 1024, // 1MB
            cssSize: 200 * 1024, // 200KB
          },
          passed: bundleStats.totalSize <= 2 * 1024 * 1024,
        };
      }

      console.log('✅ Bundle analysis completed');
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error.message);
    }
  }

  // Get bundle statistics
  getBundleStats(staticDir) {
    const stats = {
      totalSize: 0,
      jsSize: 0,
      cssSize: 0,
      files: [],
    };

    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else {
          const size = stat.size;
          stats.totalSize += size;
          
          if (file.endsWith('.js')) {
            stats.jsSize += size;
          } else if (file.endsWith('.css')) {
            stats.cssSize += size;
          }
          
          stats.files.push({
            name: path.relative(staticDir, filePath),
            size,
            sizeFormatted: this.formatBytes(size),
          });
        }
      });
    };

    walkDir(staticDir);
    
    // Sort files by size
    stats.files.sort((a, b) => b.size - a.size);
    stats.files = stats.files.slice(0, 20); // Top 20 largest files
    
    stats.totalSizeFormatted = this.formatBytes(stats.totalSize);
    stats.jsSizeFormatted = this.formatBytes(stats.jsSize);
    stats.cssSizeFormatted = this.formatBytes(stats.cssSize);
    
    return stats;
  }

  // Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Run load testing
  async runLoadTesting() {
    console.log('⚡ Running load testing...');

    try {
      // Simple load test using curl
      const testResults = [];
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        try {
          execSync('curl -s -o /dev/null -w "%{time_total}" http://localhost:3000', {
            encoding: 'utf8',
            timeout: 10000,
          });
          
          const responseTime = Date.now() - start;
          testResults.push(responseTime);
        } catch (error) {
          console.warn(`Load test iteration ${i + 1} failed`);
        }
      }

      if (testResults.length > 0) {
        const avgResponseTime = testResults.reduce((a, b) => a + b, 0) / testResults.length;
        const minResponseTime = Math.min(...testResults);
        const maxResponseTime = Math.max(...testResults);
        
        this.results.loadTesting = {
          iterations: testResults.length,
          averageResponseTime: Math.round(avgResponseTime),
          minResponseTime,
          maxResponseTime,
          budget: config.budgets.loadTime,
          passed: avgResponseTime <= config.budgets.loadTime,
        };
      }

      console.log('✅ Load testing completed');
    } catch (error) {
      console.error('❌ Load testing failed:', error.message);
    }
  }

  // Generate performance report
  generateReport() {
    console.log('📋 Generating performance report...');

    // Calculate summary
    this.results.summary = this.calculateSummary();

    // Write JSON report
    const jsonReportPath = path.join(config.outputDir, 'performance-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(this.results, null, 2));

    // Write HTML report
    const htmlReportPath = path.join(config.outputDir, 'performance-report.html');
    fs.writeFileSync(htmlReportPath, this.generateHTMLReport());

    console.log('✅ Performance report generated');
    console.log(`📁 Reports available at: ${config.outputDir}`);

    return this.results;
  }

  // Calculate summary
  calculateSummary() {
    const lighthouseScores = Object.values(this.results.lighthouse);
    const avgPerformanceScore = lighthouseScores.length > 0 
      ? lighthouseScores.reduce((sum, result) => sum + result.performance, 0) / lighthouseScores.length
      : 0;

    const allPassed = [
      ...lighthouseScores.map(result => result.passed),
      this.results.bundleSize.passed,
      this.results.loadTesting.passed,
    ].every(Boolean);

    return {
      overallScore: Math.round(avgPerformanceScore),
      passed: allPassed,
      recommendations: this.generateRecommendations(),
    };
  }

  // Generate recommendations
  generateRecommendations() {
    const recommendations = [];

    // Lighthouse recommendations
    Object.entries(this.results.lighthouse).forEach(([url, result]) => {
      if (result.performance < 90) {
        recommendations.push(`Improve performance score for ${url} (currently ${result.performance}%)`);
      }
      
      if (!result.passed) {
        recommendations.push(`Address performance budget violations for ${url}`);
      }
    });

    // Bundle size recommendations
    if (this.results.bundleSize.totalSize > this.results.bundleSize.budgets.totalSize) {
      recommendations.push('Reduce bundle size by code splitting and tree shaking');
    }

    // Load testing recommendations
    if (this.results.loadTesting && !this.results.loadTesting.passed) {
      recommendations.push('Optimize server response time and implement caching');
    }

    return recommendations;
  }

  // Generate HTML report
  generateHTMLReport() {
    const lighthouseResults = Object.entries(this.results.lighthouse)
      .map(([url, result]) => `
        <div class="metric">
          <h3>${url}</h3>
          <p>Performance: ${result.performance}%</p>
          <p>FCP: ${Math.round(result.metrics.firstContentfulPaint)}ms</p>
          <p>LCP: ${Math.round(result.metrics.largestContentfulPaint)}ms</p>
          <p>CLS: ${result.metrics.cumulativeLayoutShift.toFixed(3)}</p>
        </div>
      `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <title>ConstructTrack Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { border-left: 5px solid #4CAF50; }
        .failed { border-left: 5px solid #f44336; }
        .score { font-size: 24px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ConstructTrack Performance Report</h1>
        <p>Generated: ${this.results.timestamp}</p>
        <div class="score">Overall Score: ${this.results.summary.overallScore}/100</div>
        <p>Status: ${this.results.summary.passed ? '✅ PASSED' : '❌ FAILED'}</p>
    </div>

    <h2>Lighthouse Results</h2>
    ${lighthouseResults}

    <div class="metric">
        <h2>Bundle Size</h2>
        <p>Total: ${this.results.bundleSize.totalSizeFormatted || 'N/A'}</p>
        <p>JavaScript: ${this.results.bundleSize.jsSizeFormatted || 'N/A'}</p>
        <p>CSS: ${this.results.bundleSize.cssSizeFormatted || 'N/A'}</p>
    </div>

    ${this.results.loadTesting ? `
    <div class="metric">
        <h2>Load Testing</h2>
        <p>Average Response Time: ${this.results.loadTesting.averageResponseTime}ms</p>
        <p>Min: ${this.results.loadTesting.minResponseTime}ms</p>
        <p>Max: ${this.results.loadTesting.maxResponseTime}ms</p>
    </div>
    ` : ''}

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

  // Run all performance tests
  async runAll() {
    console.log('🚀 Starting performance testing...');

    await this.runLighthouseAudit();
    await this.analyzeBundleSize();
    await this.runLoadTesting();

    const report = this.generateReport();

    console.log('🎉 Performance testing completed!');
    console.log(`📊 Overall Score: ${report.summary.overallScore}/100`);
    console.log(`✅ Status: ${report.summary.passed ? 'PASSED' : 'FAILED'}`);

    return report;
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runAll().catch(error => {
    console.error('❌ Performance testing failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceTester;
