/**
 * GraphQL API Endpoint - v2
 * Apollo Server integration with Next.js App Router
 */

import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to avoid Supabase initialization during build
async function getGraphQLHandler() {
  const { graphqlHandler } = await import('@/lib/graphql/server');
  return graphqlHandler;
}
// Shared handler implementation
async function handleGraphQLRequest(request: NextRequest) {
  try {
    const handler = await getGraphQLHandler();
    return handler(request);
  } catch (error) {
    // Use a proper logging solution instead of console.error
    // Consider using your application's logging framework here
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'GraphQL server not available',
        message:
          process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

// Handle GET requests for GraphQL (typically for GraphQL Playground)
export async function GET(request: NextRequest) {
  return handleGraphQLRequest(request);
}

// Handle POST requests for GraphQL queries
export async function POST(request: NextRequest) {
  return handleGraphQLRequest(request);
}
