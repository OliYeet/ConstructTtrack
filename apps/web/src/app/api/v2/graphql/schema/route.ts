/**
 * GraphQL Schema Information Endpoint
 * Provides schema metadata, documentation, and examples
 */

import { buildSchema, getIntrospectionQuery, graphqlSync } from 'graphql';
import { NextRequest } from 'next/server';

import { withApiMiddleware, createSuccessResponse } from '@/lib/api';
import { typeDefs, schemaConfig } from '@/lib/graphql/schema';

// Schema info without importing server (to avoid Supabase dependency during build)
const schemaInfo = {
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

// GET /api/v2/graphql/schema - Get GraphQL schema information
export const GET = withApiMiddleware({
  GET: async (request: NextRequest) => {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'info';

    switch (format) {
      case 'sdl':
        // Return Schema Definition Language
        return createSuccessResponse({
          format: 'SDL',
          schema: typeDefs.loc?.source.body || '',
          note: 'GraphQL Schema Definition Language representation',
        });

      case 'introspection':
        // Return introspection schema
        try {
          const schema = buildSchema(typeDefs.loc?.source.body || '');
          const introspectionSchema = graphqlSync({
            schema,
            source: getIntrospectionQuery(),
          }).data;
          return createSuccessResponse({
            format: 'Introspection',
            schema: introspectionSchema,
            note: 'GraphQL introspection schema',
          });
        } catch (error) {
          return createSuccessResponse({
            error: 'Failed to generate introspection schema',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }

      case 'examples':
        // Return example queries
        return createSuccessResponse({
          format: 'Examples',
          examples: {
            queries: {
              getProjects: `
                query GetProjects($filters: [FilterInput!], $pagination: PaginationInput) {
                  projects(filters: $filters, pagination: $pagination) {
                    edges {
                      node {
                        id
                        name
                        status
                        progress
                        organization {
                          name
                        }
                        totalTasks
                        completedTasks
                      }
                    }
                    pageInfo {
                      hasNextPage
                      totalCount
                    }
                  }
                }
              `,

              getProjectDetails: `
                query GetProjectDetails($id: UUID!) {
                  project(id: $id) {
                    id
                    name
                    description
                    status
                    progress
                    startDate
                    endDate
                    budget
                    customerName
                    location
                    organization {
                      name
                    }
                    fiberRoutes {
                      id
                      name
                      fiberType
                      length
                      totalConnections
                      activeConnections
                    }
                    tasks {
                      id
                      title
                      status
                      priority
                      dueDate
                      isOverdue
                      assignee {
                        firstName
                        lastName
                      }
                    }
                  }
                }
              `,

              getTasksByProject: `
                query GetTasksByProject($projectId: UUID!, $pagination: PaginationInput) {
                  tasksByProject(projectId: $projectId, pagination: $pagination) {
                    edges {
                      node {
                        id
                        title
                        description
                        status
                        priority
                        dueDate
                        estimatedHours
                        actualHours
                        isOverdue
                        assignee {
                          firstName
                          lastName
                          email
                        }
                      }
                    }
                    pageInfo {
                      hasNextPage
                      totalCount
                    }
                  }
                }
              `,
            },

            mutations: {
              createProject: `
                mutation CreateProject($input: CreateProjectInput!) {
                  createProject(input: $input) {
                    id
                    name
                    status
                    organization {
                      name
                    }
                  }
                }
              `,

              createTask: `
                mutation CreateTask($input: CreateTaskInput!) {
                  createTask(input: $input) {
                    id
                    title
                    status
                    project {
                      name
                    }
                    assignee {
                      firstName
                      lastName
                    }
                  }
                }
              `,

              assignTask: `
                mutation AssignTask($taskId: UUID!, $assigneeId: UUID!) {
                  assignTask(taskId: $taskId, assigneeId: $assigneeId) {
                    id
                    title
                    assignee {
                      firstName
                      lastName
                      email
                    }
                  }
                }
              `,
            },

            subscriptions: {
              projectUpdates: `
                subscription ProjectUpdates($projectId: UUID!) {
                  projectUpdated(projectId: $projectId) {
                    id
                    name
                    status
                    progress
                    updatedAt
                  }
                }
              `,

              taskAssignments: `
                subscription TaskAssignments($assigneeId: UUID!) {
                  taskAssigned(assigneeId: $assigneeId) {
                    id
                    title
                    priority
                    dueDate
                    project {
                      name
                    }
                  }
                }
              `,
            },
          },

          variables: {
            createProject: {
              input: {
                name: 'Fiber Installation Project',
                description: 'Install fiber optic cables for residential area',
                startDate: '2024-01-15T00:00:00Z',
                budget: 50000,
                customerName: 'City Municipality',
                customerEmail: 'contact@city.gov',
                location: {
                  type: 'Point',
                  coordinates: [-122.4194, 37.7749],
                },
              },
            },

            createTask: {
              input: {
                projectId: '123e4567-e89b-12d3-a456-426614174000',
                title: 'Install fiber cable segment A',
                description: 'Install 500m of single-mode fiber cable',
                priority: 1,
                dueDate: '2024-01-20T00:00:00Z',
                estimatedHours: 8,
                assignedTo: '456e7890-e89b-12d3-a456-426614174001',
              },
            },
          },

          note: 'Example GraphQL operations with variables',
        });

      default:
        // Return general schema information
        return createSuccessResponse({
          message: 'GraphQL Schema Information',
          ...schemaInfo,

          usage: {
            endpoint: schemaInfo.endpoints.graphql,
            methods: ['GET', 'POST'],
            contentType: 'application/json',
            headers: {
              Authorization: 'Bearer <your-jwt-token>',
              'Content-Type': 'application/json',
            },
          },

          formats: {
            info: '?format=info - Schema information and metadata',
            sdl: '?format=sdl - Schema Definition Language',
            introspection: '?format=introspection - Introspection schema',
            examples: '?format=examples - Example queries and mutations',
          },

          tools: {
            playground: schemaInfo.endpoints.playground
              ? 'GraphQL Playground available in development'
              : 'GraphQL Playground disabled in production',
            introspection:
              process.env.NODE_ENV !== 'production'
                ? 'Schema introspection enabled'
                : 'Schema introspection disabled',
          },
        });
    }
  },
});
