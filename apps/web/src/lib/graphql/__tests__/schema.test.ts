/**
 * GraphQL Schema Tests
 * Tests the GraphQL schema definition and structure
 */

import { buildSchema, validateSchema } from 'graphql';
import { typeDefs, schemaConfig } from '../schema';

describe('GraphQL Schema', () => {
  let schema: any;

  beforeAll(() => {
    try {
      schema = buildSchema(typeDefs.loc?.source.body || '');
    } catch (error) {
      console.error('Failed to build schema:', error);
      throw error;
    }
  });

  describe('Schema Validation', () => {
    it('should be a valid GraphQL schema', () => {
      const errors = validateSchema(schema);
      expect(errors).toHaveLength(0);
    });

    it('should have required root types', () => {
      expect(schema.getQueryType()).toBeDefined();
      expect(schema.getMutationType()).toBeDefined();
      expect(schema.getSubscriptionType()).toBeDefined();
    });
  });

  describe('Custom Scalars', () => {
    it('should define DateTime scalar', () => {
      const dateTimeType = schema.getType('DateTime');
      expect(dateTimeType).toBeDefined();
      expect(dateTimeType.name).toBe('DateTime');
    });

    it('should define JSON scalar', () => {
      const jsonType = schema.getType('JSON');
      expect(jsonType).toBeDefined();
      expect(jsonType.name).toBe('JSON');
    });

    it('should define UUID scalar', () => {
      const uuidType = schema.getType('UUID');
      expect(uuidType).toBeDefined();
      expect(uuidType.name).toBe('UUID');
    });

    it('should define Geometry scalar', () => {
      const geometryType = schema.getType('Geometry');
      expect(geometryType).toBeDefined();
      expect(geometryType.name).toBe('Geometry');
    });
  });

  describe('Enums', () => {
    it('should define UserRole enum', () => {
      const userRoleType = schema.getType('UserRole');
      expect(userRoleType).toBeDefined();
      expect(userRoleType.getValues().map((v: any) => v.name)).toEqual([
        'ADMIN',
        'MANAGER',
        'FIELD_WORKER',
        'CUSTOMER',
      ]);
    });

    it('should define ProjectStatus enum', () => {
      const projectStatusType = schema.getType('ProjectStatus');
      expect(projectStatusType).toBeDefined();
      expect(projectStatusType.getValues().map((v: any) => v.name)).toEqual([
        'PLANNING',
        'IN_PROGRESS',
        'COMPLETED',
        'ON_HOLD',
        'CANCELLED',
      ]);
    });

    it('should define TaskStatus enum', () => {
      const taskStatusType = schema.getType('TaskStatus');
      expect(taskStatusType).toBeDefined();
      expect(taskStatusType.getValues().map((v: any) => v.name)).toEqual([
        'NOT_STARTED',
        'IN_PROGRESS',
        'COMPLETED',
        'BLOCKED',
      ]);
    });
  });

  describe('Core Types', () => {
    it('should define Organization type with required fields', () => {
      const organizationType = schema.getType('Organization');
      expect(organizationType).toBeDefined();

      const fields = organizationType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.name).toBeDefined();
      expect(fields.slug).toBeDefined();
      expect(fields.createdAt).toBeDefined();
      expect(fields.updatedAt).toBeDefined();
      expect(fields.profiles).toBeDefined();
      expect(fields.projects).toBeDefined();
    });

    it('should define Project type with required fields', () => {
      const projectType = schema.getType('Project');
      expect(projectType).toBeDefined();

      const fields = projectType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.name).toBeDefined();
      expect(fields.status).toBeDefined();
      expect(fields.organization).toBeDefined();
      expect(fields.tasks).toBeDefined();
      expect(fields.progress).toBeDefined();
      expect(fields.totalTasks).toBeDefined();
      expect(fields.completedTasks).toBeDefined();
    });

    it('should define Task type with required fields', () => {
      const taskType = schema.getType('Task');
      expect(taskType).toBeDefined();

      const fields = taskType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.title).toBeDefined();
      expect(fields.status).toBeDefined();
      expect(fields.project).toBeDefined();
      expect(fields.isOverdue).toBeDefined();
    });

    it('should define FiberRoute type with required fields', () => {
      const fiberRouteType = schema.getType('FiberRoute');
      expect(fiberRouteType).toBeDefined();

      const fields = fiberRouteType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.name).toBeDefined();
      expect(fields.fiberType).toBeDefined();
      expect(fields.geometry).toBeDefined();
      expect(fields.project).toBeDefined();
      expect(fields.connections).toBeDefined();
    });

    it('should define Equipment type with required fields', () => {
      const equipmentType = schema.getType('Equipment');
      expect(equipmentType).toBeDefined();

      const fields = equipmentType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.name).toBeDefined();
      expect(fields.type).toBeDefined();
      expect(fields.status).toBeDefined();
      expect(fields.organization).toBeDefined();
    });
  });

  describe('Query Type', () => {
    it('should define organization queries', () => {
      const queryType = schema.getQueryType();
      const fields = queryType.getFields();

      expect(fields.organization).toBeDefined();
      expect(fields.organizations).toBeDefined();
    });

    it('should define project queries', () => {
      const queryType = schema.getQueryType();
      const fields = queryType.getFields();

      expect(fields.project).toBeDefined();
      expect(fields.projects).toBeDefined();
      expect(fields.projectsByStatus).toBeDefined();
    });

    it('should define task queries', () => {
      const queryType = schema.getQueryType();
      const fields = queryType.getFields();

      expect(fields.task).toBeDefined();
      expect(fields.tasks).toBeDefined();
      expect(fields.tasksByProject).toBeDefined();
      expect(fields.tasksByAssignee).toBeDefined();
    });

    it('should define analytics queries', () => {
      const queryType = schema.getQueryType();
      const fields = queryType.getFields();

      expect(fields.projectAnalytics).toBeDefined();
      expect(fields.organizationAnalytics).toBeDefined();
      expect(fields.taskAnalytics).toBeDefined();
    });
  });

  describe('Mutation Type', () => {
    it('should define project mutations', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType.getFields();

      expect(fields.createProject).toBeDefined();
      expect(fields.updateProject).toBeDefined();
      expect(fields.deleteProject).toBeDefined();
    });

    it('should define task mutations', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType.getFields();

      expect(fields.createTask).toBeDefined();
      expect(fields.updateTask).toBeDefined();
      expect(fields.deleteTask).toBeDefined();
      expect(fields.assignTask).toBeDefined();
    });

    it('should define equipment mutations', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType.getFields();

      expect(fields.assignEquipment).toBeDefined();
      expect(fields.returnEquipment).toBeDefined();
    });

    it('should define time tracking mutations', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType.getFields();

      expect(fields.startTimeEntry).toBeDefined();
      expect(fields.stopTimeEntry).toBeDefined();
    });
  });

  describe('Subscription Type', () => {
    it('should define real-time subscriptions', () => {
      const subscriptionType = schema.getSubscriptionType();
      const fields = subscriptionType.getFields();

      expect(fields.projectUpdated).toBeDefined();
      expect(fields.taskUpdated).toBeDefined();
      expect(fields.taskAssigned).toBeDefined();
      expect(fields.equipmentStatusChanged).toBeDefined();
      expect(fields.organizationActivity).toBeDefined();
    });
  });

  describe('Input Types', () => {
    it('should define CreateProjectInput', () => {
      const inputType = schema.getType('CreateProjectInput');
      expect(inputType).toBeDefined();

      const fields = inputType.getFields();
      expect(fields.name).toBeDefined();
      expect(fields.description).toBeDefined();
      expect(fields.startDate).toBeDefined();
      expect(fields.budget).toBeDefined();
    });

    it('should define CreateTaskInput', () => {
      const inputType = schema.getType('CreateTaskInput');
      expect(inputType).toBeDefined();

      const fields = inputType.getFields();
      expect(fields.projectId).toBeDefined();
      expect(fields.title).toBeDefined();
      expect(fields.description).toBeDefined();
    });

    it('should define FilterInput', () => {
      const inputType = schema.getType('FilterInput');
      expect(inputType).toBeDefined();

      const fields = inputType.getFields();
      expect(fields.field).toBeDefined();
      expect(fields.operator).toBeDefined();
      expect(fields.value).toBeDefined();
    });
  });

  describe('Connection Types', () => {
    it('should define connection types for pagination', () => {
      expect(schema.getType('ProjectConnection')).toBeDefined();
      expect(schema.getType('TaskConnection')).toBeDefined();
      expect(schema.getType('OrganizationConnection')).toBeDefined();
      expect(schema.getType('PageInfo')).toBeDefined();
    });

    it('should define edge types for pagination', () => {
      expect(schema.getType('ProjectEdge')).toBeDefined();
      expect(schema.getType('TaskEdge')).toBeDefined();
      expect(schema.getType('OrganizationEdge')).toBeDefined();
    });
  });

  describe('Analytics Types', () => {
    it('should define analytics types', () => {
      expect(schema.getType('ProjectAnalytics')).toBeDefined();
      expect(schema.getType('OrganizationAnalytics')).toBeDefined();
      expect(schema.getType('TaskAnalytics')).toBeDefined();
    });

    it('should define supporting analytics types', () => {
      expect(schema.getType('StatusCount')).toBeDefined();
      expect(schema.getType('TimelinePoint')).toBeDefined();
      expect(schema.getType('EmployeeProductivity')).toBeDefined();
    });
  });

  describe('Schema Configuration', () => {
    it('should have valid configuration', () => {
      expect(schemaConfig.version).toBeDefined();
      expect(schemaConfig.features).toBeDefined();
      expect(schemaConfig.limits).toBeDefined();
    });

    it('should have reasonable limits', () => {
      expect(schemaConfig.limits.maxDepth).toBeGreaterThan(0);
      expect(schemaConfig.limits.maxComplexity).toBeGreaterThan(0);
      expect(schemaConfig.limits.timeout).toBeGreaterThan(0);
    });

    it('should have feature flags', () => {
      expect(typeof schemaConfig.features.subscriptions).toBe('boolean');
      expect(typeof schemaConfig.features.fileUploads).toBe('boolean');
      expect(typeof schemaConfig.features.caching).toBe('boolean');
      expect(typeof schemaConfig.features.authentication).toBe('boolean');
    });
  });
});
