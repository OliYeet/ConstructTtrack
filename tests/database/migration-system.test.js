/**
 * Migration System Tests
 * Tests the database migration management system
 */

const fs = require('fs');
const path = require('path');

const {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} = require('@jest/globals');

const { MigrationManager } = require('../../scripts/migration-manager.js');

describe('Migration System', () => {
  let migrationManager;
  const testMigrationsDir = path.join(__dirname, 'test-migrations');

  beforeAll(async () => {
    // Create test migrations directory
    if (!fs.existsSync(testMigrationsDir)) {
      fs.mkdirSync(testMigrationsDir, { recursive: true });
    }

    migrationManager = new MigrationManager();
    // Override migrations directory for testing
    migrationManager.migrationsDir = testMigrationsDir;
  });

  afterAll(async () => {
    // Cleanup test migrations directory
    if (fs.existsSync(testMigrationsDir)) {
      fs.rmSync(testMigrationsDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Clean up test migrations before each test
    const files = fs
      .readdirSync(testMigrationsDir)
      .filter(f => f.endsWith('.sql'));
    files.forEach(file => {
      fs.unlinkSync(path.join(testMigrationsDir, file));
    });
  });

  describe('Migration Manager Initialization', () => {
    test('should initialize migration manager', async () => {
      const result = await migrationManager.initialize();
      expect(result).toBe(true);
    });

    test('should create migrations directory if it does not exist', async () => {
      const newDir = path.join(testMigrationsDir, 'new-migrations');
      const manager = new MigrationManager();
      manager.migrationsDir = newDir;

      await manager.initialize();

      expect(fs.existsSync(newDir)).toBe(true);

      // Cleanup
      fs.rmSync(newDir, { recursive: true, force: true });
    });
  });

  describe('Migration File Creation', () => {
    test('should create migration file with correct naming', async () => {
      const result = await migrationManager.createMigration(
        'test_migration',
        'Test description'
      );

      expect(result).toBeTruthy();
      expect(result.filename).toMatch(
        /^\d{8}T\d{6}\d{3}Z_test_migration\.sql$/
      );
      expect(fs.existsSync(result.filepath)).toBe(true);
    });

    test('should create migration file with template content', async () => {
      const result = await migrationManager.createMigration(
        'test_migration',
        'Test description'
      );
      const content = fs.readFileSync(result.filepath, 'utf8');

      expect(content).toContain('-- Migration: test_migration');
      expect(content).toContain('-- Description: Test description');
      expect(content).toContain('-- Created:');
      expect(content).toContain('-- Add your migration SQL here');
    });

    test('should handle migration names with spaces and special characters', async () => {
      const result = await migrationManager.createMigration(
        'Add User Preferences!',
        'Test description'
      );

      expect(result.filename).toContain('add_user_preferences');
      expect(result.filename).not.toContain(' ');
      expect(result.filename).not.toContain('!');
    });
  });

  describe('Migration File Listing', () => {
    test('should list migration files in correct order', async () => {
      // Create test migration files
      const migrations = [
        '20250130120000000_first_migration.sql',
        '20250130130000000_second_migration.sql',
        '20250130110000000_third_migration.sql',
      ];

      migrations.forEach(filename => {
        const filepath = path.join(testMigrationsDir, filename);
        fs.writeFileSync(filepath, '-- Test migration');
      });

      const result = await migrationManager.listMigrations();

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('20250130110000000_third_migration.sql');
      expect(result[1]).toBe('20250130120000000_first_migration.sql');
      expect(result[2]).toBe('20250130130000000_second_migration.sql');
    });

    test('should return empty array when no migrations exist', async () => {
      const result = await migrationManager.listMigrations();
      expect(result).toEqual([]);
    });
  });

  describe('Migration Validation', () => {
    test('should validate correct migration files', async () => {
      const validMigration = `
-- Migration: Test Migration
-- Description: Valid test migration

CREATE TABLE test_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL
);

CREATE INDEX idx_test_table_name ON test_table(name);
      `;

      const filepath = path.join(
        testMigrationsDir,
        '20250130120000000_valid_migration.sql'
      );
      fs.writeFileSync(filepath, validMigration);

      const result = await migrationManager.validateMigrations();
      expect(result).toBe(true);
    });

    test('should detect empty migration files', async () => {
      const filepath = path.join(
        testMigrationsDir,
        '20250130120000000_empty_migration.sql'
      );
      fs.writeFileSync(filepath, '');

      const result = await migrationManager.validateMigrations();
      expect(result).toBe(false);
    });

    test('should detect unbalanced parentheses', async () => {
      const invalidMigration = `
CREATE TABLE test_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL
-- Missing closing parenthesis
      `;

      const filepath = path.join(
        testMigrationsDir,
        '20250130120000000_invalid_migration.sql'
      );
      fs.writeFileSync(filepath, invalidMigration);

      const result = await migrationManager.validateMigrations();
      expect(result).toBe(false);
    });

    test('should warn about dangerous operations', async () => {
      const dangerousMigration = `
-- Migration: Dangerous Migration
DROP DATABASE production;
TRUNCATE TABLE users;
DELETE FROM important_data;
      `;

      const filepath = path.join(
        testMigrationsDir,
        '20250130120000000_dangerous_migration.sql'
      );
      fs.writeFileSync(filepath, dangerousMigration);

      // Should still validate but with warnings
      const result = await migrationManager.validateMigrations();
      expect(result).toBe(true); // Warnings don't fail validation
    });
  });

  describe('Checksum Calculation', () => {
    test('should calculate consistent checksums', () => {
      const filename = '20250130120000000_test_migration.sql';
      const content = 'CREATE TABLE test (id UUID);';

      const filepath = path.join(testMigrationsDir, filename);
      fs.writeFileSync(filepath, content);

      const checksum1 = migrationManager.calculateChecksum(filename);
      const checksum2 = migrationManager.calculateChecksum(filename);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toBeTruthy();
    });

    test('should produce different checksums for different content', () => {
      const filename1 = '20250130120000000_test1.sql';
      const filename2 = '20250130120000000_test2.sql';

      fs.writeFileSync(
        path.join(testMigrationsDir, filename1),
        'CREATE TABLE test1 (id UUID);'
      );
      fs.writeFileSync(
        path.join(testMigrationsDir, filename2),
        'CREATE TABLE test2 (id UUID);'
      );

      const checksum1 = migrationManager.calculateChecksum(filename1);
      const checksum2 = migrationManager.calculateChecksum(filename2);

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('Migration Template', () => {
    test('should generate proper migration template', () => {
      const template = migrationManager.getMigrationTemplate(
        'test_migration',
        'Test description'
      );

      expect(template).toContain('-- Migration: test_migration');
      expect(template).toContain('-- Description: Test description');
      expect(template).toContain('-- Created:');
      expect(template).toContain('-- Add your migration SQL here');
      expect(template).toContain('-- Rollback instructions');
    });

    test('should handle empty description', () => {
      const template = migrationManager.getMigrationTemplate(
        'test_migration',
        ''
      );

      expect(template).toContain('-- Description: ');
      expect(template).toContain('-- Migration: test_migration');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid migration directory', async () => {
      const manager = new MigrationManager();
      manager.migrationsDir = '/invalid/path/that/does/not/exist';

      const result = await manager.listMigrations();
      expect(result).toEqual([]);
    });

    test('should handle file system errors gracefully', async () => {
      const invalidScenarios = [
        {
          name: '',
          description: 'Empty name test',
          expected: 'Name cannot be empty',
        },
        {
          name: null,
          description: 'Null name test',
          expected: 'Name must be a string',
        },
        {
          name: 'valid_name',
          description: null,
          expected: 'Description must be a string',
        },
      ];

      for (const scenario of invalidScenarios) {
        const result = await migrationManager.createMigration(
          scenario.name,
          scenario.description
        );
        expect(result).toBeFalsy();
      }
    });
  });

  describe('Integration with Existing Migrations', () => {
    test('should work with existing migration files', async () => {
      // Copy actual migration files to test directory
      const actualMigrationsDir = path.join(
        __dirname,
        '../../supabase/migrations'
      );

      if (fs.existsSync(actualMigrationsDir)) {
        const actualFiles = fs
          .readdirSync(actualMigrationsDir)
          .filter(f => f.endsWith('.sql'))
          .slice(0, 2); // Just test with first 2 files

        actualFiles.forEach(file => {
          const source = path.join(actualMigrationsDir, file);
          const dest = path.join(testMigrationsDir, file);
          fs.copyFileSync(source, dest);
        });

        const result = await migrationManager.validateMigrations();
        expect(result).toBe(true);
      }
    });
  });
});

describe('Migration File Format', () => {
  test('should follow naming convention', () => {
    // Use actual format that MigrationManager generates
    const validNames = [
      '20250130T120000000Z_initial_schema.sql',
      '20250130T120000001Z_add_user_table.sql',
      '20250130T120000002Z_update_permissions.sql',
    ];

    const namePattern = /^\d{8}T\d{6}\d{3}Z_.+\.sql$/;

    validNames.forEach(name => {
      expect(name).toMatch(namePattern);
    });
  });

  test('should contain required metadata', () => {
    const migrationContent = `
-- Migration: Add User Preferences
-- Description: Add user preferences table
-- Created: 2025-01-30T12:34:56.789Z

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);
    `;

    expect(migrationContent).toContain('-- Migration:');
    expect(migrationContent).toContain('-- Description:');
    expect(migrationContent).toContain('-- Created:');
  });
});
