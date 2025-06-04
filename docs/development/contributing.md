# 🤝 Contributing Guidelines

> **How to contribute to ConstructTrack development**

We welcome contributions to ConstructTrack! This guide will help you get started with contributing
code, documentation, and other improvements.

## 🎯 Ways to Contribute

### Code Contributions

- **Bug fixes**: Fix issues and improve stability
- **New features**: Implement planned features from our roadmap
- **Performance improvements**: Optimize existing functionality
- **Testing**: Add or improve test coverage

### Documentation

- **API documentation**: Improve endpoint documentation
- **User guides**: Create or enhance user-facing documentation
- **Developer docs**: Improve setup and development guides
- **Code comments**: Add helpful inline documentation

### Other Contributions

- **Bug reports**: Report issues with detailed information
- **Feature requests**: Suggest new functionality
- **Design feedback**: Provide UI/UX improvement suggestions
- **Testing**: Help test new features and releases

## 🚀 Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/ConstructTtrack.git
cd TiefbauApp

# Add upstream remote
git remote add upstream https://github.com/OliYeet/ConstructTtrack.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
npm run env:setup

# Build packages
npm run packages:build

# Verify setup
npm run env:validate
npm test
```

### 3. Create Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

## 📝 Development Workflow

### Code Style Guidelines

#### TypeScript Standards

```typescript
// ✅ Good: Use explicit types for function parameters and returns
interface CreateProjectParams {
  name: string;
  description?: string;
  location: GeoPoint;
}

export async function createProject(params: CreateProjectParams): Promise<ApiResponse<Project>> {
  // Implementation
}

// ✅ Good: Use const assertions for immutable data
const PROJECT_STATUSES = ['planning', 'active', 'completed'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// ❌ Avoid: Any types
function processData(data: any): any {}

// ✅ Good: Use proper error handling
try {
  const result = await apiCall();
  return { success: true, data: result };
} catch (error) {
  console.error('API call failed:', error);
  return { success: false, error: error.message };
}
```

#### React Component Standards

```typescript
// ✅ Good: Use proper TypeScript interfaces for props
interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  className?: string;
}

export function ProjectCard({
  project,
  onEdit,
  className
}: ProjectCardProps) {
  // Use hooks at the top level
  const [isLoading, setIsLoading] = useState(false);

  // Event handlers with proper typing
  const handleEdit = useCallback(() => {
    onEdit?.(project);
  }, [onEdit, project]);

  return (
    <div className={cn('project-card', className)}>
      {/* Component JSX */}
    </div>
  );
}
```

#### CSS/Styling Standards

```typescript
// ✅ Good: Use Tailwind utility classes with cn() helper
import { cn } from '@shared/utils';

const buttonVariants = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white'
};

function Button({ variant = 'primary', className, ...props }) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-md font-medium transition-colors',
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}
```

#### File Naming Conventions

```
components/
├── ProjectCard.tsx          # PascalCase for components
├── project-list.types.ts    # kebab-case for types/utils
├── useProjectData.ts        # camelCase for hooks
└── index.ts                 # barrel exports

utils/
├── api-client.ts           # kebab-case for utilities
├── date-helpers.ts         # descriptive names
└── validation.ts           # single word when clear

types/
├── project.types.ts        # domain-specific types
├── api.types.ts           # API-related types
└── common.types.ts        # shared types
```

### Code Quality Tools

```bash
# Lint code (ESLint + TypeScript)
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code (Prettier)
npm run format

# Type checking (TypeScript)
npm run type-check

# Run all quality checks
npm run quality:check
```

#### ESLint Configuration

Our ESLint setup includes:

- **@typescript-eslint**: TypeScript-specific rules
- **eslint-plugin-react**: React best practices
- **eslint-plugin-react-hooks**: Hooks rules
- **eslint-plugin-import**: Import/export rules
- **eslint-config-prettier**: Prettier compatibility

#### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(auth): add two-factor authentication
fix(map): resolve marker clustering issue
docs(api): update authentication documentation
style(ui): improve button component styling
refactor(db): optimize query performance
test(auth): add login flow tests
chore(deps): update dependencies
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Testing Requirements

#### Running Tests Locally

```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run tests for specific pattern
npm test -- --testNamePattern="should create project"

# Run tests in specific directory
npm test -- apps/web/src/components

# Debug tests with Node inspector
npm run test:debug
```

#### Test Types & Examples

##### Unit Tests

Test individual functions and components in isolation:

```typescript
// utils/date-helpers.test.ts
import { formatProjectDate, isDateInRange } from './date-helpers';

describe('date-helpers', () => {
  describe('formatProjectDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2025-01-30T10:00:00Z');
      expect(formatProjectDate(date)).toBe('Jan 30, 2025');
    });

    it('should handle invalid dates', () => {
      expect(formatProjectDate(null)).toBe('Invalid Date');
    });
  });

  describe('isDateInRange', () => {
    it('should return true for date within range', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');
      const test = new Date('2025-06-15');

      expect(isDateInRange(test, start, end)).toBe(true);
    });
  });
});
```

##### Component Tests

Test React components with user interactions:

```typescript
// components/ProjectCard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectCard } from './ProjectCard';
import { mockProject } from '@/tests/mocks';

describe('ProjectCard', () => {
  const defaultProps = {
    project: mockProject,
    onEdit: jest.fn(),
    onDelete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders project information correctly', () => {
    render(<ProjectCard {...defaultProps} />);

    expect(screen.getByText(mockProject.name)).toBeInTheDocument();
    expect(screen.getByText(mockProject.description)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    render(<ProjectCard {...defaultProps} />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockProject);
    });
  });

  it('shows loading state during async operations', async () => {
    const slowOnEdit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<ProjectCard {...defaultProps} onEdit={slowOnEdit} />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

##### Integration Tests

Test component interactions and API integration:

```typescript
// features/project-management.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectManagement } from './ProjectManagement';
import { mockSupabase } from '@/tests/mocks';
import { TestWrapper } from '@/tests/TestWrapper';

jest.mock('@/lib/supabase', () => mockSupabase);

describe('ProjectManagement Integration', () => {
  it('should create and display new project', async () => {
    const mockProjects = [
      { id: '1', name: 'Existing Project', status: 'active' }
    ];

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: mockProjects,
        error: null
      }),
      insert: jest.fn().mockResolvedValue({
        data: [{ id: '2', name: 'New Project', status: 'planning' }],
        error: null
      })
    });

    render(
      <TestWrapper>
        <ProjectManagement />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Existing Project')).toBeInTheDocument();
    });

    // Create new project
    const createButton = screen.getByRole('button', { name: /create project/i });
    fireEvent.click(createButton);

    const nameInput = screen.getByLabelText(/project name/i);
    fireEvent.change(nameInput, { target: { value: 'New Project' } });

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    // Verify project was created
    await waitFor(() => {
      expect(mockSupabase.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'New Project' })
      ]);
    });
  });
});
```

##### E2E Tests (Playwright)

Test complete user workflows:

```typescript
// e2e/project-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as manager
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'manager@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
  });

  test('should complete full project creation workflow', async ({ page }) => {
    // Navigate to projects
    await page.click('[data-testid="projects-nav"]');
    await expect(page).toHaveURL('/projects');

    // Create new project
    await page.click('[data-testid="create-project-button"]');

    // Fill project form
    await page.fill('[data-testid="project-name"]', 'E2E Test Project');
    await page.fill('[data-testid="project-description"]', 'Test project description');
    await page.selectOption('[data-testid="project-priority"]', 'high');

    // Set location on map (simulate map click)
    await page.click('[data-testid="map-container"]', { position: { x: 200, y: 200 } });

    // Save project
    await page.click('[data-testid="save-project-button"]');

    // Verify project was created
    await expect(page.locator('[data-testid="project-card"]')).toContainText('E2E Test Project');

    // Verify project appears in list
    await expect(page.locator('[data-testid="projects-list"]')).toContainText('E2E Test Project');
  });
});
```

#### Test Configuration

##### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/$1',
    '^@ui/(.*)$': '<rootDir>/packages/ui/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/*.stories.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

##### Test Setup

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
```

#### Testing Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how it does it
2. **Use Data Test IDs**: Add `data-testid` attributes for reliable element selection
3. **Mock External Dependencies**: Mock APIs, third-party libraries, and complex dependencies
4. **Test Error States**: Include tests for error conditions and edge cases
5. **Keep Tests Independent**: Each test should be able to run in isolation
6. **Use Descriptive Test Names**: Test names should clearly describe what is being tested

### Code Review Process

1. **Self-review**: Review your own changes before submitting
2. **Automated checks**: Ensure all CI checks pass
3. **Peer review**: Address feedback from reviewers
4. **Final approval**: Maintainer approval required for merge

## 🏗️ Architecture Guidelines

### File Organization

```
apps/
├── web/                 # Next.js web application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Next.js pages
│   │   ├── hooks/       # Custom React hooks
│   │   ├── utils/       # Utility functions
│   │   └── types/       # TypeScript types
│   └── public/          # Static assets
├── mobile/              # React Native mobile app
│   ├── src/
│   │   ├── components/  # React Native components
│   │   ├── screens/     # App screens
│   │   ├── navigation/  # Navigation configuration
│   │   └── services/    # API services
packages/
├── shared/              # Shared utilities
├── ui/                  # UI component library
└── supabase/            # Database client
```

### Component Guidelines

```typescript
// Use TypeScript interfaces for props
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

// Export component with proper typing
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  onClick
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-md font-medium transition-colors',
        variants[variant],
        sizes[size]
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Export types for reuse
export type { ButtonProps };
```

### API Guidelines

```typescript
// Use consistent error handling
export async function createProject(data: CreateProjectData) {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: project };
  } catch (error) {
    console.error('Failed to create project:', error);
    return {
      success: false,
      error: error.message || 'Failed to create project',
    };
  }
}
```

## 🧪 Testing Guidelines

### Unit Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies correct variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByText('Secondary');
    expect(button).toHaveClass('bg-gray-200');
  });
});
```

### Integration Test Example

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { ProjectList } from '@/components/ProjectList';
import { mockSupabase } from '@/tests/mocks';

jest.mock('@/lib/supabase', () => mockSupabase);

describe('ProjectList', () => {
  it('loads and displays projects', async () => {
    const mockProjects = [
      { id: '1', name: 'Test Project 1' },
      { id: '2', name: 'Test Project 2' }
    ];

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: mockProjects,
        error: null
      })
    });

    render(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      expect(screen.getByText('Test Project 2')).toBeInTheDocument();
    });
  });
});
```

## 📋 Pull Request Guidelines

### Before Submitting

- [ ] Code follows project conventions
- [ ] All tests pass
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### PR Description Template

```markdown
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)

Add screenshots for UI changes.

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
```

### Review Process

1. **Automated checks**: CI/CD pipeline runs tests and linting
2. **Code review**: Team members review code quality and logic
3. **Testing**: Reviewers test functionality if needed
4. **Approval**: Maintainer approves and merges

## 🐛 Bug Reports

### Bug Report Template

```markdown
## Bug Description

Clear description of the bug.

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior

What should happen.

## Actual Behavior

What actually happens.

## Environment

- OS: [e.g., macOS 12.0]
- Browser: [e.g., Chrome 96]
- Node.js: [e.g., 18.19.0]
- App version: [e.g., 1.2.3]

## Additional Context

Screenshots, logs, or other relevant information.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description

Clear description of the proposed feature.

## Problem Statement

What problem does this solve?

## Proposed Solution

How should this feature work?

## Alternatives Considered

Other solutions you've considered.

## Additional Context

Mockups, examples, or other relevant information.
```

## 🏷️ Issue Labels

We use labels to categorize issues:

- **Type**: `bug`, `feature`, `documentation`, `enhancement`
- **Priority**: `low`, `medium`, `high`, `critical`
- **Status**: `needs-triage`, `in-progress`, `blocked`
- **Area**: `web`, `mobile`, `api`, `database`, `docs`

## 🎉 Recognition

Contributors are recognized in:

- **README.md**: Contributors section
- **Release notes**: Feature attribution
- **Team meetings**: Public recognition

## 📞 Getting Help

- **Questions**: Create a discussion or ask in team chat
- **Stuck on setup**: Check [Development Setup](development-setup.md)
- **Need guidance**: Reach out to maintainers

## 📚 Resources

- [Development Setup](development-setup.md)
- [Code Standards](code-standards.md)
- [Testing Guide](testing.md)
- [Architecture Overview](../architecture/system-overview.md)

---

**Thank you for contributing to ConstructTrack!** 🚀
