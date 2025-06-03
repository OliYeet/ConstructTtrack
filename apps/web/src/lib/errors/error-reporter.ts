/**
 * Error Reporter Service
 * Handles error reporting, aggregation, and analytics
 */

import { getLogger } from '@/lib/logging';
import { ErrorSeverity, ErrorClassification } from './global-handler';

// Error report interface
export interface ErrorReport {
  id: string;
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: {
    url?: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
    source: string;
    additionalData?: Record<string, unknown>;
  };
  classification: ErrorClassification;
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
  tags: string[];
}

// Error aggregation data
export interface ErrorAggregation {
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  affectedUsers: Set<string>;
  occurrencesByHour: Record<string, number>;
  classification: ErrorClassification;
  sampleError: ErrorReport;
}

// Error reporter configuration
export interface ErrorReporterConfig {
  maxReports: number;
  aggregationWindow: number; // milliseconds
  enableLocalStorage: boolean;
  enableRemoteReporting: boolean;
  remoteEndpoint?: string;
  apiKey?: string;
}

// Error reporter class
export class ErrorReporter {
  private config: ErrorReporterConfig;
  private reports: Map<string, ErrorReport> = new Map();
  private aggregations: Map<string, ErrorAggregation> = new Map();
  private reportQueue: ErrorReport[] = [];

  constructor(config: ErrorReporterConfig) {
    this.config = config;
    this.loadFromStorage();
  }

  // Report an error
  async reportError(
    error: Error,
    context: {
      source: string;
      url?: string;
      userAgent?: string;
      userId?: string;
      sessionId?: string;
      additionalData?: Record<string, unknown>;
    },
    classification: ErrorClassification
  ): Promise<string> {
    const reportId = this.generateReportId();
    const timestamp = new Date().toISOString();
    const fingerprint = this.generateFingerprint(error, context);

    // Create error report
    const report: ErrorReport = {
      id: reportId,
      timestamp,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      classification,
      fingerprint,
      count: 1,
      firstSeen: timestamp,
      lastSeen: timestamp,
      resolved: false,
      tags: this.generateTags(error, context, classification),
    };

    // Store report
    this.reports.set(reportId, report);

    // Update aggregation
    this.updateAggregation(report);

 // Add to queue only when it can eventually be drained
 if (this.config.enableRemoteReporting) {
   this.reportQueue.push(report);
 }

    // Save to storage
    if (this.config.enableLocalStorage) {
      this.saveToStorage();
    }

    // Send to remote endpoint
    if (this.config.enableRemoteReporting) {
      await this.sendToRemote(report);
    }

    // Log the error report
    const logger = getLogger();
    await logger.info('Error reported', {
      metadata: {
        reportId,
        fingerprint,
        classification,
        errorMessage: error.message,
      },
    });

    // Cleanup old reports
    this.cleanup();

    return reportId;
  }

  // Generate unique report ID
  private generateReportId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate error fingerprint for deduplication
  private generateFingerprint(
    error: Error,
    context: { source: string; url?: string; additionalData?: Record<string, unknown> }
  ): string {
    // Create a hash-like string from error characteristics
    const components = [
      error.name,
      error.message,
      context.source,
      (() => {
   try {
     return context.url ? new URL(context.url, 'http://local').pathname : '';
   } catch {
     return '';
   }
 })(),
      error.stack ? error.stack.split('\n')[1] : '', // First stack frame
    ];

    return components
      .filter(Boolean)
      .join('|')
      .replace(/[^a-zA-Z0-9|]/g, '')
      .toLowerCase();
  }

  // Generate tags for categorization
  private generateTags(
    error: Error,
    context: { source: string; url?: string; additionalData?: Record<string, unknown> },
    classification: ErrorClassification
  ): string[] {
    const tags: string[] = [
      classification.type,
      classification.severity,
      classification.category,
      context.source,
    ];

    // Add URL-based tags
    if (context.url) {
      try {
        const url = new URL(context.url);
        tags.push(`path:${url.pathname.split('/')[1] || 'root'}`);
      } catch {
        // Invalid URL, skip
      }
    }

    // Add error type tags
    if (error.name !== 'Error') {
      tags.push(`error_type:${error.name.toLowerCase()}`);
    }

    // Add browser/environment tags
    if (typeof window !== 'undefined') {
      tags.push('environment:browser');
    } else {
      tags.push('environment:server');
    }

    return tags.filter(Boolean);
  }

  // Update error aggregation
  private updateAggregation(report: ErrorReport): void {
    const existing = this.aggregations.get(report.fingerprint);

    if (existing) {
      existing.count++;
      existing.lastSeen = report.timestamp;
      if (report.context.userId) {
        existing.affectedUsers.add(report.context.userId);
      }

      // Update hourly occurrences
      const hour = new Date(report.timestamp).toISOString().substr(0, 13);
      existing.occurrencesByHour[hour] = (existing.occurrencesByHour[hour] || 0) + 1;
    } else {
      const aggregation: ErrorAggregation = {
        fingerprint: report.fingerprint,
        count: 1,
        firstSeen: report.timestamp,
        lastSeen: report.timestamp,
        affectedUsers: new Set(report.context.userId ? [report.context.userId] : []),
        occurrencesByHour: {
          [new Date(report.timestamp).toISOString().substr(0, 13)]: 1,
        },
        classification: report.classification,
        sampleError: report,
      };

      this.aggregations.set(report.fingerprint, aggregation);
    }
  }

  // Send error to remote endpoint
  private async sendToRemote(report: ErrorReport): Promise<void> {
    if (!this.config.remoteEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          report,
          aggregation: this.aggregations.get(report.fingerprint),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Remove from queue on successful send
      const index = this.reportQueue.findIndex(r => r.id === report.id);
      if (index > -1) {
        this.reportQueue.splice(index, 1);
      }

    } catch (error) {
      const logger = getLogger();
      await logger.warn('Failed to send error report to remote endpoint', {
        metadata: {
          reportId: report.id,
          endpoint: this.config.remoteEndpoint,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  // Load reports from local storage
  private loadFromStorage(): void {
    if (!this.config.enableLocalStorage || typeof window === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem('constructtrack_error_reports');
      if (stored) {
        const data = JSON.parse(stored);
        
        // Restore reports
        if (data.reports) {
          Object.entries(data.reports).forEach(([id, report]) => {
            this.reports.set(id, report as ErrorReport);
          });
        }

        // Restore aggregations (convert affectedUsers back to Set)
        if (data.aggregations) {
          Object.entries(data.aggregations).forEach(([fingerprint, agg]) => {
            const aggregation = agg as any;
            aggregation.affectedUsers = new Set(aggregation.affectedUsers || []);
            this.aggregations.set(fingerprint, aggregation);
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load error reports from storage:', error);
    }
  }

  // Save reports to local storage
  private saveToStorage(): void {
    if (!this.config.enableLocalStorage || typeof window === 'undefined') {
      return;
    }

    try {
      const data = {
        reports: Object.fromEntries(this.reports),
        aggregations: Object.fromEntries(
          Array.from(this.aggregations.entries()).map(([key, value]) => [
            key,
            {
              ...value,
              affectedUsers: Array.from(value.affectedUsers),
            },
          ])
        ),
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem('constructtrack_error_reports', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save error reports to storage:', error);
    }
  }

  // Cleanup old reports
  private cleanup(): void {
    const cutoff = Date.now() - this.config.aggregationWindow;
    const toDelete: string[] = [];

    // Find old reports
    this.reports.forEach((report, id) => {
      if (new Date(report.timestamp).getTime() < cutoff) {
        toDelete.push(id);
      }
    });

    // Delete old reports
    toDelete.forEach(id => this.reports.delete(id));

    // Limit total reports
    if (this.reports.size > this.config.maxReports) {
      const sorted = Array.from(this.reports.entries())
        .sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const toKeep = sorted.slice(0, this.config.maxReports);
      this.reports.clear();
      toKeep.forEach(([id, report]) => this.reports.set(id, report));
    }
  }

  // Get error statistics
  getStats(): {
    totalReports: number;
    uniqueErrors: number;
    recentErrors: number;
    topErrors: Array<{ fingerprint: string; count: number; message: string }>;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  } {
    const recentThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    const recentErrors = Array.from(this.reports.values()).filter(
      report => new Date(report.timestamp).getTime() > recentThreshold
    );

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    this.aggregations.forEach(agg => {
      errorsByType[agg.classification.type] = (errorsByType[agg.classification.type] || 0) + agg.count;
      errorsBySeverity[agg.classification.severity] = (errorsBySeverity[agg.classification.severity] || 0) + agg.count;
    });

    const topErrors = Array.from(this.aggregations.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(agg => ({
        fingerprint: agg.fingerprint,
        count: agg.count,
        message: agg.sampleError.error.message,
      }));

    return {
      totalReports: this.reports.size,
      uniqueErrors: this.aggregations.size,
      recentErrors: recentErrors.length,
      topErrors,
      errorsByType,
      errorsBySeverity,
    };
  }

  // Get aggregated errors
  getAggregatedErrors(): ErrorAggregation[] {
    return Array.from(this.aggregations.values())
      .sort((a, b) => b.count - a.count);
  }

  // Mark error as resolved
  markResolved(fingerprint: string): void {
    const aggregation = this.aggregations.get(fingerprint);
    if (aggregation) {
      aggregation.sampleError.resolved = true;
    }

    // Mark all reports with this fingerprint as resolved
    this.reports.forEach(report => {
      if (report.fingerprint === fingerprint) {
        report.resolved = true;
      }
    });

    this.saveToStorage();
  }
}

// Default configuration
const defaultConfig: ErrorReporterConfig = {
  maxReports: 1000,
  aggregationWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableLocalStorage: true,
  enableRemoteReporting: false,
  remoteEndpoint: process.env.ERROR_REPORTING_ENDPOINT,
  apiKey: process.env.ERROR_REPORTING_API_KEY,
};

// Global error reporter instance
export const errorReporter = new ErrorReporter(defaultConfig);
