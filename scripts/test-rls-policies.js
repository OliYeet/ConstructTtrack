#!/usr/bin/env node

/**
 * RLS Policy Enforcement Testing
 *
 * This script tests Row Level Security policies to ensure proper
 * organization isolation and role-based access control.
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class RLSPolicyTester {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      console.error(chalk.red('❌ Missing required environment variables'));
      process.exit(1);
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
    this.testResults = [];
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      test: chalk.cyan,
    };

    console.log(`${colors[type]('●')} ${message}`);
  }

  async runTest(testName, testFunction) {
    this.log(`Running: ${testName}`, 'test');

    try {
      const result = await testFunction();
      if (result.success) {
        this.log(`✅ PASS: ${testName}`, 'success');
        this.testResults.push({
          name: testName,
          status: 'PASS',
          details: result.details,
        });
      } else {
        this.log(`❌ FAIL: ${testName} - ${result.error}`, 'error');
        this.testResults.push({
          name: testName,
          status: 'FAIL',
          error: result.error,
        });
      }
    } catch (error) {
      this.log(`💥 ERROR: ${testName} - ${error.message}`, 'error');
      this.testResults.push({
        name: testName,
        status: 'ERROR',
        error: error.message,
      });
    }
  }

  // Test organization isolation for projects
  async testProjectOrganizationIsolation() {
    try {
      // Create test JWT tokens for different organizations
      const org1Token = this.createTestJWT(
        '550e8400-e29b-41d4-a716-446655440001',
        'admin'
      );
      const org2Token = this.createTestJWT(
        '550e8400-e29b-41d4-a716-446655440002',
        'admin'
      );

      // Test with org1 token
      const client1 = createClient(this.supabaseUrl, this.supabaseServiceKey, {
        global: { headers: { Authorization: `Bearer ${org1Token}` } },
      });

      const { data: org1Projects, error: org1Error } = await client1
        .from('projects')
        .select('*');

      if (org1Error) {
        return {
          success: false,
          error: `Org1 query failed: ${org1Error.message}`,
        };
      }

      // Test with org2 token
      const client2 = createClient(this.supabaseUrl, this.supabaseServiceKey, {
        global: { headers: { Authorization: `Bearer ${org2Token}` } },
      });

      const { data: org2Projects, error: org2Error } = await client2
        .from('projects')
        .select('*');

      if (org2Error) {
        return {
          success: false,
          error: `Org2 query failed: ${org2Error.message}`,
        };
      }

      // Verify isolation
      const org1ProjectIds = org1Projects.map(p => p.id);
      const org2ProjectIds = org2Projects.map(p => p.id);
      const hasOverlap = org1ProjectIds.some(id => org2ProjectIds.includes(id));

      if (hasOverlap) {
        return {
          success: false,
          error: "Organizations can see each other's projects",
        };
      }

      return {
        success: true,
        details: `Org1: ${org1Projects.length} projects, Org2: ${org2Projects.length} projects, no overlap`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test role-based access for tasks
  async testTaskRoleBasedAccess() {
    try {
      const orgId = '550e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440013'; // field worker

      // Test field worker can only see assigned tasks
      const fieldWorkerToken = this.createTestJWT(
        orgId,
        'field_worker',
        userId
      );
      const fieldWorkerClient = createClient(
        this.supabaseUrl,
        this.supabaseServiceKey,
        {
          global: { headers: { Authorization: `Bearer ${fieldWorkerToken}` } },
        }
      );

      const { data: fieldWorkerTasks, error: fieldWorkerError } =
        await fieldWorkerClient.from('tasks').select('*');

      if (fieldWorkerError) {
        return {
          success: false,
          error: `Field worker query failed: ${fieldWorkerError.message}`,
        };
      }

      // Test admin can see all tasks
      const adminToken = this.createTestJWT(orgId, 'admin');
      const adminClient = createClient(
        this.supabaseUrl,
        this.supabaseServiceKey,
        {
          global: { headers: { Authorization: `Bearer ${adminToken}` } },
        }
      );

      const { data: adminTasks, error: adminError } = await adminClient
        .from('tasks')
        .select('*');

      if (adminError) {
        return {
          success: false,
          error: `Admin query failed: ${adminError.message}`,
        };
      }

      // Verify field worker sees fewer tasks than admin
      if (fieldWorkerTasks.length >= adminTasks.length) {
        return {
          success: false,
          error: 'Field worker sees same or more tasks than admin',
        };
      }

      // Verify field worker only sees assigned tasks
      const unassignedTasks = fieldWorkerTasks.filter(
        task => task.assigned_to !== userId
      );
      if (unassignedTasks.length > 0) {
        return {
          success: false,
          error: 'Field worker can see unassigned tasks',
        };
      }

      return {
        success: true,
        details: `Field worker: ${fieldWorkerTasks.length} tasks, Admin: ${adminTasks.length} tasks`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test fiber routes organization isolation
  async testFiberRoutesIsolation() {
    try {
      const org1Token = this.createTestJWT(
        '550e8400-e29b-41d4-a716-446655440001',
        'manager'
      );
      const org2Token = this.createTestJWT(
        '550e8400-e29b-41d4-a716-446655440002',
        'manager'
      );

      // Test org1 access
      const client1 = createClient(this.supabaseUrl, this.supabaseServiceKey, {
        global: { headers: { Authorization: `Bearer ${org1Token}` } },
      });

      const { data: org1Routes, error: org1Error } = await client1
        .from('fiber_routes')
        .select('*');

      if (org1Error) {
        return {
          success: false,
          error: `Org1 fiber routes query failed: ${org1Error.message}`,
        };
      }

      // Test org2 access
      const client2 = createClient(this.supabaseUrl, this.supabaseServiceKey, {
        global: { headers: { Authorization: `Bearer ${org2Token}` } },
      });

      const { data: org2Routes, error: org2Error } = await client2
        .from('fiber_routes')
        .select('*');

      if (org2Error) {
        return {
          success: false,
          error: `Org2 fiber routes query failed: ${org2Error.message}`,
        };
      }

      // Verify isolation
      const org1RouteIds = org1Routes.map(r => r.id);
      const org2RouteIds = org2Routes.map(r => r.id);
      const hasOverlap = org1RouteIds.some(id => org2RouteIds.includes(id));

      if (hasOverlap) {
        return {
          success: false,
          error: "Organizations can see each other's fiber routes",
        };
      }

      return {
        success: true,
        details: `Org1: ${org1Routes.length} routes, Org2: ${org2Routes.length} routes, isolated`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test equipment access control
  async testEquipmentAccessControl() {
    try {
      const orgId = '550e8400-e29b-41d4-a716-446655440001';

      // Test field worker can read equipment
      const fieldWorkerToken = this.createTestJWT(orgId, 'field_worker');
      const fieldWorkerClient = createClient(
        this.supabaseUrl,
        this.supabaseServiceKey,
        {
          global: { headers: { Authorization: `Bearer ${fieldWorkerToken}` } },
        }
      );

      const { error: readError } = await fieldWorkerClient
        .from('equipment')
        .select('*');

      if (readError) {
        return {
          success: false,
          error: `Field worker read failed: ${readError.message}`,
        };
      }

      // Test field worker cannot create equipment
      const { error: createError } = await fieldWorkerClient
        .from('equipment')
        .insert({
          name: 'Test Equipment',
          type: 'tool',
          organization_id: orgId,
        });

      if (!createError) {
        return {
          success: false,
          error: 'Field worker can create equipment (should be restricted)',
        };
      }

      // Test admin can create equipment
      const adminToken = this.createTestJWT(orgId, 'admin');
      const adminClient = createClient(
        this.supabaseUrl,
        this.supabaseServiceKey,
        {
          global: { headers: { Authorization: `Bearer ${adminToken}` } },
        }
      );

      const { error: adminCreateError } = await adminClient
        .from('equipment')
        .insert({
          name: 'Admin Test Equipment',
          type: 'tool',
          organization_id: orgId,
        });

      if (adminCreateError) {
        return {
          success: false,
          error: `Admin cannot create equipment: ${adminCreateError.message}`,
        };
      }

      return {
        success: true,
        details: 'Field worker can read but not create, admin can create',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Helper function to create test JWT tokens
  createTestJWT(organizationId, role, userId = null) {
    // This is a simplified JWT creation for testing
    // In a real scenario, you'd use proper JWT signing
    const payload = {
      sub: userId || `test-user-${role}`,
      organization_id: organizationId,
      role: role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };

    // Note: This is a mock JWT for testing purposes
    // Real implementation would use proper signing
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  async runAllTests() {
    console.log(chalk.blue.bold('🧪 ConstructTrack RLS Policy Testing'));
    console.log(chalk.blue('=====================================\n'));

    // Run all tests
    await this.runTest('Project Organization Isolation', () =>
      this.testProjectOrganizationIsolation()
    );

    await this.runTest('Task Role-Based Access', () =>
      this.testTaskRoleBasedAccess()
    );

    await this.runTest('Fiber Routes Organization Isolation', () =>
      this.testFiberRoutesIsolation()
    );

    await this.runTest('Equipment Access Control', () =>
      this.testEquipmentAccessControl()
    );

    // Print summary
    console.log(chalk.blue('\n📊 Test Summary:'));
    console.log(chalk.blue('================'));

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const errors = this.testResults.filter(r => r.status === 'ERROR').length;

    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.yellow(`💥 Errors: ${errors}`));

    if (failed > 0 || errors > 0) {
      console.log(chalk.red('\n🚨 Some tests failed. Review RLS policies.'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n🎉 All RLS policy tests passed!'));
    }
  }
}

// Run the tests
const tester = new RLSPolicyTester();
tester.runAllTests().catch(error => {
  console.error(chalk.red('💥 Test suite failed:'), error);
  process.exit(1);
});
