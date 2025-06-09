#!/usr/bin/env node

/**
 * JWT Configuration Validation Script
 *
 * This script validates JWT configuration and tests token creation/verification
 * to help diagnose issues in CI/CD environments.
 *
 * Usage:
 *   node scripts/validate-jwt-config.js
 *
 * Environment Variables:
 *   JWT_SECRET - Required JWT secret key
 *   NODE_ENV - Environment name (optional)
 */

/* eslint-env node */

const jwt = require('jsonwebtoken');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function validateEnvironmentVariables() {
  logInfo('Validating environment variables...');

  const jwtSecret = process.env.JWT_SECRET;
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!jwtSecret) {
    logError('JWT_SECRET environment variable is not set');
    return false;
  }

  if (jwtSecret.length < 32) {
    logWarning(
      `JWT_SECRET is only ${jwtSecret.length} characters long. Recommended minimum is 32 characters.`
    );
  } else {
    logSuccess(
      `JWT_SECRET is properly configured (${jwtSecret.length} characters)`
    );
  }

  logInfo(`NODE_ENV: ${nodeEnv}`);

  return true;
}

function testTokenCreationAndVerification() {
  logInfo('Testing JWT token creation and verification...');

  const jwtSecret = process.env.JWT_SECRET;
  const currentTime = Math.floor(Date.now() / 1000);

  // Test payload
  const payload = {
    sub: 'test-user-123',
    roles: ['field_worker'],
    projects: ['test-project'],
    email: 'test@example.com',
    exp: currentTime + 3600, // 1 hour from now
    iss: 'constructtrack',
    aud: 'ws-gateway',
  };

  try {
    // Create token
    const token = jwt.sign(payload, jwtSecret, {
      algorithm: 'HS256',
    });

    logSuccess('JWT token created successfully');
    logInfo(`Token preview: ${token.substring(0, 50)}...`);

    // Verify token
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'constructtrack',
      audience: 'ws-gateway',
      clockTolerance: 60,
    });

    logSuccess('JWT token verified successfully');
    logInfo(`Decoded subject: ${decoded.sub}`);
    logInfo(`Token expires at: ${new Date(decoded.exp * 1000).toISOString()}`);
    logInfo(`Time to expiry: ${decoded.exp - currentTime} seconds`);

    return true;
  } catch (error) {
    logError(`JWT test failed: ${error.message}`);

    if (error instanceof jwt.JsonWebTokenError) {
      logError('This is a JWT-specific error. Check token format and secret.');
    } else if (error instanceof jwt.TokenExpiredError) {
      logError('Token expired. Check system time and expiration settings.');
    } else if (error instanceof jwt.NotBeforeError) {
      logError('Token not active yet. Check system time and nbf claim.');
    }

    return false;
  }
}

function testClockSkew() {
  logInfo('Testing clock skew tolerance...');

  const jwtSecret = process.env.JWT_SECRET;
  const currentTime = Math.floor(Date.now() / 1000);

  // Create a token that's slightly expired but within tolerance
  const payload = {
    sub: 'clock-skew-test',
    exp: currentTime - 30, // 30 seconds ago (within 60s tolerance)
    iss: 'constructtrack',
    aud: 'ws-gateway',
  };

  try {
    const token = jwt.sign(payload, jwtSecret, {
      algorithm: 'HS256',
    });

    jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'constructtrack',
      audience: 'ws-gateway',
      clockTolerance: 60,
    });

    logSuccess('Clock skew tolerance is working correctly');
    return true;
  } catch (error) {
    logWarning(`Clock skew test failed: ${error.message}`);
    logInfo(
      'This may indicate clock synchronization issues in your environment'
    );
    return false;
  }
}

function testMalformedTokens() {
  logInfo('Testing malformed token handling...');

  const jwtSecret = process.env.JWT_SECRET;
  const malformedTokens = [
    '',
    'not.a.jwt',
    'malformed',
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.malformed',
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.invalid_signature',
  ];

  let allTestsPassed = true;

  malformedTokens.forEach((token, index) => {
    try {
      jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'constructtrack',
        audience: 'ws-gateway',
      });

      logError(`Malformed token test ${index + 1} unexpectedly passed`);
      allTestsPassed = false;
    } catch {
      // Expected to fail
    }
  });

  if (allTestsPassed) {
    logSuccess('Malformed token handling is working correctly');
  }

  return allTestsPassed;
}

function displaySystemInfo() {
  logInfo('System Information:');
  console.log(`  Node.js version: ${process.version}`);
  console.log(`  Platform: ${process.platform}`);
  console.log(`  Architecture: ${process.arch}`);
  console.log(`  Current time: ${new Date().toISOString()}`);
  console.log(
    `  Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  );
  console.log(`  Unix timestamp: ${Math.floor(Date.now() / 1000)}`);
}

function main() {
  log(`${colors.bold}JWT Configuration Validation${colors.reset}`);
  log('=====================================');

  displaySystemInfo();
  console.log();

  let allTestsPassed = true;

  // Run validation tests
  allTestsPassed &= validateEnvironmentVariables();
  console.log();

  if (process.env.JWT_SECRET) {
    allTestsPassed &= testTokenCreationAndVerification();
    console.log();

    allTestsPassed &= testClockSkew();
    console.log();

    allTestsPassed &= testMalformedTokens();
    console.log();
  }

  // Summary
  log('=====================================');
  if (allTestsPassed) {
    logSuccess('All JWT configuration tests passed!');
    process.exit(0);
  } else {
    logError(
      'Some JWT configuration tests failed. Please review the output above.'
    );
    process.exit(1);
  }
}

// Run the validation
main();
