# ESLint Rules Technical Debt Plan

## Overview

This document outlines the technical debt related to ESLint rules that are currently set to "warn"
instead of "error" in the ConstructTrack project. These rules need to be systematically addressed to
improve code quality and prevent bugs.

## Current Relaxed Rules

The following ESLint rules are currently set to "warn" in `apps/web/eslint.config.mjs` (lines
38-47):

```javascript
rules: {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': 'warn',
  'react-hooks/exhaustive-deps': 'warn',
  // Other rules that may need attention
}
```

## Technical Debt Items

### 1. TypeScript `any` Types (@typescript-eslint/no-explicit-any)

**Priority**: High **Estimated Effort**: 2-3 weeks **Risk**: Medium - Can hide type errors and
reduce type safety

**Action Plan**:

- [ ] Audit all explicit `any` types in the codebase
- [ ] Replace with proper TypeScript types or interfaces
- [ ] Use generic types where appropriate
- [ ] Add proper type definitions for external libraries
- [ ] Enable rule as "error" once all instances are fixed

**Files to Review**:

- API route handlers
- Utility functions
- External library integrations
- Event handlers

### 2. Unused Variables (@typescript-eslint/no-unused-vars)

**Priority**: Medium **Estimated Effort**: 1 week **Risk**: Low - Code cleanliness and bundle size

**Action Plan**:

- [ ] Remove all unused imports and variables
- [ ] Use underscore prefix for intentionally unused parameters
- [ ] Review and clean up dead code
- [ ] Enable rule as "error" once all instances are fixed

**Common Patterns to Address**:

- Unused function parameters
- Imported but unused utilities
- Declared but unused variables
- Unused destructured properties

### 3. React Hooks Dependencies (react-hooks/exhaustive-deps)

**Priority**: High **Estimated Effort**: 1-2 weeks **Risk**: High - Can cause bugs, infinite loops,
and stale closures

**Action Plan**:

- [ ] Review all `useEffect`, `useCallback`, and `useMemo` hooks
- [ ] Add missing dependencies to dependency arrays
- [ ] Use `useCallback` for function dependencies
- [ ] Split complex effects into smaller, focused effects
- [ ] Enable rule as "error" once all instances are fixed

**Common Issues to Fix**:

- Missing state variables in dependencies
- Missing prop functions in dependencies
- Stale closure bugs
- Infinite re-render loops

## Implementation Timeline

### Phase 1: Assessment (Week 1)

- [ ] Run ESLint with rules as "error" to get full scope
- [ ] Categorize and prioritize violations
- [ ] Create detailed task breakdown

### Phase 2: React Hooks Dependencies (Week 2-3)

- [ ] Fix all `react-hooks/exhaustive-deps` violations
- [ ] Test thoroughly for regressions
- [ ] Enable rule as "error"

### Phase 3: TypeScript Any Types (Week 4-6)

- [ ] Replace explicit `any` types with proper types
- [ ] Add type definitions where needed
- [ ] Enable rule as "error"

### Phase 4: Unused Variables (Week 7)

- [ ] Clean up all unused variables and imports
- [ ] Enable rule as "error"

### Phase 5: Validation (Week 8)

- [ ] Full regression testing
- [ ] Code review of all changes
- [ ] Update CI/CD to enforce rules

## Success Criteria

- [ ] All ESLint rules changed from "warn" to "error"
- [ ] No ESLint violations in CI/CD pipeline
- [ ] No regressions in functionality
- [ ] Improved type safety and code quality
- [ ] Reduced bundle size from removed dead code

## Monitoring and Prevention

### Code Review Guidelines

- Require ESLint passing for all PRs
- Review type safety in code reviews
- Enforce dependency array completeness

### CI/CD Integration

- Fail builds on ESLint errors
- Add pre-commit hooks for ESLint
- Regular automated code quality reports

### Developer Education

- Team training on TypeScript best practices
- React Hooks dependency guidelines
- Code quality standards documentation

## Risk Mitigation

### Testing Strategy

- Comprehensive unit test coverage
- Integration testing for hook dependencies
- Manual testing for critical user flows

### Rollback Plan

- Feature flags for major changes
- Incremental deployment strategy
- Quick rollback procedures

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Hooks Rules](https://reactjs.org/docs/hooks-rules.html)
- [ESLint TypeScript Rules](https://typescript-eslint.io/rules/)

## Progress Tracking

Create GitHub issues for each phase and track progress using project boards.

**Created**: 2024-01-XX **Last Updated**: 2024-01-XX **Status**: Planning
