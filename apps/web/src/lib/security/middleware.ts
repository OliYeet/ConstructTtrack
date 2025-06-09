/**
 * Security Middleware
 * Integrates all security components into a unified middleware system
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  applySecurityHeaders,
  applyCorsHeaders,
  defaultSecurityConfig,
  defaultCorsConfig,
} from './headers';
import {
  privacyManager,
  ProcessingPurpose,
  DataCategory,
} from './privacy-compliance';
import { createRateLimitMiddleware, shouldRateLimit } from './rate-limiting';

import { getLogger } from '@/lib/logging';

// Security middleware configuration
export interface SecurityMiddlewareConfig {
  enableSecurityHeaders: boolean;
  enableCors: boolean;
  enableRateLimit: boolean;
  enablePrivacyCompliance: boolean;
  enableSecurityLogging: boolean;
  rateLimitConfig?: string; // Rate limit configuration name
  customSecurityHeaders?: Record<string, string>;
  trustedProxies?: string[];
}

// Security context
export interface SecurityContext {
  clientIP: string;
  userAgent: string;
  origin?: string;
  correlationId: string;
  requestId: string;
  securityFlags: {
    rateLimited: boolean;
    corsViolation: boolean;
    suspiciousActivity: boolean;
  };
}

// Default security middleware configuration
export const defaultSecurityMiddlewareConfig: SecurityMiddlewareConfig = {
  enableSecurityHeaders: true,
  enableCors: true,
  enableRateLimit: true,
  enablePrivacyCompliance: true,
  enableSecurityLogging: true,
  rateLimitConfig: 'api',
  trustedProxies: ['127.0.0.1', '::1'],
};

// Security middleware class
export class SecurityMiddleware {
  private config: SecurityMiddlewareConfig;
  private rateLimitMiddleware?: any;

  constructor(
    config: SecurityMiddlewareConfig = defaultSecurityMiddlewareConfig
  ) {
    this.config = config;

    if (config.enableRateLimit && config.rateLimitConfig) {
      this.rateLimitMiddleware = createRateLimitMiddleware(
        config.rateLimitConfig as any
      );
    }
  }

  // Main security middleware handler
  async handle(request: NextRequest): Promise<{
    response?: NextResponse;
    context: SecurityContext;
    allowed: boolean;
  }> {
    const context = this.createSecurityContext(request);
    const logger = getLogger();

    try {
      // 1. Rate limiting check
      if (
        this.config.enableRateLimit &&
        shouldRateLimit(request) &&
        this.rateLimitMiddleware
      ) {
        let rateLimitResult;
        try {
          rateLimitResult = await this.rateLimitMiddleware(request);
        } catch (error) {
          logger.error('Rate limit middleware error', error, {
            correlationId: context.correlationId,
          });
          // Fail open - allow the request but log the error
          rateLimitResult = { allowed: true };
        }

        if (
          !rateLimitResult ||
          typeof rateLimitResult.allowed === 'undefined'
        ) {
          logger.warn('Invalid rate limit result, failing open', {
            correlationId: context.correlationId,
          });
          rateLimitResult = { allowed: true };
        }

        if (!rateLimitResult.allowed) {
          context.securityFlags.rateLimited = true;

          if (this.config.enableSecurityLogging) {
            logger.warn('Request rate limited', {
              correlationId: context.correlationId,
              metadata: {
                clientIP: context.clientIP,
                endpoint: new URL(request.url).pathname,
                userAgent: context.userAgent,
                securityEvent: 'rate_limit_exceeded',
              },
            });
          }

          // Apply security headers to rate limit response
          if (rateLimitResult.response && this.config.enableSecurityHeaders) {
            const secureResponse = this.applySecurityHeaders(
              new NextResponse(rateLimitResult.response.body, {
                status: rateLimitResult.response.status,
                headers: rateLimitResult.response.headers,
              }),
              context.origin
            );
            return { response: secureResponse, context, allowed: false };
          }

          return {
            response: rateLimitResult.response,
            context,
            allowed: false,
          };
        }
      }

      // 2. CORS validation
      if (this.config.enableCors && context.origin) {
        const corsValid = this.validateCors(context.origin);
        if (!corsValid) {
          context.securityFlags.corsViolation = true;

          if (this.config.enableSecurityLogging) {
            logger.warn('CORS violation detected', {
              correlationId: context.correlationId,
              metadata: {
                clientIP: context.clientIP,
                origin: context.origin,
                securityEvent: 'cors_violation',
              },
            });
          }

          const corsResponse = new NextResponse(
            JSON.stringify({ error: 'CORS policy violation' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );

          return {
            response: this.applySecurityHeaders(corsResponse, context.origin),
            context,
            allowed: false,
          };
        }
      }

      // 3. Suspicious activity detection
      const suspiciousActivity = this.detectSuspiciousActivity(
        request,
        context
      );
      if (suspiciousActivity) {
        context.securityFlags.suspiciousActivity = true;

        if (this.config.enableSecurityLogging) {
          logger.warn('Suspicious activity detected', {
            correlationId: context.correlationId,
            metadata: {
              clientIP: context.clientIP,
              suspiciousIndicators: suspiciousActivity,
              securityEvent: 'suspicious_activity',
            },
          });
        }

        // Continue processing but flag for monitoring
      }

      // 4. Privacy compliance tracking
      if (this.config.enablePrivacyCompliance) {
        await this.trackPrivacyCompliance(request, context);
      }

      // 5. Security logging
      if (this.config.enableSecurityLogging) {
        logger.debug('Security middleware passed', {
          correlationId: context.correlationId,
          metadata: {
            clientIP: context.clientIP,
            endpoint: new URL(request.url).pathname,
            method: request.method,
            securityFlags: context.securityFlags,
          },
        });
      }

      return { context, allowed: true };
    } catch (error) {
      logger.error('Security middleware error', error, {
        correlationId: context.correlationId,
        metadata: {
          clientIP: context.clientIP,
          endpoint: new URL(request.url).pathname,
        },
      });

      // Fail securely - allow request but log error
      return { context, allowed: true };
    }
  }

  // Apply security headers to response
  applySecurityHeaders(response: NextResponse, origin?: string): NextResponse {
    if (this.config.enableSecurityHeaders) {
      applySecurityHeaders(response, defaultSecurityConfig);
    }

    if (this.config.enableCors && origin) {
      applyCorsHeaders(response, origin, defaultCorsConfig);
    }

    // Apply custom security headers
    if (this.config.customSecurityHeaders) {
      Object.entries(this.config.customSecurityHeaders).forEach(
        ([key, value]) => {
          response.headers.set(key, value);
        }
      );
    }

    return response;
  }

  // Create security context
  private createSecurityContext(request: NextRequest): SecurityContext {
    const uuid =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().substring(0, 9)
        : Math.random().toString(36).substring(2, 11);
    const correlationId = `sec_${Date.now()}_${uuid}`;
    const requestId = request.headers.get('x-request-id') || correlationId;

    return {
      clientIP: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      origin: request.headers.get('origin') || undefined,
      correlationId,
      requestId,
      securityFlags: {
        rateLimited: false,
        corsViolation: false,
        suspiciousActivity: false,
      },
    };
  }

  // Get client IP address
  private getClientIP(request: NextRequest): string {
    // Check various headers for client IP
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      // Return the first non-trusted proxy IP
      for (const ip of ips) {
        if (!this.config.trustedProxies?.includes(ip)) {
          return ip;
        }
      }
      return ips[0];
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) return realIP;

    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    if (cfConnectingIP) return cfConnectingIP;

    return 'unknown';
  }

  // Validate CORS
  private validateCors(origin: string): boolean {
    return (
      defaultCorsConfig.allowedOrigins.includes('*') ||
      defaultCorsConfig.allowedOrigins.includes(origin)
    );
  }

  // Detect suspicious activity
  private detectSuspiciousActivity(
    request: NextRequest,
    context: SecurityContext
  ): string[] {
    const indicators: string[] = [];
    const url = new URL(request.url);
    const userAgent = context.userAgent.toLowerCase();

    // Check for common attack patterns
    const suspiciousPatterns = [
      { pattern: /\.\.\//g, indicator: 'path_traversal' },
      { pattern: /<script/gi, indicator: 'xss_attempt' },
      { pattern: /union\s+select/gi, indicator: 'sql_injection' },
      { pattern: /exec\s*\(/gi, indicator: 'code_injection' },
      { pattern: /eval\s*\(/gi, indicator: 'eval_injection' },
    ];

    const fullUrl = url.toString();
    for (const { pattern, indicator } of suspiciousPatterns) {
      if (pattern.test(fullUrl)) {
        indicators.push(indicator);
      }
    }

    // Check for suspicious user agents
    const maliciousUserAgents = [
      'sqlmap',
      'nikto',
      'nmap',
      'masscan',
      'zap',
      'burp',
    ];
    const automatedUserAgents = [
      'wget',
      'curl',
      'python-requests',
      'go-http-client',
    ];

    for (const malicious of maliciousUserAgents) {
      if (userAgent.includes(malicious)) {
        indicators.push('malicious_user_agent');
        break;
      }
    }

    // Only flag automated agents if combined with other suspicious patterns
    if (indicators.length > 0) {
      for (const automated of automatedUserAgents) {
        if (userAgent.includes(automated)) {
          indicators.push('automated_user_agent');
          break;
        }
      }
    }

    // Check for unusual request patterns
    if (url.pathname.includes('..')) {
      indicators.push('directory_traversal');
    }

    if (url.searchParams.toString().length > 2000) {
      indicators.push('oversized_parameters');
    }

    // Check for common vulnerability scanning patterns
    const scanningPaths = [
      '/admin',
      '/wp-admin',
      '/.env',
      '/config',
      '/backup',
      '/phpmyadmin',
      '/adminer',
      '/.git',
      '/.svn',
      '/.hg',
      '/wp-config.php',
      '/web.config',
      '/database.yml',
    ];

    for (const path of scanningPaths) {
      if (url.pathname.includes(path)) {
        indicators.push('vulnerability_scanning');
        break;
      }
    }

    return indicators;
  }

  // Track privacy compliance
  private async trackPrivacyCompliance(
    request: NextRequest,
    context: SecurityContext
  ): Promise<void> {
    try {
      const url = new URL(request.url);
      const userId = request.headers.get('x-user-id');

      // Track data processing for API endpoints that handle personal data
      if (userId && this.isPersonalDataEndpoint(url.pathname)) {
        await privacyManager.recordProcessing(
          userId,
          this.getDataCategory(url.pathname),
          ProcessingPurpose.LEGITIMATE_INTEREST,
          'Service provision',
          {
            endpoint: url.pathname,
            method: request.method,
            clientIP: context.clientIP,
            correlationId: context.correlationId,
          }
        );
      }
    } catch (error) {
      const logger = getLogger();
      logger.warn('Privacy compliance tracking failed', {
        correlationId: context.correlationId,
        metadata: { error },
      });
    }
  }

  // Check if endpoint handles personal data
  private isPersonalDataEndpoint(pathname: string): boolean {
    const personalDataEndpoints = [
      '/api/v1/users',
      '/api/v1/profile',
      '/api/v1/projects',
      '/api/v1/reports',
      '/api/v1/forms',
    ];

    return personalDataEndpoints.some(endpoint =>
      pathname.startsWith(endpoint)
    );
  }

  // Get data category for endpoint
  private getDataCategory(pathname: string): DataCategory {
    if (pathname.includes('/users') || pathname.includes('/profile')) {
      return DataCategory.PERSONAL_IDENTIFIABLE;
    }
    if (pathname.includes('/location') || pathname.includes('/gps')) {
      return DataCategory.LOCATION;
    }
    if (pathname.includes('/reports') || pathname.includes('/forms')) {
      return DataCategory.BEHAVIORAL;
    }
    return DataCategory.TECHNICAL;
  }
}

// Create security middleware instance
export function createSecurityMiddleware(
  config?: Partial<SecurityMiddlewareConfig>
) {
  const finalConfig = { ...defaultSecurityMiddlewareConfig, ...config };
  return new SecurityMiddleware(finalConfig);
}

// Global security middleware instance
export const securityMiddleware = createSecurityMiddleware();

// Security middleware for Next.js middleware
export async function withSecurity(
  request: NextRequest,
  config?: Partial<SecurityMiddlewareConfig>
): Promise<NextResponse | undefined> {
  const middleware = config
    ? createSecurityMiddleware(config)
    : securityMiddleware;
  const result = await middleware.handle(request);

  if (!result.allowed && result.response) {
    return result.response;
  }

  // Add security context to request headers for downstream use
  const response = NextResponse.next();
  response.headers.set(
    'x-security-correlation-id',
    result.context.correlationId
  );
  response.headers.set('x-client-ip', result.context.clientIP);

  // Apply security headers
  return middleware.applySecurityHeaders(response, result.context.origin);
}
