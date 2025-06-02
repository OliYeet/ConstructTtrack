# 🔧 Development Setup

> **Advanced development environment configuration for ConstructTrack**

This guide covers advanced development setup, tooling configuration, and best practices for contributing to ConstructTrack.

## 🛠️ Development Environment

### Required Tools

#### Core Development Stack

##### Node.js Setup (All Platforms)
```bash
# Install Node Version Manager (nvm)
# macOS/Linux:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Windows (use nvm-windows):
# Download and install from: https://github.com/coreybutler/nvm-windows

# Restart terminal, then install Node.js
nvm install 18.19.0
nvm use 18.19.0
nvm alias default 18.19.0

# Verify installation
node --version  # Should show v18.19.0
npm --version   # Should show 10.x.x
```

##### Package Managers
```bash
# Update npm to latest
npm install -g npm@latest

# Install yarn (optional but recommended)
npm install -g yarn@latest

# Install pnpm (alternative package manager)
npm install -g pnpm@latest
```

##### Mobile Development Tools
```bash
# Expo CLI for React Native development
npm install -g @expo/cli@latest

# EAS CLI for building and deployment
npm install -g eas-cli@latest

# React Native CLI (if needed for bare workflow)
npm install -g @react-native-community/cli
```

##### Database and Backend Tools
```bash
# Supabase CLI for database management
npm install -g supabase@latest

# Verify Supabase CLI
supabase --version
```

#### OS-Specific Setup Instructions

##### macOS Setup
```bash
# Install Xcode Command Line Tools (required for native dependencies)
xcode-select --install

# Install Homebrew (package manager)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install additional tools
brew install git
brew install watchman  # For React Native file watching

# For iOS development
# Install Xcode from App Store
# Install iOS Simulator
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# Install CocoaPods for iOS dependencies
sudo gem install cocoapods
```

##### Windows Setup
```powershell
# Install Chocolatey (package manager)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Git
choco install git

# Install Windows Subsystem for Linux (WSL2) - recommended
wsl --install

# For Android development
# Install Android Studio from https://developer.android.com/studio
# Set ANDROID_HOME environment variable
# Add Android SDK tools to PATH
```

##### Linux (Ubuntu/Debian) Setup
```bash
# Update package list
sudo apt update

# Install essential build tools
sudo apt install -y curl git build-essential

# Install additional dependencies for React Native
sudo apt install -y openjdk-11-jdk

# For Android development
# Download Android Studio from https://developer.android.com/studio
# Extract and run studio.sh

# Set up environment variables in ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
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

## 🛠️ Common Setup Issues & Troubleshooting

### Node.js and npm Issues

#### Node Version Conflicts
**Problem**: Multiple Node.js versions causing issues
```bash
# Check current Node version
node --version

# List installed versions
nvm list

# Switch to correct version
nvm use 18.19.0

# Set as default
nvm alias default 18.19.0

# If nvm command not found (restart terminal first)
source ~/.bashrc  # or ~/.zshrc
```

#### npm Permission Issues (macOS/Linux)
**Problem**: Permission denied when installing global packages
```bash
# Option 1: Use nvm (recommended)
nvm install 18.19.0
nvm use 18.19.0

# Option 2: Change npm's default directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Option 3: Fix permissions (not recommended)
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

#### Package Installation Failures
**Problem**: Dependencies fail to install
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Try different package manager
yarn install
# or
pnpm install

# If native dependencies fail (macOS)
sudo xcode-select --install

# If native dependencies fail (Windows)
npm install --global windows-build-tools
```

### Mobile Development Issues

#### Expo CLI Issues
**Problem**: Expo commands not working
```bash
# Update Expo CLI
npm uninstall -g expo-cli @expo/cli
npm install -g @expo/cli@latest

# Clear Expo cache
npx expo install --fix

# Reset Expo
rm -rf ~/.expo
rm -rf node_modules/.cache
```

#### iOS Simulator Issues (macOS)
**Problem**: iOS simulator not starting
```bash
# Check Xcode installation
xcode-select -p

# Reset iOS Simulator
xcrun simctl erase all

# List available simulators
xcrun simctl list devices

# Open specific simulator
xcrun simctl boot "iPhone 14"
open -a Simulator
```

#### Android Emulator Issues
**Problem**: Android emulator not working
```bash
# Check Android SDK installation
echo $ANDROID_HOME

# List available AVDs
emulator -list-avds

# Start emulator
emulator -avd Pixel_4_API_30

# If emulator command not found, add to PATH:
export PATH=$PATH:$ANDROID_HOME/emulator
```

### Database and Backend Issues

#### Supabase Connection Issues
**Problem**: Cannot connect to Supabase
```bash
# Check Supabase CLI
supabase --version

# Login to Supabase
supabase login

# Check project status
supabase status

# Reset local Supabase
supabase stop
supabase start
```

#### Environment Variable Issues
**Problem**: Environment variables not loading
```bash
# Check if .env file exists
ls -la .env*

# Validate environment variables
npm run env:validate

# Check environment loading in app
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
```

### Git and Version Control Issues

#### Git Hooks Not Working
**Problem**: Husky pre-commit hooks failing
```bash
# Reinstall Husky
rm -rf .husky
npm uninstall husky
npm install husky --save-dev
npx husky install

# Make hooks executable (Unix/macOS)
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg

# Check hook files
cat .husky/pre-commit
```

#### Git Authentication Issues
**Problem**: Git push/pull authentication failures
```bash
# Check Git configuration
git config --list

# Set up Git credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# For GitHub, use personal access token
git config --global credential.helper store

# Or use SSH keys (recommended)
ssh-keygen -t ed25519 -C "your.email@example.com"
cat ~/.ssh/id_ed25519.pub  # Add to GitHub
```

### IDE and Editor Issues

#### VS Code Extensions Not Working
**Problem**: TypeScript or ESLint not working in VS Code
```bash
# Reload VS Code window
# Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows/Linux)
# Type: "Developer: Reload Window"

# Check TypeScript version
npx tsc --version

# Restart TypeScript server in VS Code
# Cmd+Shift+P -> "TypeScript: Restart TS Server"

# Check workspace settings
cat .vscode/settings.json
```

#### ESLint Configuration Issues
**Problem**: ESLint rules not applying
```bash
# Check ESLint configuration
npx eslint --print-config src/index.ts

# Test ESLint on specific file
npx eslint src/components/Button.tsx

# Fix ESLint issues
npx eslint src/ --fix
```

### Performance Issues

#### Slow Build Times
**Problem**: Development builds taking too long
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Use faster package manager
npm install -g pnpm
pnpm install

# Enable SWC in Next.js (next.config.js)
module.exports = {
  swcMinify: true,
  experimental: {
    swcTraceProfiling: true
  }
}
```

#### Memory Issues
**Problem**: Out of memory errors
```bash
# Increase Node.js heap size
export NODE_OPTIONS="--max-old-space-size=8192"

# Monitor memory usage
node --inspect-brk node_modules/.bin/next build

# Clear caches
rm -rf .next
rm -rf node_modules/.cache
npm run clean
```

### Network and Proxy Issues

#### Corporate Firewall/Proxy
**Problem**: npm install fails behind corporate firewall
```bash
# Configure npm proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Set registry to use HTTP instead of HTTPS
npm config set registry http://registry.npmjs.org/

# Use corporate npm registry
npm config set registry http://npm.company.com/

# Bypass SSL verification (not recommended for production)
npm config set strict-ssl false
```

### Getting Additional Help

#### Debug Information Collection
When reporting setup issues, include:
```bash
# System information
node --version
npm --version
git --version
npx expo --version

# Environment information
echo $NODE_ENV
echo $PATH
echo $ANDROID_HOME

# Package information
npm list --depth=0

# Error logs
cat ~/.npm/_logs/*-debug.log
```

#### Useful Diagnostic Commands
```bash
# Check system architecture
uname -a

# Check available disk space
df -h

# Check memory usage
free -h  # Linux
vm_stat  # macOS

# Check running processes
ps aux | grep node

# Network connectivity test
ping google.com
curl -I https://registry.npmjs.org/
```

---

**Next Steps**: Review [Contributing Guidelines](contributing.md) and [Code Standards](code-standards.md) before making your first contribution.
