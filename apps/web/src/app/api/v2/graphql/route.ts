/**
 * GraphQL API Endpoint - v2
 * Apollo Server integration with Next.js App Router
 */

import { graphqlHandler } from '@/lib/graphql/server';

// Handle all HTTP methods for GraphQL
export { graphqlHandler as GET, graphqlHandler as POST };
