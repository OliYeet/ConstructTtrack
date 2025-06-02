import Link from 'next/link';

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-blue-600 hover:text-blue-800">
                ← Back to App
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ConstructTrack API</h1>
                <p className="text-gray-600">Comprehensive API Documentation</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">v1.0.0</span>
              <a
                href="/api/v1/health"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Test API
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">API Overview</h2>
          
          <div className="prose max-w-none">
            <p className="text-lg text-gray-600 mb-6">
              The ConstructTrack API is a comprehensive RESTful API designed specifically for fiber optic 
              construction management. It provides endpoints for project management, task tracking, user 
              management, and real-time progress monitoring.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">🌐 Base URLs</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Development:</strong>
                    <code className="ml-2 bg-gray-100 px-2 py-1 rounded">
                      http://localhost:3001/api/v1
                    </code>
                  </div>
                  <div>
                    <strong>Production:</strong>
                    <code className="ml-2 bg-gray-100 px-2 py-1 rounded">
                      https://api.constructtrack.com/v1
                    </code>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">🔐 Authentication</h3>
                <div className="space-y-2 text-sm">
                  <div>• JWT Token Authentication</div>
                  <div>• API Key Authentication</div>
                  <div>• Role-based Access Control</div>
                  <div>• Rate Limiting</div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-2">🚀 Quick Test</h4>
              <p className="text-blue-800 text-sm mb-2">
                Test the API connectivity with the health check endpoint:
              </p>
              <code className="block bg-blue-100 p-2 rounded text-sm">
                curl http://localhost:3001/api/v1/health
              </code>
            </div>

            <h3 className="text-xl font-semibold mb-3">📚 Documentation Resources</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded p-4">
                <h4 className="font-semibold mb-2">📋 OpenAPI Specification</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Complete API specification in OpenAPI 3.0 format
                </p>
                <a href="/docs/api/openapi.yaml" className="text-blue-600 hover:text-blue-800 text-sm">
                  View OpenAPI Spec →
                </a>
              </div>
              <div className="border rounded p-4">
                <h4 className="font-semibold mb-2">🚀 Getting Started</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Step-by-step guide to using the API
                </p>
                <a href="/docs/api/getting-started.md" className="text-blue-600 hover:text-blue-800 text-sm">
                  Read Guide →
                </a>
              </div>
              <div className="border rounded p-4">
                <h4 className="font-semibold mb-2">🔐 Authentication</h4>
                <p className="text-sm text-gray-600 mb-2">
                  JWT tokens, API keys, and security best practices
                </p>
                <a href="/docs/api/authentication.md" className="text-blue-600 hover:text-blue-800 text-sm">
                  Learn More →
                </a>
              </div>
              <div className="border rounded p-4">
                <h4 className="font-semibold mb-2">⚠️ Error Reference</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Complete error codes and troubleshooting guide
                </p>
                <a href="/docs/api/errors.md" className="text-blue-600 hover:text-blue-800 text-sm">
                  View Errors →
                </a>
              </div>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-6">🔗 Available Endpoints</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">GET</span>
                  <code className="text-sm">/health</code>
                  <span className="text-gray-600 text-sm">System health check</span>
                </div>
                <a href="/api/v1/health" target="_blank" className="text-blue-600 hover:text-blue-800 text-xs">
                  Test →
                </a>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">GET</span>
                  <code className="text-sm">/test</code>
                  <span className="text-gray-600 text-sm">API test endpoint</span>
                </div>
                <a href="/api/v1/test" target="_blank" className="text-blue-600 hover:text-blue-800 text-xs">
                  Test →
                </a>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">POST</span>
                  <code className="text-sm">/test</code>
                  <span className="text-gray-600 text-sm">API test with validation</span>
                </div>
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">Public</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">GET</span>
                  <code className="text-sm">/projects</code>
                  <span className="text-gray-600 text-sm">List projects</span>
                </div>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">🔒 Auth Required</span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
              <h4 className="font-semibold text-yellow-900 mb-2">📖 Complete Documentation</h4>
              <p className="text-yellow-800 text-sm mb-2">
                For detailed documentation including examples, authentication guides, and error references, 
                see the markdown files in the docs/api directory.
              </p>
              <div className="flex space-x-4 text-sm">
                <a href="https://github.com/OliYeet/ConstructTtrack/tree/main/docs/api" 
                   target="_blank" 
                   className="text-yellow-700 hover:text-yellow-900 underline">
                  View on GitHub →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
