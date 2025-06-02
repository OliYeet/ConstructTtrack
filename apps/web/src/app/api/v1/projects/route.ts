/**
 * Projects API Route
 * CRUD operations for project management
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { createSuccessResponse, createCreatedResponse, createPaginatedResponse } from '@/lib/api/response';
import { validateRequestBody, validateQueryParams, extractPaginationParams } from '@/lib/api/validation';
import { constructTrackSchemas, commonSchemas } from '@/lib/api/validation';
import { NotFoundError, ValidationError } from '@/lib/errors/api-errors';
import { z } from 'zod';

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
  status: z.enum(['planning', 'in_progress', 'completed', 'on_hold', 'cancelled']).optional(),
  managerId: commonSchemas.uuid.optional(),
  search: z.string().max(100).optional(),
});

// Transform database row to API response
function transformProject(row: any): ProjectResponse {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    budget: row.budget ? parseFloat(row.budget) : undefined,
    managerId: row.manager_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    location: row.location ? {
      latitude: row.location.coordinates[1],
      longitude: row.location.coordinates[0],
    } : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/v1/projects - List projects
async function handleGet(request: NextRequest) {
  const context = request.context!;
  const queryParams = validateQueryParams(request, listProjectsSchema);

  // Dynamically import Supabase client
  const { supabase } = await import('@constructtrack/supabase/client');

  // Build query
  let query = supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('organization_id', context.organizationId!);
  
  // Apply filters
  if (queryParams.status) {
    query = query.eq('status', queryParams.status);
  }
  
  if (queryParams.managerId) {
    query = query.eq('manager_id', queryParams.managerId);
  }
  
  if (queryParams.search) {
    query = query.or(`name.ilike.%${queryParams.search}%,description.ilike.%${queryParams.search}%`);
  }
  
  // Apply sorting
  const sortColumn = queryParams.sortBy || 'created_at';
  const sortOrder = queryParams.sortOrder || 'desc';
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' });
  
  // Apply pagination
  const offset = (queryParams.page - 1) * queryParams.limit;
  query = query.range(offset, offset + queryParams.limit - 1);
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
  
  const projects = data?.map(transformProject) || [];
  
  return createPaginatedResponse(
    projects,
    count || 0,
    queryParams.page,
    queryParams.limit,
    'Projects retrieved successfully',
    context.requestId
  );
}

// POST /api/v1/projects - Create project
async function handlePost(request: NextRequest) {
  const context = request.context!;
  const projectData = await validateRequestBody(request, constructTrackSchemas.createProject);

  // Dynamically import Supabase client
  const { supabase } = await import('@constructtrack/supabase/client');

  // Prepare data for insertion
  const insertData: any = {
    organization_id: context.organizationId,
    name: projectData.name,
    description: projectData.description,
    start_date: projectData.startDate,
    end_date: projectData.endDate,
    budget: projectData.budget,
    customer_name: projectData.customerName,
    customer_email: projectData.customerEmail,
    customer_phone: projectData.customerPhone,
    customer_address: projectData.customerAddress,
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
  
  const project = transformProject(data);
  
  return createCreatedResponse(
    project,
    'Project created successfully',
    context.requestId
  );
}

// Export route handlers with authentication middleware
export const GET = withAuth({
  GET: handleGet,
}, {
  requireRoles: ['admin', 'manager', 'field_worker'], // All authenticated users can list projects
});

export const POST = withAuth({
  POST: handlePost,
}, {
  requireRoles: ['admin', 'manager'], // Only managers and admins can create projects
});
