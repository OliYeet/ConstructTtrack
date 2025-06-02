# 🔧 Development Setup

> **Advanced development environment configuration for ConstructTrack**

This guide covers advanced development setup, tooling configuration, and best practices for contributing to ConstructTrack.

## 🛠️ Development Environment

### Required Tools

#### Core Development Stack
```bash
# Node.js (use nvm for version management)
nvm install 18.19.0
nvm use 18.19.0

# Package managers
npm install -g npm@latest
npm install -g yarn@latest

# Expo CLI for mobile development
npm install -g @expo/cli@latest

# Supabase CLI for database management
npm install -g supabase@latest
```

#### Recommended VS Code Extensions
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-react-native",
    "expo.vscode-expo-tools",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

### IDE Configuration

#### VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

## 📦 Workspace Setup

### Monorepo Structure
```
TiefbauApp/
├── apps/
│   ├── web/              # Next.js web application
│   └── mobile/           # React Native mobile app
├── packages/
│   ├── shared/           # Shared utilities and types
│   ├── ui/               # UI component library
│   └── supabase/         # Database client and types
├── docs/                 # Documentation
├── scripts/              # Build and utility scripts
└── tools/                # Development tools and configs
```

### Package Management Strategy
```bash
# Install all dependencies
npm install

# Build shared packages
npm run packages:build

# Link packages for development
npm run packages:link

# Clean and rebuild everything
npm run clean && npm run build
```

## 🔧 Development Scripts

### Available Commands
```bash
# Development servers
npm run dev              # Start both web and mobile
npm run web:dev          # Web development server
npm run mobile:dev       # Mobile development server

# Building
npm run build            # Build all applications
npm run web:build        # Build web application
npm run mobile:build     # Build mobile application

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Code quality
npm run lint             # Lint all code
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier
npm run type-check       # TypeScript type checking

# Database
npm run db:generate      # Generate database types
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with test data
npm run db:reset         # Reset database to clean state
```

## 🗄️ Database Development

### Supabase Local Development
```bash
# Initialize Supabase project
supabase init

# Start local Supabase stack
supabase start

# Generate TypeScript types
supabase gen types typescript --local > packages/supabase/types/database.ts

# Create new migration
supabase migration new add_projects_table

# Apply migrations
supabase db push

# Reset database
supabase db reset
```

### Database Schema Management
```sql
-- Example migration file
-- supabase/migrations/20250130000001_create_projects.sql

CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planning',
  location GEOGRAPHY(POINT),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view projects in their organization" 
ON projects FOR SELECT 
USING (organization_id = auth.jwt() ->> 'organization_id');
```

## 🧪 Testing Setup

### Testing Stack
- **Jest**: Unit and integration testing
- **React Testing Library**: Component testing
- **Detox**: End-to-end mobile testing
- **Playwright**: Web E2E testing

### Test Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/$1',
    '^@ui/(.*)$': '<rootDir>/packages/ui/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ]
};
```

### Writing Tests
```typescript
// Example component test
import { render, screen } from '@testing-library/react';
import { ProjectCard } from '@/components/ProjectCard';

describe('ProjectCard', () => {
  it('renders project information correctly', () => {
    const project = {
      id: '1',
      name: 'Test Project',
      status: 'active'
    };

    render(<ProjectCard project={project} />);
    
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
```

## 🎨 Styling and UI Development

### Tailwind CSS Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './apps/**/*.{js,ts,jsx,tsx}',
    './packages/ui/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a'
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
};
```

### Component Development
```typescript
// Example UI component
import { cn } from '@shared/utils';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-md font-medium transition-colors',
        {
          'bg-primary-500 text-white hover:bg-primary-600': variant === 'primary',
          'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-base': size === 'md',
          'px-6 py-3 text-lg': size === 'lg'
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

## 📱 Mobile Development

### React Native Setup
```bash
# iOS development (macOS only)
cd apps/mobile
npx pod-install

# Start Metro bundler
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web (for testing)
npm run web
```

### Mobile-Specific Configuration
```typescript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for monorepo
config.watchFolders = [
  path.resolve(__dirname, '../../packages')
];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules')
];

module.exports = config;
```

## 🔄 Git Workflow

### Branch Strategy
```bash
# Feature development
git checkout -b feature/add-project-management
git commit -m "feat: add project creation form"
git push origin feature/add-project-management

# Bug fixes
git checkout -b fix/map-rendering-issue
git commit -m "fix: resolve map rendering on mobile"

# Hotfixes
git checkout -b hotfix/critical-auth-bug
git commit -m "hotfix: fix authentication token expiry"
```

### Commit Message Convention
```
type(scope): description

feat(auth): add two-factor authentication
fix(map): resolve marker clustering issue
docs(api): update authentication documentation
style(ui): improve button component styling
refactor(db): optimize query performance
test(auth): add login flow tests
```

## 🔍 Debugging

### Web Application Debugging
```bash
# Start with debugging enabled
npm run web:dev:debug

# Enable React DevTools
npm install -g react-devtools

# Start React DevTools
react-devtools
```

### Mobile Application Debugging
```bash
# Enable remote debugging
npm run mobile:dev

# Use Flipper for debugging
npm install -g flipper

# React Native Debugger
npm install -g react-native-debugger
```

### Database Debugging
```bash
# View database logs
supabase logs

# Connect to local database
psql postgresql://postgres:postgres@localhost:54322/postgres

# Monitor real-time subscriptions
supabase realtime logs
```

## 🚀 Performance Optimization

### Bundle Analysis
```bash
# Analyze web bundle
npm run web:analyze

# Analyze mobile bundle
npm run mobile:analyze

# Check bundle size
npm run bundle-size
```

### Performance Monitoring
```typescript
// Performance monitoring setup
import { performance } from 'perf_hooks';

export function measurePerformance(name: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      const result = await originalMethod.apply(this, args);
      const end = performance.now();
      
      console.log(`${name} took ${end - start} milliseconds`);
      return result;
    };
  };
}
```

## 📚 Documentation Development

### Documentation Standards
- Use clear, concise language
- Include code examples
- Keep screenshots up to date
- Follow established file structure
- Update status tables when adding documentation

### Building Documentation
```bash
# Generate API documentation
npm run docs:api

# Build documentation site
npm run docs:build

# Serve documentation locally
npm run docs:serve
```

---

**Next Steps**: Review [Contributing Guidelines](contributing.md) and [Code Standards](code-standards.md) before making your first contribution.
