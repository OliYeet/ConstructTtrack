/**
 * Error Dashboard Page
 * Admin interface for viewing and managing errors
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

import { ErrorBoundary } from '@/components/error-boundary';

// Error data interfaces
interface ErrorStats {
  totalReports: number;
  uniqueErrors: number;
  recentErrors: number;
  topErrors: Array<{
    fingerprint: string;
    count: number;
    message: string;
  }>;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
}

interface AggregatedError {
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  classification: {
    type: string;
    severity: string;
    category: string;
    recoverable: boolean;
  };
  sampleError: {
    error: {
      name: string;
      message: string;
    };
    resolved: boolean;
  };
}

// Error dashboard component
function ErrorDashboard() {
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [errors, setErrors] = useState<AggregatedError[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');
  const [selectedType, setSelectedType] = useState('all');
  useEffect(() => {
    fetchErrorData();
  }, [selectedTimeframe, selectedType, fetchErrorData]);

  const fetchErrorData = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);

    try {
      const statsRes = await fetch('/api/v1/errors?type=summary', {
        signal: controller.signal,
      });
      if (!statsRes.ok)
        throw new Error(`Stats request failed: ${statsRes.status}`);
      const {
        data: { stats },
      } = await statsRes.json();
      setStats(stats);

      const errsRes = await fetch(
        `/api/v1/errors?type=recent&timeframe=${selectedTimeframe}&errorType=${selectedType}&limit=50`,
        { signal: controller.signal }
      );
      if (!errsRes.ok)
        throw new Error(`Errors request failed: ${errsRes.status}`);
      const {
        data: { errors },
      } = await errsRes.json();
      setErrors(errors);
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        // Log error silently - in production this would go to error reporting
        // console.error('Failed to fetch error data:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTimeframe, selectedType]);

  const handleResolveError = async (fingerprint: string) => {
    try {
      const res = await fetch(`/api/v1/errors/${fingerprint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'resolve' }),
      });

      if (!res.ok) {
        throw new Error(`Failed with status ${res.status}`);
      }

      // Optimistically update local state
      setErrors(prev =>
        prev.map(e =>
          e.fingerprint === fingerprint
            ? { ...e, sampleError: { ...e.sampleError, resolved: true } }
            : e
        )
      );
    } catch {
      // Log error silently - in production this would go to error reporting
      // console.error('Failed to resolve error:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'javascript':
        return 'text-blue-600 bg-blue-100';
      case 'network':
        return 'text-purple-600 bg-purple-100';
      case 'api':
        return 'text-indigo-600 bg-indigo-100';
      case 'validation':
        return 'text-green-600 bg-green-100';
      case 'security':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>Error Dashboard</h1>
          <p className='text-gray-600 mt-2'>
            Monitor and manage application errors
          </p>
        </div>

        {/* Controls */}
        <div className='mb-6 flex space-x-4'>
          <select
            value={selectedTimeframe}
            onChange={e => setSelectedTimeframe(e.target.value)}
            className='px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='1h'>Last Hour</option>
            <option value='24h'>Last 24 Hours</option>
            <option value='7d'>Last 7 Days</option>
            <option value='30d'>Last 30 Days</option>
          </select>

          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className='px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='all'>All Types</option>
            <option value='javascript'>JavaScript</option>
            <option value='network'>Network</option>
            <option value='api'>API</option>
            <option value='validation'>Validation</option>
            <option value='security'>Security</option>
          </select>

          <button
            onClick={fetchErrorData}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className='grid grid-cols-1 md:grid-cols-4 gap-6 mb-8'>
            <div className='bg-white p-6 rounded-lg shadow'>
              <h3 className='text-sm font-medium text-gray-500'>
                Total Reports
              </h3>
              <p className='text-2xl font-bold text-gray-900'>
                {stats.totalReports}
              </p>
            </div>
            <div className='bg-white p-6 rounded-lg shadow'>
              <h3 className='text-sm font-medium text-gray-500'>
                Unique Errors
              </h3>
              <p className='text-2xl font-bold text-gray-900'>
                {stats.uniqueErrors}
              </p>
            </div>
            <div className='bg-white p-6 rounded-lg shadow'>
              <h3 className='text-sm font-medium text-gray-500'>
                Recent Errors
              </h3>
              <p className='text-2xl font-bold text-gray-900'>
                {stats.recentErrors}
              </p>
            </div>
            <div className='bg-white p-6 rounded-lg shadow'>
              <h3 className='text-sm font-medium text-gray-500'>Error Rate</h3>
              <p className='text-2xl font-bold text-gray-900'>
                {stats.totalReports > 0
                  ? ((stats.recentErrors / stats.totalReports) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
          </div>
        )}

        {/* Error List */}
        <div className='bg-white shadow rounded-lg'>
          <div className='px-6 py-4 border-b border-gray-200'>
            <h2 className='text-lg font-medium text-gray-900'>Recent Errors</h2>
          </div>

          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Error
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Type
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Severity
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Count
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Last Seen
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                {errors.map(error => (
                  <tr key={error.fingerprint} className='hover:bg-gray-50'>
                    <td className='px-6 py-4'>
                      <div>
                        <div className='text-sm font-medium text-gray-900'>
                          {error.sampleError.error.name}
                        </div>
                        <div className='text-sm text-gray-500 truncate max-w-xs'>
                          {error.sampleError.error.message}
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(error.classification.type)}`}
                      >
                        {error.classification.type}
                      </span>
                    </td>
                    <td className='px-6 py-4'>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(error.classification.severity)}`}
                      >
                        {error.classification.severity}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-sm text-gray-900'>
                      {error.count}
                    </td>
                    <td className='px-6 py-4 text-sm text-gray-500'>
                      {new Date(error.lastSeen).toLocaleString()}
                    </td>
                    <td className='px-6 py-4 text-sm'>
                      {!error.sampleError.resolved && (
                        <button
                          onClick={() => handleResolveError(error.fingerprint)}
                          className='text-blue-600 hover:text-blue-900 font-medium'
                        >
                          Resolve
                        </button>
                      )}
                      {error.sampleError.resolved && (
                        <span className='text-green-600 font-medium'>
                          Resolved
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errors.length === 0 && (
            <div className='text-center py-12'>
              <p className='text-gray-500'>
                No errors found for the selected timeframe.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main page component with error boundary
export default function ErrorDashboardPage() {
  return (
    <ErrorBoundary level='page'>
      <ErrorDashboard />
    </ErrorBoundary>
  );
}
