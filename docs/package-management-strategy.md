# 📦 ConstructTrack Package Management & Dependency Strategy

## 🎯 Overview

This document outlines the package management strategy for the ConstructTrack monorepo, ensuring
consistent dependency management, efficient builds, and maintainable code sharing across all
applications and packages.

## 🏗️ Monorepo Structure

```
constructtrack/
├── apps/
│   ├── web/           # Next.js web application
│   └── mobile/        # React Native mobile app
├── packages/
│   ├── shared/        # Shared utilities and constants
│   ├── ui/           # Shared UI components
│   └── supabase/     # Supabase client and types
└── package.json      # Root workspace configuration
```

## 📋 Package Management Principles

### 1. **Workspace Configuration**

- Use npm workspaces for monorepo management
- All packages are private except when explicitly published
- Consistent naming convention: `@constructtrack/package-name`

### 2. **Dependency Management**

- **Shared Dependencies**: Managed at root level for consistency
- **Package-Specific Dependencies**: Declared in individual package.json files
- **Internal Dependencies**: Use workspace protocol (`*`) for internal packages
- **External Dependencies**: Pin to specific versions for stability

### 3. **Version Strategy**

- **Internal Packages**: Use `*` to always use latest workspace version
- **External Dependencies**: Use exact versions or compatible ranges
- **Critical Dependencies**: Pin to exact versions (security, stability)

## 🔧 Implementation Guidelines

### Root Package.json Configuration

```json
{
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "dev": "npm run dev --workspaces",
    "test": "npm run test --workspaces",
    "lint": "npm run lint --workspaces"
  }
}
```

### Package Naming Convention

- **Apps**: Simple names (`web`, `mobile`)
- **Packages**: Scoped names (`@constructtrack/shared`, `@constructtrack/ui`)
- **Consistent versioning**: All packages start at `1.0.0`

### Dependency Categories

#### 1. **Shared Development Dependencies** (Root Level)

- TypeScript
- ESLint & Prettier
- Testing frameworks
- Build tools

#### 2. **Framework Dependencies** (App Level)

- Next.js (web app)
- Expo/React Native (mobile app)
- Framework-specific tools

#### 3. **Shared Runtime Dependencies** (Package Level)

- Supabase client
- Utility libraries
- Common business logic

## 📊 Build Order & Dependencies

### Build Sequence

1. `packages/shared` - Core utilities and types
2. `packages/supabase` - Database client (depends on shared)
3. `packages/ui` - UI components (depends on shared)
4. `apps/web` - Web application (depends on all packages)
5. `apps/mobile` - Mobile application (depends on all packages)

### Dependency Graph

```
apps/web ────┐
             ├─→ packages/ui ────┐
apps/mobile ─┘                  ├─→ packages/shared
                                 │
packages/supabase ──────────────┘
```

## 🚀 Scripts & Commands

### Root Level Scripts

```bash
# Development
npm run dev                    # Start all apps in dev mode
npm run web:dev               # Start web app only
npm run mobile:dev            # Start mobile app only

# Building
npm run build                 # Build all packages and apps
npm run packages:build        # Build packages only

# Quality
npm run lint                  # Lint all workspaces
npm run test                  # Test all workspaces
npm run type-check           # TypeScript check
```

### Package-Specific Scripts

Each package should implement:

- `build`: Compile TypeScript/build assets
- `dev`: Development mode with watch
- `lint`: Package-specific linting
- `test`: Package-specific tests

## 🔄 Dependency Update Strategy

### Regular Updates

- **Monthly**: Review and update non-critical dependencies
- **Quarterly**: Major version updates with testing
- **Security**: Immediate updates for security vulnerabilities

### Update Process

1. Use `npm audit` to identify vulnerabilities
2. Test updates in development environment
3. Update packages incrementally
4. Run full test suite before merging

## 🛡️ Security & Best Practices

### Security Measures

- Regular `npm audit` checks
- Pin critical dependency versions
- Use `.npmrc` for registry configuration
- Implement dependency scanning in CI/CD

### Best Practices

- Keep dependencies minimal and focused
- Prefer peer dependencies for shared libraries
- Document breaking changes in package updates
- Use exact versions for production dependencies

## 📝 Package.json Templates

### Shared Package Template

```json
{
  "name": "@constructtrack/package-name",
  "version": "1.0.0",
  "main": "index.ts",
  "types": "index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint .",
    "test": "jest"
  },
  "dependencies": {
    "@constructtrack/shared": "*"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### App Package Template

```json
{
  "name": "app-name",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "framework-dev-command",
    "build": "framework-build-command",
    "start": "framework-start-command",
    "lint": "eslint .",
    "test": "jest"
  },
  "dependencies": {
    "@constructtrack/shared": "*",
    "@constructtrack/ui": "*",
    "@constructtrack/supabase": "*"
  }
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Workspace Resolution**: Ensure proper workspace configuration
2. **Build Order**: Follow dependency graph for builds
3. **Version Conflicts**: Use `npm ls` to identify conflicts
4. **Cache Issues**: Clear node_modules and package-lock.json

### Debug Commands

```bash
npm ls --workspaces           # List all workspace dependencies
npm run build --workspace=package-name  # Build specific package
npm install --workspace=package-name    # Install deps for specific package
```

## 📈 Future Considerations

- **Package Publishing**: Strategy for publishing shared packages
- **Dependency Automation**: Automated dependency updates
- **Performance Optimization**: Bundle analysis and optimization
- **Micro-frontends**: Potential architecture evolution

---

**Last Updated**: December 2024  
**Maintained By**: ConstructTrack Development Team
