# 🤝 Contributing Guidelines

> **How to contribute to ConstructTrack development**

We welcome contributions to ConstructTrack! This guide will help you get started with contributing code, documentation, and other improvements.

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

### Code Standards
We use automated tools to maintain code quality:

```bash
# Lint code
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
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
All contributions should include appropriate tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts
```

**Test Types:**
- **Unit tests**: Test individual functions/components
- **Integration tests**: Test component interactions
- **E2E tests**: Test complete user workflows

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
      error: error.message || 'Failed to create project' 
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
