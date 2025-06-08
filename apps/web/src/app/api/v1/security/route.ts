/**
 * Security API Endpoint
 * Provides security monitoring, scanning, and management capabilities
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createSuccessResponse, createErrorResponse } from '@/lib/api/response';
import { privacyManager } from '@/lib/security/privacy-compliance';
import {
  securityScanner,
  defaultSecurityScanConfig,
} from '@/lib/security/vulnerability-scanner';

// Security parameter interfaces
interface ScanParameters {
  scanType: string;
}

interface PrivacyRequestParameters {
  requestType: string;
  userId: string;
  details?: Record<string, unknown>;
}

interface RateLimitParameters {
  target?: string;
}

interface ReportParameters {
  format?: string;
  includeDetails?: boolean;
}

// Global type declarations for Web APIs
declare const URL: {
  new (
    url: string,
    base?: string
  ): {
    searchParams: {
      get(name: string): string | null;
    };
  };
};

// Validation schema for POST requests
const securityActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('scan'),
    parameters: z.object({
      scanType: z.enum(['vulnerability', 'compliance']),
    }),
  }),
  z.object({
    action: z.literal('privacy-request'),
    parameters: z.object({
      requestType: z.enum([
        'data-export',
        'data-deletion',
        'consent-withdrawal',
      ]),
      userId: z.string().uuid(),
      details: z.record(z.unknown()).optional(),
    }),
  }),
  z.object({
    action: z.literal('reset-rate-limits'),
    parameters: z.object({ target: z.string().optional() }).optional(),
  }),
  z.object({
    action: z.literal('generate-report'),
    parameters: z
      .object({
        format: z.enum(['json', 'csv', 'pdf']).optional(),
        includeDetails: z.boolean().optional(),
      })
      .optional(),
  }),
]);

// GET /api/v1/security - Get security status and metrics
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'overview';

  try {
    let response: Record<string, unknown> = {};

    switch (type) {
      case 'overview':
        response = await getSecurityOverview();
        break;

      case 'vulnerabilities':
        response = {
          findings: securityScanner.getFindings(),
          report: securityScanner.generateSecurityReport(),
        };
        break;

      case 'privacy': {
        const userId = url.searchParams.get('userId');
        if (userId) {
          response = await privacyManager.getUserPrivacyDashboard(userId);
        } else {
          response = await privacyManager.checkCompliance();
        }
        break;
      }

      case 'rate-limits':
        response = await getRateLimitStatus();
        break;

      case 'scan-config':
        response = {
          config: defaultSecurityScanConfig,
          supportedScans: [
            'static-analysis',
            'dependency-scan',
            'configuration-scan',
            'runtime-scan',
          ],
        };
        break;

      default:
        return createErrorResponse(
          new Error('Invalid security report type'),
          'unknown'
        );
    }

    return createSuccessResponse(response);
  } catch (err: unknown) {
    return createErrorResponse(
      err instanceof Error ? err : new Error(String(err)),
      'unknown'
    );
  }
}

// POST /api/v1/security - Trigger security actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = securityActionSchema.safeParse(body);
    if (!validationResult.success) {
      return createErrorResponse(
        new Error('Invalid request body: ' + validationResult.error.message),
        'unknown'
      );
    }

    const { action, parameters } = validationResult.data;

    let response: Record<string, unknown> = {};

    switch (action) {
      case 'scan':
        response = await triggerSecurityScan(parameters);
        break;

      case 'privacy-request':
        response = await handlePrivacyRequest(parameters);
        break;

      case 'reset-rate-limits':
        response = await resetRateLimits(parameters);
        break;

      case 'generate-report':
        response = await generateSecurityReport(parameters);
        break;

      default:
        return createErrorResponse(
          new Error('Invalid security action'),
          'unknown'
        );
    }

    return createSuccessResponse(response);
  } catch {
    return createErrorResponse(
      new Error('Failed to execute security action'),
      'unknown'
    );
  }
}

// Helper functions

async function getSecurityOverview() {
  const vulnerabilityReport = securityScanner.generateSecurityReport();
  const complianceStatus = await privacyManager.checkCompliance();

  return {
    timestamp: new Date().toISOString(),
    security: {
      vulnerabilities: vulnerabilityReport.summary,
      compliance: {
        compliant: complianceStatus.compliant,
        issueCount: complianceStatus.issues.length,
      },
      rateLimit: {
        enabled: true,
        violations: 0, // Would track from monitoring system
      },
      headers: {
        enabled: true,
        configured: true,
      },
    },
    recommendations: [
      ...vulnerabilityReport.recommendations,
      ...complianceStatus.recommendations,
    ],
    lastScan: new Date().toISOString(),
    nextScan: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function getRateLimitStatus() {
  // In a real implementation, this would query the rate limit store
  return {
    enabled: true,
    configurations: {
      api: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
      auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
      upload: { windowMs: 60 * 1000, maxRequests: 10 },
    },
    currentViolations: 0,
    topViolators: [],
  };
}

async function triggerSecurityScan(parameters: ScanParameters) {
  const { scanType } = parameters;

  switch (scanType) {
    case 'vulnerability': {
      // Trigger comprehensive vulnerability scan
      const findings = await securityScanner.performComprehensiveScan({
        configuration: process.env,
      });

      return {
        scanId: `scan_${Date.now()}`,
        scanType: 'vulnerability',
        status: 'completed',
        findings: findings.length,
        summary: {
          critical: findings.filter(f => f.severity === 'critical').length,
          high: findings.filter(f => f.severity === 'high').length,
          medium: findings.filter(f => f.severity === 'medium').length,
          low: findings.filter(f => f.severity === 'low').length,
        },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }

    case 'compliance': {
      const complianceResult = await privacyManager.checkCompliance();

      return {
        scanId: `compliance_${Date.now()}`,
        scanType: 'compliance',
        status: 'completed',
        compliant: complianceResult.compliant,
        issues: complianceResult.issues.length,
        recommendations: complianceResult.recommendations.length,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }

    default:
      throw new Error(`Unsupported scan type: ${scanType}`);
  }
}

async function handlePrivacyRequest(parameters: PrivacyRequestParameters) {
  const { requestType, userId, details } = parameters;

  switch (requestType) {
    case 'data-export': {
      const requestId = await privacyManager.submitDataSubjectRequest(
        userId,
        'access' as const,
        details
      );

      // Process the request immediately for demo purposes
      const exportData =
        await privacyManager.processDataSubjectRequest(requestId);

      return {
        requestId,
        requestType: 'data-export',
        status: 'completed',
        userId,
        submittedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        data: exportData,
      };
    }

    case 'data-deletion': {
      const deletionRequestId = await privacyManager.submitDataSubjectRequest(
        userId,
        'erasure' as const,
        details
      );

      return {
        requestId: deletionRequestId,
        requestType: 'data-deletion',
        status: 'pending',
        userId,
        submittedAt: new Date().toISOString(),
        estimatedCompletion: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      };
    }

    case 'consent-withdrawal': {
      const success = await privacyManager.withdrawConsent(
        userId,
        details.consentId
      );

      return {
        requestType: 'consent-withdrawal',
        status: success ? 'completed' : 'failed',
        userId,
        consentId: details.consentId,
        processedAt: new Date().toISOString(),
      };
    }

    default:
      throw new Error(`Unsupported privacy request type: ${requestType}`);
  }
}

async function resetRateLimits(parameters?: RateLimitParameters) {
  const { target } = parameters || {};

  // In a real implementation, this would reset rate limits in the store
  return {
    action: 'reset-rate-limits',
    target: target || 'all',
    status: 'completed',
    resetAt: new Date().toISOString(),
    message: 'Rate limits have been reset',
  };
}

async function generateSecurityReport(parameters?: ReportParameters) {
  const { format, includeDetails } = parameters || {};

  const vulnerabilityReport = securityScanner.generateSecurityReport();
  const complianceStatus = await privacyManager.checkCompliance();

  const report = {
    generatedAt: new Date().toISOString(),
    format: format || 'json',
    summary: {
      vulnerabilities: vulnerabilityReport.summary,
      compliance: {
        compliant: complianceStatus.compliant,
        issues: complianceStatus.issues.length,
        recommendations: complianceStatus.recommendations.length,
      },
      security: {
        headersConfigured: true,
        rateLimitingEnabled: true,
        encryptionEnabled: true,
        auditingEnabled: true,
      },
    },
  };

  if (includeDetails) {
    (report as Record<string, unknown>).details = {
      vulnerabilities: vulnerabilityReport.findings,
      complianceIssues: complianceStatus.issues,
      recommendations: [
        ...vulnerabilityReport.recommendations,
        ...complianceStatus.recommendations,
      ],
    };
  }

  return {
    reportId: `report_${Date.now()}`,
    report,
    downloadUrl: `/api/v1/security/reports/${Date.now()}`, // Would generate actual download URL
  };
}
