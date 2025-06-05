/**
 * GraphQL Resolvers for ConstructTrack API
 * Comprehensive resolvers for all schema types and operations
 */

import { supabase } from '@constructtrack/supabase/client';
import { GraphQLScalarType, Kind } from 'graphql';
import { GraphQLError } from 'graphql';

// Custom scalar resolvers
export const scalarResolvers = {
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'Date custom scalar type',
    serialize(value: any) {
      return value instanceof Date ? value.toISOString() : value;
    },
    parseValue(value: any) {
      return new Date(value);
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return new Date(ast.value);
      }
      return null;
    },
  }),

  JSON: new GraphQLScalarType({
    name: 'JSON',
    description: 'JSON custom scalar type',
    serialize(value: any) {
      return value;
    },
    parseValue(value: any) {
      return value;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        try {
          return JSON.parse(ast.value);
        } catch {
          return null;
        }
      }
      return null;
    },
  }),

  UUID: new GraphQLScalarType({
    name: 'UUID',
    description: 'UUID custom scalar type',
    serialize(value: any) {
      return value;
    },
    parseValue(value: any) {
      return value;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return ast.value;
      }
      return null;
    },
  }),

  Geometry: new GraphQLScalarType({
    name: 'Geometry',
    description: 'PostGIS Geometry custom scalar type',
    serialize(value: any) {
      return value;
    },
    parseValue(value: any) {
      return value;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        try {
          return JSON.parse(ast.value);
        } catch {
          return null;
        }
      }
      return null;
    },
  }),
};

// Helper functions
const requireAuth = (context: any) => {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
};

// const requireRole = (context: any, roles: string[]) => {
// const user = requireAuth(context);
// if (!roles.includes(user.role)) {
//   throw new GraphQLError('Insufficient permissions', {
//     extensions: { code: 'FORBIDDEN' },
//   });
// }
// return user;
// };

const buildFilters = (filters: any[] = []) => {
  const conditions: any = {};
  filters.forEach(filter => {
    const { field, operator, value } = filter;
    switch (operator) {
      case 'eq':
        conditions[field] = { eq: value };
        break;
      case 'neq':
        conditions[field] = { neq: value };
        break;
      case 'gt':
        conditions[field] = { gt: value };
        break;
      case 'gte':
        conditions[field] = { gte: value };
        break;
      case 'lt':
        conditions[field] = { lt: value };
        break;
      case 'lte':
        conditions[field] = { lte: value };
        break;
      case 'like':
        conditions[field] = { like: `%${value}%` };
        break;
      case 'in':
        conditions[field] = { in: value.split(',') };
        break;
    }
  });
  return conditions;
};

const buildSort = (sort: any[] = []) => {
  return sort.map(s => ({ column: s.field, ascending: s.direction === 'ASC' }));
};

const buildPagination = (pagination: any = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;
  return { offset, limit };
};

// Query resolvers
export const queryResolvers = {
  // Organization queries
  organization: async (_: any, { id }: any, context: any) => {
    requireAuth(context);

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  organizations: async (
    _: any,
    { filters, sort, pagination }: any,
    context: any
  ) => {
    requireAuth(context);

    const conditions = buildFilters(filters);
    const sorting = buildSort(sort);
    const { offset, limit } = buildPagination(pagination);

    let query = supabase.from('organizations').select('*', { count: 'exact' });

    // Apply filters
    Object.entries(conditions).forEach(([field, condition]: [string, any]) => {
      Object.entries(condition).forEach(([op, value]) => {
        query = query.filter(field, op, value);
      });
    });

    // Apply sorting
    sorting.forEach(({ column, ascending }) => {
      query = query.order(column, { ascending });
    });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw new GraphQLError(error.message);

    return {
      edges:
        data?.map((node, index) => ({
          node,
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
        })) || [],
      pageInfo: {
        hasNextPage: offset + limit < (count || 0),
        hasPreviousPage: offset > 0,
        startCursor: data?.length
          ? Buffer.from(`${offset}`).toString('base64')
          : null,
        endCursor: data?.length
          ? Buffer.from(`${offset + data.length - 1}`).toString('base64')
          : null,
        totalCount: count || 0,
      },
    };
  },

  // Project queries
  project: async (_: any, { id }: any, context: any) => {
    requireAuth(context);

    const { data, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        organization:organizations(*),
        fiber_routes(*),
        tasks(*),
        photos(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  projects: async (
    _: any,
    { filters, sort, pagination }: any,
    context: any
  ) => {
    requireAuth(context);

    const conditions = buildFilters(filters);
    const sorting = buildSort(sort);
    const { offset, limit } = buildPagination(pagination);

    let query = supabase
      .from('projects')
      .select('*, organization:organizations(*)', { count: 'exact' });

    // Apply filters
    Object.entries(conditions).forEach(([field, condition]: [string, any]) => {
      Object.entries(condition).forEach(([op, value]) => {
        query = query.filter(field, op, value);
      });
    });

    // Apply sorting
    sorting.forEach(({ column, ascending }) => {
      query = query.order(column, { ascending });
    });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw new GraphQLError(error.message);

    return {
      edges:
        data?.map((node, index) => ({
          node,
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
        })) || [],
      pageInfo: {
        hasNextPage: offset + limit < (count || 0),
        hasPreviousPage: offset > 0,
        startCursor: data?.length
          ? Buffer.from(`${offset}`).toString('base64')
          : null,
        endCursor: data?.length
          ? Buffer.from(`${offset + data.length - 1}`).toString('base64')
          : null,
        totalCount: count || 0,
      },
    };
  },

  // Task queries
  task: async (_: any, { id }: any, context: any) => {
    requireAuth(context);

    const { data, error } = await supabase
      .from('tasks')
      .select(
        `
        *,
        project:projects(*),
        assignee:profiles(*),
        photos(*),
        time_entries(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  tasksByProject: async (
    _: any,
    { projectId, pagination }: any,
    context: any
  ) => {
    requireAuth(context);

    const { offset, limit } = buildPagination(pagination);

    const { data, error, count } = await supabase
      .from('tasks')
      .select('*, assignee:profiles(*)', { count: 'exact' })
      .eq('project_id', projectId)
      .range(offset, offset + limit - 1);

    if (error) throw new GraphQLError(error.message);

    return {
      edges:
        data?.map((node, index) => ({
          node,
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
        })) || [],
      pageInfo: {
        hasNextPage: offset + limit < (count || 0),
        hasPreviousPage: offset > 0,
        startCursor: data?.length
          ? Buffer.from(`${offset}`).toString('base64')
          : null,
        endCursor: data?.length
          ? Buffer.from(`${offset + data.length - 1}`).toString('base64')
          : null,
        totalCount: count || 0,
      },
    };
  },

  // Equipment queries
  equipment: async (_: any, { id }: any, context: any) => {
    requireAuth(context);

    const { data, error } = await supabase
      .from('equipment')
      .select(
        `
        *,
        organization:organizations(*),
        assignee:profiles(*),
        assignments:equipment_assignments(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  availableEquipment: async (_: any, { pagination }: any, context: any) => {
    requireAuth(context);

    const { offset, limit } = buildPagination(pagination);

    const { data, error, count } = await supabase
      .from('equipment')
      .select('*', { count: 'exact' })
      .eq('status', 'available')
      .range(offset, offset + limit - 1);

    if (error) throw new GraphQLError(error.message);

    return {
      edges:
        data?.map((node, index) => ({
          node,
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
        })) || [],
      pageInfo: {
        hasNextPage: offset + limit < (count || 0),
        hasPreviousPage: offset > 0,
        startCursor: data?.length
          ? Buffer.from(`${offset}`).toString('base64')
          : null,
        endCursor: data?.length
          ? Buffer.from(`${offset + data.length - 1}`).toString('base64')
          : null,
        totalCount: count || 0,
      },
    };
  },
};

// Mutation resolvers
export const mutationResolvers = {
  // Project mutations
  createProject: async (_: any, { input }: any, context: any) => {
    const user = requireAuth(context);

    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...input,
        organization_id: user.organization_id,
      })
      .select('*, organization:organizations(*)')
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  updateProject: async (_: any, { id, input }: any, context: any) => {
    requireAuth(context);

    const { data, error } = await supabase
      .from('projects')
      .update(input)
      .eq('id', id)
      .select('*, organization:organizations(*)')
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  deleteProject: async (_: any, { id }: any, context: any) => {
    requireAuth(context);

    const { error } = await supabase.from('projects').delete().eq('id', id);

    if (error) throw new GraphQLError(error.message);
    return true;
  },

  // Task mutations
  createTask: async (_: any, { input }: any, context: any) => {
    requireAuth(context);

    const { data, error } = await supabase
      .from('tasks')
      .insert(input)
      .select(
        `
        *,
        project:projects(*),
        assignee:profiles(*)
      `
      )
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  updateTask: async (_: any, { id, input }: any, context: any) => {
    requireAuth(context);

    const { data, error } = await supabase
      .from('tasks')
      .update(input)
      .eq('id', id)
      .select(
        `
        *,
        project:projects(*),
        assignee:profiles(*)
      `
      )
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  assignTask: async (_: any, { taskId, assigneeId }: any, context: any) => {
    requireAuth(context);

    const { data, error } = await supabase
      .from('tasks')
      .update({ assigned_to: assigneeId })
      .eq('id', taskId)
      .select(
        `
        *,
        project:projects(*),
        assignee:profiles(*)
      `
      )
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  // Equipment mutations
  assignEquipment: async (
    _: any,
    { equipmentId, assigneeId, notes }: any,
    context: any
  ) => {
    const user = requireAuth(context);

    // Create assignment record
    const { data: assignment, error: assignmentError } = await supabase
      .from('equipment_assignments')
      .insert({
        equipment_id: equipmentId,
        assigned_to: assigneeId,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        notes,
      })
      .select(
        `
        *,
        equipment:equipment(*),
        assignee:profiles(*),
        assigner:profiles(*)
      `
      )
      .single();

    if (assignmentError) throw new GraphQLError(assignmentError.message);

    // Update equipment status
    const { error: updateError } = await supabase
      .from('equipment')
      .update({
        status: 'in_use',
        assigned_to: assigneeId,
      })
      .eq('id', equipmentId);

    if (updateError) throw new GraphQLError(updateError.message);

    return assignment;
  },

  returnEquipment: async (
    _: any,
    { assignmentId, notes }: any,
    context: any
  ) => {
    requireAuth(context);

    // Get assignment details
    const { data: assignment, error: getError } = await supabase
      .from('equipment_assignments')
      .select('*, equipment:equipment(*)')
      .eq('id', assignmentId)
      .single();

    if (getError) throw new GraphQLError(getError.message);

    // Update assignment record
    const { data: updatedAssignment, error: updateAssignmentError } =
      await supabase
        .from('equipment_assignments')
        .update({
          returned_at: new Date().toISOString(),
          notes: notes || assignment.notes,
        })
        .eq('id', assignmentId)
        .select(
          `
        *,
        equipment:equipment(*),
        assignee:profiles(*),
        assigner:profiles(*)
      `
        )
        .single();

    if (updateAssignmentError)
      throw new GraphQLError(updateAssignmentError.message);

    // Update equipment status
    const { error: updateEquipmentError } = await supabase
      .from('equipment')
      .update({
        status: 'available',
        assigned_to: null,
      })
      .eq('id', assignment.equipment_id);

    if (updateEquipmentError)
      throw new GraphQLError(updateEquipmentError.message);

    return updatedAssignment;
  },

  // Time tracking mutations
  startTimeEntry: async (
    _: any,
    { taskId, projectId, description }: any,
    context: any
  ) => {
    const user = requireAuth(context);

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        profile_id: user.id,
        task_id: taskId,
        project_id: projectId,
        start_time: new Date().toISOString(),
        description,
      })
      .select(
        `
        *,
        profile:profiles(*),
        task:tasks(*),
        project:projects(*)
      `
      )
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },

  stopTimeEntry: async (_: any, { id }: any, context: any) => {
    requireAuth(context);

    const endTime = new Date();

    // Get the time entry to calculate duration
    const { data: timeEntry, error: getError } = await supabase
      .from('time_entries')
      .select('start_time')
      .eq('id', id)
      .single();

    if (getError) throw new GraphQLError(getError.message);

    const startTime = new Date(timeEntry.start_time);
    const duration =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        end_time: endTime.toISOString(),
        duration,
      })
      .eq('id', id)
      .select(
        `
        *,
        profile:profiles(*),
        task:tasks(*),
        project:projects(*)
      `
      )
      .single();

    if (error) throw new GraphQLError(error.message);
    return data;
  },
};

// Field resolvers for computed fields
export const fieldResolvers = {
  Project: {
    progress: async (parent: any) => {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('project_id', parent.id);

      if (!tasks || tasks.length === 0) return 0;

      const completedTasks = tasks.filter(
        task => task.status === 'completed'
      ).length;
      return (completedTasks / tasks.length) * 100;
    },

    totalTasks: async (parent: any) => {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', parent.id);

      return count || 0;
    },

    completedTasks: async (parent: any) => {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', parent.id)
        .eq('status', 'completed');

      return count || 0;
    },
  },

  Task: {
    isOverdue: (parent: any) => {
      if (!parent.due_date) return false;
      return (
        new Date(parent.due_date) < new Date() && parent.status !== 'completed'
      );
    },

    hoursRemaining: (parent: any) => {
      if (!parent.estimated_hours || !parent.actual_hours)
        return parent.estimated_hours || 0;
      return Math.max(0, parent.estimated_hours - parent.actual_hours);
    },
  },

  FiberRoute: {
    totalConnections: async (parent: any) => {
      const { count } = await supabase
        .from('fiber_connections')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', parent.id);

      return count || 0;
    },

    activeConnections: async (parent: any) => {
      const { count } = await supabase
        .from('fiber_connections')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', parent.id)
        .eq('status', 'active');

      return count || 0;
    },
  },
};

// Subscription resolvers
export const subscriptionResolvers = {
  projectUpdated: {
    subscribe: async function* (_: any, { projectId }: any, context: any) {
      requireAuth(context);

      // This would typically use a real-time subscription service
      // For now, we'll use a simple polling mechanism
      while (true) {
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        yield { projectUpdated: data };
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      }
    },
  },

  taskAssigned: {
    subscribe: async function* (_: any, { assigneeId }: any, context: any) {
      requireAuth(context);

      // Real-time subscription for task assignments
      while (true) {
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', assigneeId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        yield { taskAssigned: data };
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    },
  },
};

// Complete resolvers object
export const resolvers = {
  ...scalarResolvers,
  Query: queryResolvers,
  Mutation: mutationResolvers,
  Subscription: subscriptionResolvers,
  ...fieldResolvers,
};
