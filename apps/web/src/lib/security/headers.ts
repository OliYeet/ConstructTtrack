/**
 * Security Headers Configuration
 * Implements comprehensive security headers for web application protection
 */

import { NextResponse } from 'next/server';

// Security header configuration
export interface SecurityHeadersConfig {
  contentSecurityPolicy: {
    enabled: boolean;
    directives: Record<string, string[]>;
    reportOnly: boolean;
  };
  strictTransportSecurity: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  xFrameOptions: {
    enabled: boolean;
    value: 'DENY' | 'SAMEORIGIN' | string;
  };
  xContentTypeOptions: {
    enabled: boolean;
  };
  referrerPolicy: {
    enabled: boolean;
    value: string;
  };
  permissionsPolicy: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
}

// CORS configuration
export interface CorsConfig {
  enabled: boolean;
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
}

// Default security headers configuration
export const defaultSecurityConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    enabled: true,
    reportOnly: process.env.NODE_ENV === 'development',
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        ...(process.env.NODE_ENV === 'development'
          ? ["'unsafe-inline'", "'unsafe-eval'"]
          : []),
        'https://api.mapbox.com',
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled-components and CSS-in-JS
        'https://api.mapbox.com',
        'https://fonts.googleapis.com',
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https:',
        'https://api.mapbox.com',
        'https://*.tiles.mapbox.com',
      ],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
      'connect-src': [
        "'self'",
        'https://api.mapbox.com',
        'https://events.mapbox.com',
        ...(process.env.NEXT_PUBLIC_SUPABASE_URL
          ? [process.env.NEXT_PUBLIC_SUPABASE_URL]
          : []),
        'wss:',
        'ws:',
      ],
      'worker-src': ["'self'", 'blob:'],
      'child-src': ["'self'", 'blob:'],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': [],
    },
  },
  strictTransportSecurity: {
    enabled: process.env.NODE_ENV === 'production',
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  xFrameOptions: {
    enabled: true,
    value: 'DENY',
  },
  xContentTypeOptions: {
    enabled: true,
  },
  referrerPolicy: {
    enabled: true,
    value: 'strict-origin-when-cross-origin',
  },
  permissionsPolicy: {
    enabled: true,
    directives: {
      camera: ["'self'"],
      microphone: ["'self'"],
      geolocation: ["'self'"],
      payment: ["'none'"],
      usb: ["'none'"],
      magnetometer: ["'none'"],
      gyroscope: ["'none'"],
      accelerometer: ["'self'"],
    },
  },
};

// Default CORS configuration
export const defaultCorsConfig: CorsConfig = {
  enabled: true,
  allowedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:3001']
      : []),
    'https://constructtrack.vercel.app',
    ...(process.env.NEXT_PUBLIC_APP_URL
      ? [process.env.NEXT_PUBLIC_APP_URL]
      : []),
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-API-Key',
    'X-Correlation-ID',
    'X-Request-ID',
  ],
  exposedHeaders: [
    'X-Correlation-ID',
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
};

// Apply security headers to response
export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = defaultSecurityConfig
): NextResponse {
  // Content Security Policy
  if (config.contentSecurityPolicy.enabled) {
    const cspDirectives = Object.entries(
      config.contentSecurityPolicy.directives
    )
      .map(([directive, sources]) => {
        if (sources.length === 0) {
          return directive;
        }
        return `${directive} ${sources.join(' ')}`;
      })
      .join('; ');

    const headerName = config.contentSecurityPolicy.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    response.headers.set(headerName, cspDirectives);
  }

  // Strict Transport Security
  if (config.strictTransportSecurity.enabled) {
    let hstsValue = `max-age=${config.strictTransportSecurity.maxAge}`;
    if (config.strictTransportSecurity.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }
    if (config.strictTransportSecurity.preload) {
      hstsValue += '; preload';
    }
    response.headers.set('Strict-Transport-Security', hstsValue);
  }

  // X-Frame-Options
  if (config.xFrameOptions.enabled) {
    response.headers.set('X-Frame-Options', config.xFrameOptions.value);
  }

  // X-Content-Type-Options
  if (config.xContentTypeOptions.enabled) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }

  // Referrer Policy
  if (config.referrerPolicy.enabled) {
    response.headers.set('Referrer-Policy', config.referrerPolicy.value);
  }

  // Permissions Policy
  if (config.permissionsPolicy.enabled) {
    const permissionsDirectives = Object.entries(
      config.permissionsPolicy.directives
    )
      .map(([directive, allowlist]) => `${directive}=(${allowlist.join(' ')})`)
      .join(', ');

    response.headers.set('Permissions-Policy', permissionsDirectives);
  }

  // Additional security headers
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Download-Options', 'noopen');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  return response;
}

// Apply CORS headers to response
export function applyCorsHeaders(
  response: NextResponse,
  origin?: string,
  config: CorsConfig = defaultCorsConfig
): NextResponse {
  if (!config.enabled) {
    return response;
  }

  // Check if origin is allowed
  const originAllowed = isOriginAllowed(origin || '', config);

  if (originAllowed) {
    // Set allowed origin
    if (origin && config.allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else if (config.allowedOrigins.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }

    // Set other CORS headers
    response.headers.set(
      'Access-Control-Allow-Methods',
      config.allowedMethods.join(', ')
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      config.allowedHeaders.join(', ')
    );

    if (config.exposedHeaders.length > 0) {
      response.headers.set(
        'Access-Control-Expose-Headers',
        config.exposedHeaders.join(', ')
      );
    }

    if (config.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    response.headers.set('Access-Control-Max-Age', config.maxAge.toString());
  }

  return response;
}

// Validate origin against allowed origins
export function isOriginAllowed(
  origin: string,
  config: CorsConfig = defaultCorsConfig
): boolean {
  if (!config.enabled) {
    return true;
  }

  return (
    config.allowedOrigins.includes('*') ||
    config.allowedOrigins.includes(origin)
  );
}

// Create security headers middleware
export function createSecurityHeadersMiddleware(
  securityConfig?: Partial<SecurityHeadersConfig>,
  corsConfig?: Partial<CorsConfig>
) {
  const finalSecurityConfig = { ...defaultSecurityConfig, ...securityConfig };
  const finalCorsConfig = { ...defaultCorsConfig, ...corsConfig };

  return function securityMiddleware(
    response: NextResponse,
    origin?: string
  ): NextResponse {
    // Apply security headers
    applySecurityHeaders(response, finalSecurityConfig);

    // Apply CORS headers
    applyCorsHeaders(response, origin, finalCorsConfig);

    return response;
  };
}

// Environment-specific configurations
export const developmentSecurityConfig: Partial<SecurityHeadersConfig> = {
  contentSecurityPolicy: {
    enabled: true,
    reportOnly: true,
    directives: {
      ...defaultSecurityConfig.contentSecurityPolicy.directives,
      'script-src': [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://api.mapbox.com',
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
      ],
    },
  },
  strictTransportSecurity: {
    enabled: false,
    maxAge: 0,
    includeSubDomains: false,
    preload: false,
  },
};

export const productionSecurityConfig: Partial<SecurityHeadersConfig> = {
  contentSecurityPolicy: {
    enabled: true,
    reportOnly: false,
    directives: {
      ...defaultSecurityConfig.contentSecurityPolicy.directives,
      'script-src': [
        "'self'",
        'https://api.mapbox.com',
        'https://cdn.jsdelivr.net',
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled-components and CSS-in-JS
        'https://api.mapbox.com',
        'https://fonts.googleapis.com',
      ],
    },
  },
  strictTransportSecurity: {
    enabled: true,
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
};
