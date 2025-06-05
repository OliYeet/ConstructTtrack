/**
 * GraphQL Server Configuration
 * Apollo Server setup with authentication, caching, and security
 */

import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { makeExecutableSchema } from '@graphql-tools/schema';
// TODO: Re-enable when GraphQL version conflicts are resolved
// import { GraphQLError, validate } from 'graphql';
// import costAnalysis from 'graphql-cost-analysis';
// import depthLimit from 'graphql-depth-limit';
import { applyMiddleware } from 'graphql-middleware';
import { shield, rule } from 'graphql-shield';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import { resolvers } from './resolvers';
import { typeDefs, schemaConfig } from './schema';

// import { createRequestContext } from '@/lib/api/auth'; // TODO: Re-enable when auth is fixed
import { getLogger } from '@/lib/logging';

// Rate limiter for GraphQL operations
const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
});

// Authentication rules
const isAuthenticated = rule({ cache: 'contextual' })(async (
  parent,
  args,
  context
) => {
  return !!context.user;
});

const isAdmin = rule({ cache: 'contextual' })(async (parent, args, context) => {
  return context.user?.role === 'admin';
});

const isManager = rule({ cache: 'contextual' })(async (
  parent,
  args,
  context
) => {
  return ['admin', 'manager'].includes(context.user?.role);
});

// const isOwnerOrManager = rule({ cache: 'contextual' })(
//   async (parent, args, context) => {
//     // This would need to check if the user owns the resource or is a manager
//     return ['admin', 'manager'].includes(context.user?.role);
//   }
// );

// Permission shield
const permissions = shield(
  {
    Query: {
      // Public queries (no authentication required)
      '*': isAuthenticated,

      // Admin-only queries
      organizations: isAdmin,
      organizationAnalytics: isManager,
    },

    Mutation: {
      // All mutations require authentication
      '*': isAuthenticated,

      // Admin-only mutations
      deleteProject: isManager,

      // Manager-only mutations
      assignTask: isManager,
      assignEquipment: isManager,
    },

    Subscription: {
      '*': isAuthenticated,
    },
  },
  {
    allowExternalErrors: true,
    fallbackError: 'Access denied',
  }
);

// Rate limiting middleware
const rateLimitMiddleware = async (
  resolve: any,
  root: any,
  args: any,
  context: any,
  info: any
) => {
  try {
    await rateLimiter.consume(context.user?.id || context.ip);
    return resolve(root, args, context, info);
  } catch {
    throw new Error('Rate limit exceeded');
  }
};

// Logging middleware
const loggingMiddleware = async (
  resolve: any,
  root: any,
  args: any,
  context: any,
  info: any
) => {
  const logger = getLogger();
  const start = Date.now();

  try {
    const result = await resolve(root, args, context, info);
    const duration = Date.now() - start;

    logger.info('GraphQL operation completed', {
      operationType: info.operation.operation,
      operationName: info.operation.name?.value,
      fieldName: info.fieldName,
      duration,
      userId: context.user?.id,
    } as any);

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    logger.error('GraphQL operation failed', {
      operationType: info.operation.operation,
      operationName: info.operation.name?.value,
      fieldName: info.fieldName,
      duration,
      userId: context.user?.id,
      error: error instanceof Error ? error.message : String(error),
    } as any);

    throw error;
  }
};

// Create executable schema with middleware
const baseSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const schemaWithMiddleware = applyMiddleware(
  baseSchema,
  permissions,
  rateLimitMiddleware,
  loggingMiddleware
);

// Apollo Server configuration
const server = new ApolloServer({
  schema: schemaWithMiddleware,
  introspection: schemaConfig.introspection,
  plugins: [
    // Depth limiting - TODO: Re-enable when GraphQL version conflicts are resolved
    // {
    //   async requestDidStart() {
    //     return {
    //       async didResolveOperation({ request: _request, document }) {
    //         const depthLimitRule = depthLimit(schemaConfig.limits.maxDepth);
    //         const errors = validate(baseSchema, document, [depthLimitRule]);
    //         if (errors.length > 0) {
    //           throw new GraphQLError(
    //             `Query depth limit of ${schemaConfig.limits.maxDepth} exceeded`
    //           );
    //         }
    //       },
    //     };
    //   },
    // },

    // Query complexity analysis - TODO: Re-enable when GraphQL version conflicts are resolved
    // {
    //   async requestDidStart() {
    //     return {
    //       async didResolveOperation({ request: _request, document }) {
    //         const complexityRule = costAnalysis({
    //           maximumCost: schemaConfig.limits.maxComplexity,
    //           defaultCost: 1,
    //           scalarCost: 1,
    //           objectCost: 2,
    //           listFactor: 10,
    //           introspectionCost: 1000,
    //         });

    //         const errors = validate(baseSchema, document, [complexityRule]);
    //         if (errors.length > 0) {
    //           throw new GraphQLError(
    //             `Query complexity limit of ${schemaConfig.limits.maxComplexity} exceeded`
    //           );
    //         }
    //       },
    //     };
    //   },
    // },

    // Request timeout - TODO: Implement proper timeout handling
    // {
    //   async requestDidStart() {
    //     return {
    //       async willSendResponse(_requestContext) {
    //         const timeout = setTimeout(() => {
    //           throw new Error('Query timeout exceeded');
    //         }, schemaConfig.limits.timeout);

    //         return () => clearTimeout(timeout);
    //       },
    //     };
    //   },
    // },
  ],

  formatError: error => {
    const logger = getLogger();
    logger.error('GraphQL error', {
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions: error.extensions,
    });

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && !error.extensions?.code) {
      return new Error('Internal server error');
    }

    return error;
  },
});

// Create Next.js handler
export const graphqlHandler = startServerAndCreateNextHandler(server, {
  context: async (req, res) => {
    try {
      // Simple context creation without auth middleware for now
      // TODO: Implement proper authentication for GraphQL
      const requestId = `gql_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      return {
        req,
        res,
        user: null, // TODO: Extract from JWT token
        organizationId: null,
        requestId,
        ip:
          req.headers['x-forwarded-for'] ||
          req.headers['x-real-ip'] ||
          'unknown',
      };
    } catch (error) {
      const logger = getLogger();
      logger.error('Failed to create GraphQL context', error);

      return {
        req,
        res,
        user: null,
        organizationId: null,
        requestId: 'unknown',
        ip:
          req.headers['x-forwarded-for'] ||
          req.headers['x-real-ip'] ||
          'unknown',
      };
    }
  },
});

// GraphQL schema information
export const schemaInfo = {
  version: schemaConfig.version,
  features: schemaConfig.features,
  limits: schemaConfig.limits,
  endpoints: {
    graphql: '/api/v2/graphql',
    playground: schemaConfig.playground ? '/api/v2/graphql' : null,
    subscriptions: schemaConfig.features.subscriptions
      ? '/api/v2/subscriptions'
      : null,
  },
  documentation: {
    schema: 'Auto-generated from GraphQL introspection',
    examples: '/docs/graphql/examples',
    playground: schemaConfig.playground
      ? 'Available in development mode'
      : 'Disabled in production',
  },
};

// Export server for testing
export { server };
