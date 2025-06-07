/**
 * Projects API Route
 * CRUD operations for project management
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/api/middleware';
import {
  createCreatedResponse,
  createPaginatedResponse,
} from '@/lib/api/response';
import { validateRequestBody, validateQueryParams } from '@/lib/api/validation';
import { constructTrackSchemas, commonSchemas } from '@/lib/api/validation';

// Project response interface
interface ProjectResponse {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  managerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Query parameters schema for listing projects
const listProjectsSchema = z.object({
  ...commonSchemas.pagination.shape,
  status: z
    .enum(['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'])
    .optional(),
  managerId: commonSchemas.uuid.optional(),
  search: z.string().max(100).optional(),
  sortBy: z
    .enum(['created_at', 'name', 'status', 'start_date', 'end_date'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Database row interface
interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: string | number | null;
  manager_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  location: {
    coordinates: [number, number];
  } | null;
  created_at: string;
  updated_at: string;
}

// Transform database row to API response
function transformProject(row: ProjectRow): ProjectResponse {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description || undefined,
    status: row.status,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    budget: row.budget ? parseFloat(String(row.budget)) : undefined,
    managerId: row.manager_id || undefined,
    customerName: row.customer_name || undefined,
    customerEmail: row.customer_email || undefined,
    customerPhone: row.customer_phone || undefined,
    customerAddress: row.customer_address || undefined,
    location: row.location
      ? {
          latitude: row.location.coordinates[1],
          longitude: row.location.coordinates[0],
        }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/v1/projects - List projects
async function handleGet(
  request: NextRequest,

  _: { params: Record<string, string> }
) {
  const context = (
    request as NextRequest & {
      context: { requestId: string; organizationId: string };
    }
  ).context;
  const queryParams = validateQueryParams(request, listProjectsSchema);

  // Dynamically import Supabase client
  const { supabase } = await import('@constructtrack/supabase/client');

  // Build query
  // Ensure we have a valid organization context before querying
  if (!context.organizationId) {
    throw new Error('Organization context is required');
  }

  let query = supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('organization_id', context.organizationId);

  // Apply filters
  if (queryParams.status) {
    query = query.eq('status', queryParams.status);
  }

  if (queryParams.managerId) {
    query = query.eq('manager_id', queryParams.managerId);
  }

  if (queryParams.search) {
    const term = `%${queryParams.search}%`;
    query = query.or(`name.ilike.${term},description.ilike.${term}`);
  }

  // Apply sorting with validated column
  const sortColumn = queryParams.sortBy || 'created_at';
  const sortOrder = queryParams.sortOrder || 'desc';
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

  // Apply pagination
  const page = queryParams.page || 1;
  const limit = queryParams.limit || 10;
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  const projects = data?.map(row => transformProject(row as ProjectRow)) || [];

  return createPaginatedResponse(
    projects,
    count || 0,
    page,
    limit,
    'Projects retrieved successfully',
    context.requestId
  );
}

// POST /api/v1/projects - Create project
async function handlePost(
  request: NextRequest,

  _: { params: Record<string, string> }
) {
  const context = (
    request as NextRequest & {
      context: { requestId: string; organizationId: string };
    }
  ).context;
  const projectData = await validateRequestBody(
    request,
    constructTrackSchemas.createProject
  );

  // Dynamically import Supabase client
  const { supabase } = await import('@constructtrack/supabase/client');

  // Ensure we have a valid organization context before inserting
  if (!context.organizationId) {
    throw new Error('Organization context is required for project creation');
  }

  // Prepare data for insertion
  const insertData = {
    organization_id: context.organizationId,
    name: projectData.name,
    description: projectData.description || null,
    start_date: projectData.startDate || null,
    end_date: projectData.endDate || null,
    budget: projectData.budget || null,
    customer_name: projectData.customerName || null,
    customer_email: projectData.customerEmail || null,
    customer_phone: projectData.customerPhone || null,
    customer_address: projectData.customerAddress || null,
    location: null as string | null,
  };

  // Handle location if provided
  if (projectData.location) {
    insertData.location = `POINT(${projectData.location.longitude} ${projectData.location.latitude})`;
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }

  const project = transformProject(data as ProjectRow);

  return createCreatedResponse(
    project,
    'Project created successfully',
    context.requestId
  );
}

// Export route handlers with authentication middleware
export const GET = withAuth(
  {
    GET: handleGet,
  },
  {
    requireRoles: ['admin', 'manager', 'field_worker'], // All authenticated users can list projects
  }
);

export const POST = withAuth(
  {
    POST: handlePost,
  },
  {
    requireRoles: ['admin', 'manager'], // Only managers and admins can create projects
  }
);
