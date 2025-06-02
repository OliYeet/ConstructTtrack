#!/usr/bin/env node

/**
 * Environment Setup Script for ConstructTrack
 * Helps developers set up their environment variables interactively
 */

import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

class EnvSetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async question(prompt) {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }

  async setup() {
    console.log(chalk.blue('🚀 ConstructTrack Environment Setup\n'));
    console.log(
      'This script will help you set up your environment variables.\n'
    );

    // Check if .env already exists
    const envPath = join(rootDir, '.env');
    if (existsSync(envPath)) {
      const overwrite = await this.question(
        chalk.yellow(
          '⚠️  .env file already exists. Do you want to overwrite it? (y/N): '
        )
      );
      if (overwrite.toLowerCase() !== 'y') {
        console.log(
          chalk.blue('Setup cancelled. Your existing .env file is unchanged.')
        );
        this.rl.close();
        return;
      }
    }

    console.log(chalk.green("Let's set up your environment variables:\n"));

    const config = {};

    // Environment
    config.NODE_ENV =
      (await this.question(
        'Environment (development/staging/production) [development]: '
      )) || 'development';
    config.PORT = (await this.question('Port [3000]: ')) || '3000';

    console.log(chalk.blue('\n📊 Supabase Configuration'));
    console.log(
      'Get these from: https://supabase.com/dashboard/project/[your-project]/settings/api\n'
    );

    // Supabase URL validation
    let supabaseUrl;
    let supabaseUrlValid = false;
    do {
      supabaseUrl = await this.question('Supabase URL: ');
      if (!supabaseUrl || supabaseUrl.trim() === '') {
        console.log(chalk.red('❌ Supabase URL is required'));
      } else if (!supabaseUrl.match(/^https:\/\/.*\.supabase\.co$/)) {
        console.log(
          chalk.red(
            '❌ Supabase URL must be in format: https://your-project-id.supabase.co'
          )
        );
      } else {
        supabaseUrlValid = true;
      }
    } while (!supabaseUrlValid);
    config.SUPABASE_URL = supabaseUrl;

    // Supabase Anon Key validation
    let supabaseAnonKey;
    let supabaseAnonKeyValid = false;
    do {
      supabaseAnonKey = await this.question('Supabase Anon Key: ');
      if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
        console.log(chalk.red('❌ Supabase Anon Key is required'));
      } else if (supabaseAnonKey.length < 100) {
        console.log(
          chalk.red(
            '❌ Supabase Anon Key appears to be too short (should be 100+ characters)'
          )
        );
      } else {
        supabaseAnonKeyValid = true;
      }
    } while (!supabaseAnonKeyValid);
    config.SUPABASE_ANON_KEY = supabaseAnonKey;

    // Supabase Service Role Key validation
    let supabaseServiceKey;
    let supabaseServiceKeyValid = false;
    do {
      supabaseServiceKey = await this.question('Supabase Service Role Key: ');
      if (!supabaseServiceKey || supabaseServiceKey.trim() === '') {
        console.log(chalk.red('❌ Supabase Service Role Key is required'));
      } else if (supabaseServiceKey.length < 100) {
        console.log(
          chalk.red(
            '❌ Supabase Service Role Key appears to be too short (should be 100+ characters)'
          )
        );
      } else {
        supabaseServiceKeyValid = true;
      }
    } while (!supabaseServiceKeyValid);
    config.SUPABASE_SERVICE_ROLE_KEY = supabaseServiceKey;

    // Set public versions
    config.NEXT_PUBLIC_SUPABASE_URL = config.SUPABASE_URL;
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
    config.EXPO_PUBLIC_SUPABASE_URL = config.SUPABASE_URL;
    config.EXPO_PUBLIC_SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;

    console.log(chalk.blue('\n🗺️  MapBox Configuration'));
    console.log(
      'Get your token from: https://account.mapbox.com/access-tokens/\n'
    );

    const mapboxToken = await this.question('MapBox Access Token: ');
    config.MAPBOX_ACCESS_TOKEN = mapboxToken;
    config.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = mapboxToken;
    config.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = mapboxToken;

    console.log(chalk.blue('\n📝 Notion Configuration'));
    console.log('Get these from: https://www.notion.so/my-integrations\n');

    config.NOTION_TOKEN = await this.question('Notion Token: ');
    config.NOTION_DATABASE_ID = await this.question('Notion Database ID: ');
    config.NOTION_WEBHOOK_SECRET = await this.question(
      'Notion Webhook Secret: '
    );

    console.log(chalk.blue('\n🔐 Security Configuration'));

    // JWT Secret validation
    let jwtSecret;
    let jwtSecretValid = false;
    do {
      jwtSecret = await this.question('JWT Secret (32+ characters): ');
      if (!jwtSecret || jwtSecret.length < 32) {
        console.log(
          chalk.red(
            '❌ JWT Secret must be at least 32 characters long for security'
          )
        );
      } else if (
        jwtSecret.includes('your_') ||
        jwtSecret.includes('example') ||
        jwtSecret.includes('placeholder')
      ) {
        console.log(
          chalk.red(
            '❌ JWT Secret appears to contain placeholder text. Please use a secure random value'
          )
        );
      } else {
        jwtSecretValid = true;
      }
    } while (!jwtSecretValid);
    config.JWT_SECRET = jwtSecret;

    // Encryption Key validation
    let encryptionKey;
    let encryptionKeyValid = false;
    do {
      encryptionKey = await this.question(
        'Encryption Key (exactly 32 characters): '
      );
      if (!encryptionKey || encryptionKey.length !== 32) {
        console.log(
          chalk.red('❌ Encryption Key must be exactly 32 characters long')
        );
      } else if (
        encryptionKey.includes('your_') ||
        encryptionKey.includes('example') ||
        encryptionKey.includes('placeholder')
      ) {
        console.log(
          chalk.red(
            '❌ Encryption Key appears to contain placeholder text. Please use a secure random value'
          )
        );
      } else {
        encryptionKeyValid = true;
      }
    } while (!encryptionKeyValid);
    config.ENCRYPTION_KEY = encryptionKey;

    console.log(chalk.blue('\n🔄 Sync Configuration'));
    config.SYNC_PORT = (await this.question('Sync Port [3001]: ')) || '3001';

    // Optional services
    const setupOptional = await this.question(
      chalk.blue(
        '\nDo you want to set up optional services (email, SMS, cloud storage)? (y/N): '
      )
    );

    if (setupOptional.toLowerCase() === 'y') {
      await this.setupOptionalServices(config);
    }

    // Generate .env file
    await this.generateEnvFile(config);

    console.log(chalk.green('\n✅ Environment setup complete!'));
    console.log(chalk.blue('Next steps:'));
    console.log('1. Review your .env file');
    console.log('2. Run: npm run env:validate');
    console.log('3. Start development: npm run dev\n');

    this.rl.close();
  }

  async setupOptionalServices(config) {
    console.log(chalk.blue('\n📧 Email Service (optional)'));
    const setupEmail = await this.question('Set up email service? (y/N): ');
    if (setupEmail.toLowerCase() === 'y') {
      config.SMTP_HOST = await this.question('SMTP Host: ');
      config.SMTP_PORT = (await this.question('SMTP Port [587]: ')) || '587';
      config.SMTP_USER = await this.question('SMTP User: ');
      config.SMTP_PASS = await this.question('SMTP Password: ');
    }

    console.log(chalk.blue('\n📱 SMS Service (optional)'));
    const setupSMS = await this.question(
      'Set up SMS service (Twilio)? (y/N): '
    );
    if (setupSMS.toLowerCase() === 'y') {
      config.TWILIO_ACCOUNT_SID = await this.question('Twilio Account SID: ');
      config.TWILIO_AUTH_TOKEN = await this.question('Twilio Auth Token: ');
      config.TWILIO_PHONE_NUMBER = await this.question('Twilio Phone Number: ');
    }

    console.log(chalk.blue('\n☁️  Cloud Storage (optional)'));
    const setupStorage = await this.question('Set up AWS S3 storage? (y/N): ');
    if (setupStorage.toLowerCase() === 'y') {
      config.AWS_ACCESS_KEY_ID = await this.question('AWS Access Key ID: ');
      config.AWS_SECRET_ACCESS_KEY = await this.question(
        'AWS Secret Access Key: '
      );
      config.AWS_REGION =
        (await this.question('AWS Region [us-east-1]: ')) || 'us-east-1';
      config.AWS_S3_BUCKET = await this.question('S3 Bucket Name: ');
    }
  }

  async generateEnvFile(config) {
    const envContent = this.buildEnvContent(config);
    const envPath = join(rootDir, '.env');

    try {
      writeFileSync(envPath, envContent, 'utf8');
      console.log(chalk.green(`\n✅ .env file created successfully!`));
    } catch (error) {
      console.error(
        chalk.red(`\n❌ Failed to create .env file: ${error.message}`)
      );
    }
  }

  buildEnvContent(config) {
    const lines = [
      '# ConstructTrack Environment Configuration',
      '# Generated by env-setup script',
      '',
      '# =============================================================================',
      '# ENVIRONMENT CONFIGURATION',
      '# =============================================================================',
      `NODE_ENV=${config.NODE_ENV}`,
      `PORT=${config.PORT}`,
      '',
      '# =============================================================================',
      '# SUPABASE CONFIGURATION',
      '# =============================================================================',
      `SUPABASE_URL=${config.SUPABASE_URL}`,
      `SUPABASE_ANON_KEY=${config.SUPABASE_ANON_KEY}`,
      `SUPABASE_SERVICE_ROLE_KEY=${config.SUPABASE_SERVICE_ROLE_KEY}`,
      `NEXT_PUBLIC_SUPABASE_URL=${config.NEXT_PUBLIC_SUPABASE_URL}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${config.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      `EXPO_PUBLIC_SUPABASE_URL=${config.EXPO_PUBLIC_SUPABASE_URL}`,
      `EXPO_PUBLIC_SUPABASE_ANON_KEY=${config.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      '',
      '# =============================================================================',
      '# MAPBOX CONFIGURATION',
      '# =============================================================================',
      `MAPBOX_ACCESS_TOKEN=${config.MAPBOX_ACCESS_TOKEN}`,
      `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=${config.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`,
      `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=${config.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN}`,
      '',
      '# =============================================================================',
      '# NOTION CONFIGURATION',
      '# =============================================================================',
      `NOTION_TOKEN=${config.NOTION_TOKEN}`,
      `NOTION_DATABASE_ID=${config.NOTION_DATABASE_ID}`,
      `NOTION_WEBHOOK_SECRET=${config.NOTION_WEBHOOK_SECRET}`,
      '',
      '# =============================================================================',
      '# SECURITY CONFIGURATION',
      '# =============================================================================',
      `JWT_SECRET=${config.JWT_SECRET}`,
      `ENCRYPTION_KEY=${config.ENCRYPTION_KEY}`,
      '',
      '# =============================================================================',
      '# SYNC CONFIGURATION',
      '# =============================================================================',
      `SYNC_PORT=${config.SYNC_PORT}`,
    ];

    // Add optional services if configured
    if (config.SMTP_HOST) {
      lines.push(
        '',
        '# =============================================================================',
        '# EMAIL CONFIGURATION',
        '# =============================================================================',
        `SMTP_HOST=${config.SMTP_HOST}`,
        `SMTP_PORT=${config.SMTP_PORT}`,
        `SMTP_USER=${config.SMTP_USER}`,
        `SMTP_PASS=${config.SMTP_PASS}`
      );
    }

    if (config.TWILIO_ACCOUNT_SID) {
      lines.push(
        '',
        '# =============================================================================',
        '# SMS CONFIGURATION',
        '# =============================================================================',
        `TWILIO_ACCOUNT_SID=${config.TWILIO_ACCOUNT_SID}`,
        `TWILIO_AUTH_TOKEN=${config.TWILIO_AUTH_TOKEN}`,
        `TWILIO_PHONE_NUMBER=${config.TWILIO_PHONE_NUMBER}`
      );
    }

    if (config.AWS_ACCESS_KEY_ID) {
      lines.push(
        '',
        '# =============================================================================',
        '# CLOUD STORAGE CONFIGURATION',
        '# =============================================================================',
        `AWS_ACCESS_KEY_ID=${config.AWS_ACCESS_KEY_ID}`,
        `AWS_SECRET_ACCESS_KEY=${config.AWS_SECRET_ACCESS_KEY}`,
        `AWS_REGION=${config.AWS_REGION}`,
        `AWS_S3_BUCKET=${config.AWS_S3_BUCKET}`
      );
    }

    return lines.join('\n') + '\n';
  }
}

// Main execution
async function main() {
  const setup = new EnvSetup();
  await setup.setup();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
