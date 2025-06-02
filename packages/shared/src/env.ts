/**
 * Environment Configuration Loader for ConstructTrack
 * Provides type-safe access to environment variables across the application
 */

// Environment variable schema
export interface EnvironmentConfig {
  // Core
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string; // Server-side only

  // MapBox
  MAPBOX_ACCESS_TOKEN: string;

  // Notion
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
  NOTION_WEBHOOK_SECRET?: string;

  // Security
  JWT_SECRET?: string;
  ENCRYPTION_KEY?: string;

  // Optional services
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;

  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;

  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AWS_S3_BUCKET?: string;

  // Development
  DEBUG?: string;
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  ENABLE_LOGGING?: boolean;
}

/**
 * Load and validate environment variables
 */
export function loadEnvironment(): EnvironmentConfig {
  const env = process.env;

  // Helper function to get required env var
  const getRequired = (key: string): string => {
    const value = env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  };

  // Helper function to get optional env var
  const getOptional = (key: string): string | undefined => {
    return env[key] || undefined;
  };

  // Helper function to get number
  const getNumber = (key: string, defaultValue?: number): number => {
    const value = env[key];
    if (!value) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Required environment variable ${key} is not set`);
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`Environment variable ${key} must be a number`);
    }
    return num;
  };

  // Helper function to get boolean
  const getBoolean = (key: string, defaultValue = false): boolean => {
    const value = env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  return {
    // Core
    NODE_ENV: (env.NODE_ENV as any) || 'development',
    PORT: getNumber('PORT', 3000),

    // Supabase
    SUPABASE_URL: getRequired('SUPABASE_URL'),
    SUPABASE_ANON_KEY: getRequired('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: getOptional('SUPABASE_SERVICE_ROLE_KEY'),

    // MapBox
    MAPBOX_ACCESS_TOKEN: getRequired('MAPBOX_ACCESS_TOKEN'),

    // Notion
    NOTION_TOKEN: getOptional('NOTION_TOKEN'),
    NOTION_DATABASE_ID: getOptional('NOTION_DATABASE_ID'),
    NOTION_WEBHOOK_SECRET: getOptional('NOTION_WEBHOOK_SECRET'),

    // Security
    JWT_SECRET: getOptional('JWT_SECRET'),
    ENCRYPTION_KEY: getOptional('ENCRYPTION_KEY'),

    // Email
    SMTP_HOST: getOptional('SMTP_HOST'),
    SMTP_PORT: env.SMTP_PORT ? getNumber('SMTP_PORT') : undefined,
    SMTP_USER: getOptional('SMTP_USER'),
    SMTP_PASS: getOptional('SMTP_PASS'),

    // SMS
    TWILIO_ACCOUNT_SID: getOptional('TWILIO_ACCOUNT_SID'),
    TWILIO_AUTH_TOKEN: getOptional('TWILIO_AUTH_TOKEN'),
    TWILIO_PHONE_NUMBER: getOptional('TWILIO_PHONE_NUMBER'),

    // Cloud Storage
    AWS_ACCESS_KEY_ID: getOptional('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: getOptional('AWS_SECRET_ACCESS_KEY'),
    AWS_REGION: getOptional('AWS_REGION'),
    AWS_S3_BUCKET: getOptional('AWS_S3_BUCKET'),

    // Development
    DEBUG: getOptional('DEBUG'),
    LOG_LEVEL: (env.LOG_LEVEL as any) || 'info',
    ENABLE_LOGGING: getBoolean('ENABLE_LOGGING', true),
  };
}

/**
 * Get client-safe environment variables (for Next.js and Expo)
 */
export function getClientEnvironment() {
  const env = process.env;

  return {
    NODE_ENV: env.NODE_ENV || 'development',
    
    // Supabase (client-safe)
    SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    
    // MapBox (client-safe)
    MAPBOX_ACCESS_TOKEN: env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    
    // App URL
    APP_URL: env.NEXT_PUBLIC_APP_URL,
  };
}

/**
 * Validate that required environment variables are set
 */
export function validateEnvironment(): void {
  try {
    loadEnvironment();
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }
}

// Export singleton instance
let environmentConfig: EnvironmentConfig | null = null;

export function getEnvironment(): EnvironmentConfig {
  if (!environmentConfig) {
    environmentConfig = loadEnvironment();
  }
  return environmentConfig;
}

// Environment-specific helpers
export const isDevelopment = () => getEnvironment().NODE_ENV === 'development';
export const isStaging = () => getEnvironment().NODE_ENV === 'staging';
export const isProduction = () => getEnvironment().NODE_ENV === 'production';

// Feature flags based on environment
export const isDebugEnabled = () => isDevelopment() || isStaging();
export const isLoggingEnabled = () => getEnvironment().ENABLE_LOGGING;

// Service availability checks
export const isNotionEnabled = () => {
  const env = getEnvironment();
  return !!(env.NOTION_TOKEN && env.NOTION_DATABASE_ID);
};

export const isEmailEnabled = () => {
  const env = getEnvironment();
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
};

export const isSMSEnabled = () => {
  const env = getEnvironment();
  return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
};

export const isCloudStorageEnabled = () => {
  const env = getEnvironment();
  return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET);
};
