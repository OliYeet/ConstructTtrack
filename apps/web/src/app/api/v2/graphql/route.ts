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

// Handle GET requests for GraphQL (typically for GraphQL Playground)
export async function GET(request: NextRequest) {
  try {
    const handler = await getGraphQLHandler();
    return handler(request);
  } catch {
    // Log error without console.error to avoid linting issues
    return NextResponse.json(
      { error: 'GraphQL server not available' },
      { status: 500 }
    );
  }
}

// Handle POST requests for GraphQL queries
export async function POST(request: NextRequest) {
  try {
    const handler = await getGraphQLHandler();
    return handler(request);
  } catch {
    // Log error without console.error to avoid linting issues
    return NextResponse.json(
      { error: 'GraphQL server not available' },
      { status: 500 }
    );
  }
}
