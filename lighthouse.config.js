/**
 * Lighthouse CI Configuration for ConstructTrack
 * Performance monitoring and testing configuration
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test - using production deployment URL
      url: [
        'https://constructtrack.vercel.app',
        'https://constructtrack.vercel.app/dashboard',
        'https://constructtrack.vercel.app/projects',
        'https://constructtrack.vercel.app/login',
      ],
      // Number of runs per URL for more reliable results
      numberOfRuns: 3,
      // Chrome settings for CI environment
      settings: {
        chromeFlags: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--headless',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
        ],
        // Disable certain audits that might be flaky in CI
        skipAudits: [
          'uses-http2',
          'uses-long-cache-ttl',
          'uses-optimized-images',
        ],
      },
    },
    assert: {
      assertions: {
        // Performance thresholds
        'categories:performance': ['warn', { minScore: 0.75 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Specific metric thresholds
        'first-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 500 }],

        // Accessibility requirements
        'color-contrast': 'error',
        'image-alt': 'error',
        label: 'error',
        'valid-lang': 'error',
      },
    },
    upload: {
      // Use temporary public storage for CI
      target: 'temporary-public-storage',
    },
    server: {
      // Server configuration for local testing
      port: 9001,
      storage: './lighthouse-results',
    },
  },
};
