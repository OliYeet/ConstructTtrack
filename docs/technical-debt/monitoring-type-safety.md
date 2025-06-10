# Technical Debt: Monitoring System Type Safety

## Overview

The monitoring system currently uses `any` type in 19 locations, primarily for event payloads and
error handling. While these uses are generally safe, improving type safety would enhance code
maintainability and catch potential bugs at compile time.

## Current State

- **Total occurrences**: 19 instances of `any` type in `/apps/web/src/lib/monitoring/`
- **Primary uses**:
  - Event payload shapes in listeners
  - Error objects in catch blocks
  - Mock request objects for rate limiting
  - Dynamic property access in proxies

## Improvement Plan

### Phase 1: Low-Risk Improvements (Priority: High)

1. **Error handling types**
   - Replace `catch (error)` with `catch (error: unknown)`
   - Use type guards to narrow error types
2. **Event payloads**
   - Define specific interfaces for each event type
   - Use discriminated unions for event handlers

### Phase 2: Mock Object Types (Priority: Medium)

1. **Rate limiter mocks**

   - Create proper interfaces for mock request objects
   - Replace `as any` casts with proper type assertions

2. **Proxy handlers**
   - Define stricter types for proxy get/set operations
   - Use generic constraints where applicable

### Phase 3: Dynamic Access (Priority: Low)

1. **Property access**
   - Replace dynamic property access with proper type indexing
   - Use mapped types for configuration objects

## Example Improvements

### Before:

```typescript
} catch (error: any) {
  logger.error('Error', { error });
}
```

### After:

```typescript
} catch (error) {
  logger.error('Error', {
    error: error instanceof Error ? error.message : String(error)
  });
}
```

## Timeline

- This is non-critical technical debt
- Address opportunistically when modifying affected code
- Complete Phase 1 within next 2 sprints
- Phases 2-3 can be addressed as time permits

## Benefits

1. Better IDE support and autocomplete
2. Catch type-related bugs at compile time
3. Improved code documentation through types
4. Easier refactoring with TypeScript's help
