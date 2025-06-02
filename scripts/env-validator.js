#!/usr/bin/env node

/**
 * Environment Variable Validator for ConstructTrack
 * Validates that all required environment variables are set and properly formatted
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Environment variable definitions
const ENV_DEFINITIONS = {
  // Core environment
  NODE_ENV: { required: true, type: 'string', values: ['development', 'staging', 'production'] },
  PORT: { required: false, type: 'number', default: 3000 },

  // Supabase (required)
  SUPABASE_URL: { required: true, type: 'url', pattern: /^https:\/\/.*\.supabase\.co$/ },
  SUPABASE_ANON_KEY: { required: true, type: 'string', minLength: 100 },
  SUPABASE_SERVICE_ROLE_KEY: { required: true, type: 'string', minLength: 100 },
  NEXT_PUBLIC_SUPABASE_URL: { required: true, type: 'url', pattern: /^https:\/\/.*\.supabase\.co$/ },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: { required: true, type: 'string', minLength: 100 },
  EXPO_PUBLIC_SUPABASE_URL: { required: true, type: 'url', pattern: /^https:\/\/.*\.supabase\.co$/ },
  EXPO_PUBLIC_SUPABASE_ANON_KEY: { required: true, type: 'string', minLength: 100 },

  // MapBox (required)
  MAPBOX_ACCESS_TOKEN: { required: true, type: 'string', pattern: /^pk\./ },
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: { required: true, type: 'string', pattern: /^pk\./ },
  EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: { required: true, type: 'string', pattern: /^pk\./ },

  // Notion (required for sync features)
  NOTION_TOKEN: { required: true, type: 'string', pattern: /^secret_/ },
  NOTION_DATABASE_ID: { required: true, type: 'string', minLength: 32 },
  NOTION_WEBHOOK_SECRET: { required: true, type: 'string', minLength: 10 },

  // Security
  JWT_SECRET: { required: true, type: 'string', minLength: 32 },
  ENCRYPTION_KEY: { required: true, type: 'string', length: 32 },

  // Optional services
  SMTP_HOST: { required: false, type: 'string' },
  SMTP_PORT: { required: false, type: 'number' },
  TWILIO_ACCOUNT_SID: { required: false, type: 'string' },
  AWS_ACCESS_KEY_ID: { required: false, type: 'string' },
};

class EnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.env = process.env;
  }

  loadEnvFile(envFile) {
    const envPath = join(rootDir, envFile);
    if (!existsSync(envPath)) {
      this.errors.push(`Environment file ${envFile} not found`);
      return;
    }

    try {
      const content = readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#') && line.includes('=')) {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('=');
          this.env[key] = value;
        }
      });
    } catch (error) {
      this.errors.push(`Failed to read ${envFile}: ${error.message}`);
    }
  }

  validateVariable(name, definition) {
    const value = this.env[name];

    // Check if required variable is missing
    if (definition.required && (!value || value.trim() === '')) {
      this.errors.push(`Required environment variable ${name} is missing or empty`);
      return;
    }

    // Skip validation if optional and not set
    if (!definition.required && (!value || value.trim() === '')) {
      return;
    }

    // Type validation
    switch (definition.type) {
      case 'number':
        if (isNaN(Number(value))) {
          this.errors.push(`${name} must be a number, got: ${value}`);
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          this.errors.push(`${name} must be a valid URL, got: ${value}`);
        }
        break;

      case 'string':
        // String validation is handled by other checks
        break;
    }

    // Pattern validation
    if (definition.pattern && !definition.pattern.test(value)) {
      this.errors.push(`${name} does not match required pattern`);
    }

    // Length validation
    if (definition.length && value.length !== definition.length) {
      this.errors.push(`${name} must be exactly ${definition.length} characters long`);
    }

    if (definition.minLength && value.length < definition.minLength) {
      this.errors.push(`${name} must be at least ${definition.minLength} characters long`);
    }

    // Value validation
    if (definition.values && !definition.values.includes(value)) {
      this.errors.push(`${name} must be one of: ${definition.values.join(', ')}`);
    }

    // Security warnings
    if (name.includes('SECRET') || name.includes('KEY') || name.includes('TOKEN')) {
      if (value.includes('your_') || value.includes('example') || value.includes('placeholder')) {
        this.warnings.push(`${name} appears to contain placeholder text`);
      }
    }
  }

  validate() {
    console.log(chalk.blue('🔍 Validating ConstructTrack environment variables...\n'));

    // Validate all defined variables
    Object.entries(ENV_DEFINITIONS).forEach(([name, definition]) => {
      this.validateVariable(name, definition);
    });

    // Check for consistency between related variables
    this.validateConsistency();

    // Report results
    this.reportResults();

    return this.errors.length === 0;
  }

  validateConsistency() {
    // Check Supabase URL consistency
    const supabaseUrl = this.env.SUPABASE_URL;
    const nextPublicUrl = this.env.NEXT_PUBLIC_SUPABASE_URL;
    const expoPublicUrl = this.env.EXPO_PUBLIC_SUPABASE_URL;

    if (supabaseUrl && nextPublicUrl && supabaseUrl !== nextPublicUrl) {
      this.warnings.push('SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL should match');
    }

    if (supabaseUrl && expoPublicUrl && supabaseUrl !== expoPublicUrl) {
      this.warnings.push('SUPABASE_URL and EXPO_PUBLIC_SUPABASE_URL should match');
    }

    // Check MapBox token consistency
    const mapboxToken = this.env.MAPBOX_ACCESS_TOKEN;
    const nextMapbox = this.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const expoMapbox = this.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (mapboxToken && nextMapbox && mapboxToken !== nextMapbox) {
      this.warnings.push('MAPBOX_ACCESS_TOKEN and NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN should match');
    }

    if (mapboxToken && expoMapbox && mapboxToken !== expoMapbox) {
      this.warnings.push('MAPBOX_ACCESS_TOKEN and EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN should match');
    }
  }

  reportResults() {
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(chalk.green('✅ All environment variables are valid!\n'));
      return;
    }

    if (this.errors.length > 0) {
      console.log(chalk.red('❌ Environment validation errors:\n'));
      this.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
      console.log();
    }

    if (this.warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Environment validation warnings:\n'));
      this.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
      console.log();
    }

    if (this.errors.length > 0) {
      console.log(chalk.red('Please fix the errors above before continuing.\n'));
      process.exit(1);
    }
  }
}

// Main execution
function main() {
  const validator = new EnvValidator();
  
  // Load environment file based on NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFile = `.env.${nodeEnv}`;
  
  // Try to load specific environment file first, then fallback to .env
  if (existsSync(join(rootDir, envFile))) {
    validator.loadEnvFile(envFile);
  } else {
    validator.loadEnvFile('.env');
  }

  const isValid = validator.validate();
  
  if (isValid) {
    console.log(chalk.green('🎉 Environment configuration is ready!'));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default EnvValidator;
