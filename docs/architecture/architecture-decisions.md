# 🎯 Architecture Decision Records (ADRs)

> **Key architectural decisions and their rationale for ConstructTrack**

This document records the major architectural decisions made during the design and implementation of
ConstructTrack, including the context, options considered, and rationale for each decision.

## ADR-001: Technology Stack Selection

### Status: ✅ Accepted

### Context

Need to select a technology stack that supports:

- Mobile-first development for field workers
- Real-time collaboration
- Geospatial data management
- Rapid development and deployment

### Decision

- **Frontend**: Next.js (web) + React Native (mobile)
- **Backend**: Supabase (PostgreSQL + PostGIS + Auth + Real-time)
- **Language**: TypeScript throughout
- **Deployment**: Vercel (web) + Expo (mobile)

### Rationale

- **React Ecosystem**: Shared components and patterns between web/mobile
- **TypeScript**: Type safety reduces bugs and improves developer experience
- **Supabase**: Managed backend reduces infrastructure complexity
- **PostGIS**: Native geospatial support for fiber route management
- **Real-time**: Built-in WebSocket support for live updates

### Consequences

- **Positive**: Rapid development, shared codebase, managed infrastructure
- **Negative**: Vendor lock-in to Supabase, limited backend customization

---

## ADR-002: Monorepo Architecture

### Status: ✅ Accepted

### Context

Need to manage multiple applications (web, mobile) with shared code and dependencies.

### Decision

Use a monorepo structure with shared packages:

- `apps/web` - Next.js web application
- `apps/mobile` - React Native mobile application
- `packages/shared` - Common utilities and types
- `packages/ui` - Shared UI components
- `packages/supabase` - Database client and types

### Rationale

- **Code Sharing**: Reduce duplication between web and mobile
- **Consistent Tooling**: Unified linting, testing, and build processes
- **Atomic Changes**: Cross-package changes in single commits
- **Type Safety**: Shared TypeScript definitions

### Consequences

- **Positive**: Reduced duplication, consistent patterns, easier refactoring
- **Negative**: More complex build setup, potential for tight coupling

---

## ADR-003: API Design Pattern

### Status: ✅ Accepted

### Context

Need a consistent API design that supports:

- Multi-tenant data isolation
- Role-based access control
- Standardized error handling
- Future mobile app integration

### Decision

- **Pattern**: RESTful API with Next.js App Router
- **Authentication**: JWT tokens with Supabase Auth
- **Authorization**: Role-based middleware + Row Level Security
- **Versioning**: URL-based versioning (`/api/v1/`)
- **Response Format**: Standardized JSON responses

### Rationale

- **REST**: Well-understood, cacheable, stateless
- **Next.js API Routes**: Integrated with web app, serverless deployment
- **JWT**: Stateless authentication, works across platforms
- **RLS**: Database-level security, prevents data leaks

### Consequences

- **Positive**: Consistent patterns, secure by default, scalable
- **Negative**: More complex than simple CRUD, requires careful design

---

## ADR-004: Database Schema Design

### Status: ✅ Accepted

### Context

Need a database schema that supports:

- Multi-tenant SaaS architecture
- Geospatial data for fiber routes
- Audit trails and data history
- Performance at scale

### Decision

- **Multi-tenancy**: Organization-based isolation with RLS
- **Geospatial**: PostGIS for fiber routes and locations
- **Audit**: Automatic timestamps with triggers
- **Performance**: Strategic indexing including spatial indexes
- **Types**: Custom enums for status fields

### Rationale

- **RLS**: Database-level tenant isolation
- **PostGIS**: Industry standard for geospatial data
- **Triggers**: Automatic audit trails without application logic
- **Indexes**: Optimized for common query patterns

### Consequences

- **Positive**: Secure, performant, audit-compliant
- **Negative**: More complex migrations, PostgreSQL-specific features

---

## ADR-005: State Management Strategy

### Status: 🟡 In Progress

### Context

Need client-side state management for:

- Server data caching and synchronization
- UI state management
- Offline capabilities (mobile)
- Real-time updates

### Decision

- **Server State**: React Query (TanStack Query)
- **Client State**: Zustand for simple UI state
- **Real-time**: Supabase subscriptions with React Query invalidation
- **Offline**: SQLite for mobile with sync queue

### Rationale

- **React Query**: Excellent caching, background updates, optimistic updates
- **Zustand**: Lightweight, TypeScript-friendly, minimal boilerplate
- **Supabase Real-time**: Built-in WebSocket support
- **SQLite**: Reliable offline storage for mobile

### Consequences

- **Positive**: Optimized data fetching, good offline support
- **Negative**: Learning curve, complex sync logic for offline

---

## ADR-006: Authentication & Authorization

### Status: 🔴 Planned

### Context

Need secure authentication supporting:

- Multiple user roles (admin, manager, field worker, customer)
- Organization-based access control
- Mobile app authentication
- Session management

### Decision

- **Provider**: Supabase Auth
- **Tokens**: JWT with organization and role claims
- **Roles**: Enum-based role system with hierarchical permissions
- **Sessions**: Automatic token refresh
- **Mobile**: Secure token storage with device keychain

### Rationale

- **Supabase Auth**: Integrated with database, handles complexity
- **JWT**: Stateless, works across platforms
- **Role-based**: Flexible permission system
- **Secure Storage**: Platform-specific secure storage

### Consequences

- **Positive**: Secure, scalable, integrated
- **Negative**: Vendor lock-in, limited customization

---

## ADR-007: Mobile Architecture

### Status: 🔴 Planned

### Context

Mobile app requirements:

- Offline-first operation
- GPS and camera integration
- Real-time synchronization
- Cross-platform (iOS/Android)

### Decision

- **Framework**: React Native with Expo
- **Offline Storage**: SQLite with sync queue
- **Maps**: MapBox React Native SDK
- **Camera**: Expo Camera with GPS tagging
- **Sync**: Background sync with conflict resolution

### Rationale

- **React Native**: Code sharing with web app
- **Expo**: Simplified development and deployment
- **SQLite**: Reliable offline storage
- **MapBox**: Consistent mapping across platforms

### Consequences

- **Positive**: Code reuse, rapid development, native performance
- **Negative**: Platform limitations, complex sync logic

---

## ADR-008: Testing Strategy

### Status: 🟡 In Progress

### Context

Need comprehensive testing for:

- API endpoints and business logic
- Database operations and RLS policies
- UI components and user flows
- Mobile app functionality

### Decision

- **Unit Tests**: Jest for API routes and utilities
- **Integration Tests**: Supabase test database
- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright for web, Detox for mobile
- **API Tests**: OpenAPI contract testing

### Rationale

- **Jest**: Standard Node.js testing framework
- **RTL**: Best practices for React component testing
- **Playwright**: Reliable cross-browser E2E testing
- **Contract Testing**: Ensures API consistency

### Consequences

- **Positive**: High confidence in deployments, regression prevention
- **Negative**: Test maintenance overhead, slower development initially

---

## ADR-009: Deployment & DevOps

### Status: 🟡 In Progress

### Context

Need deployment strategy supporting:

- Continuous integration/deployment
- Environment management (dev/staging/prod)
- Database migrations
- Mobile app distribution

### Decision

- **Web Hosting**: Vercel with GitHub integration
- **Mobile Distribution**: Expo Application Services (EAS)
- **CI/CD**: GitHub Actions
- **Database**: Supabase managed hosting
- **Migrations**: Supabase CLI with version control

### Rationale

- **Vercel**: Optimized for Next.js, automatic deployments
- **EAS**: Simplified mobile app builds and distribution
- **GitHub Actions**: Integrated with repository, flexible workflows
- **Managed Services**: Reduced operational overhead

### Consequences

- **Positive**: Automated deployments, reduced DevOps complexity
- **Negative**: Vendor lock-in, limited infrastructure control

---

## ADR-010: Error Handling & Monitoring

### Status: 🔴 Planned

### Context

Need comprehensive error handling and monitoring for:

- API errors and validation
- Database errors and constraints
- Client-side errors and crashes
- Performance monitoring

### Decision

- **API Errors**: Standardized error responses with codes
- **Validation**: Zod schemas with detailed error messages
- **Logging**: Structured logging with request IDs
- **Monitoring**: Application performance monitoring (APM)
- **Alerting**: Critical error notifications

### Rationale

- **Standardization**: Consistent error handling across the application
- **Observability**: Comprehensive monitoring and debugging
- **User Experience**: Clear error messages and graceful degradation

### Consequences

- **Positive**: Better debugging, improved reliability
- **Negative**: Additional complexity, monitoring costs

---

## 📋 Decision Summary

| ADR | Decision              | Status         | Impact |
| --- | --------------------- | -------------- | ------ |
| 001 | Technology Stack      | ✅ Accepted    | High   |
| 002 | Monorepo Architecture | ✅ Accepted    | Medium |
| 003 | API Design Pattern    | ✅ Accepted    | High   |
| 004 | Database Schema       | ✅ Accepted    | High   |
| 005 | State Management      | 🟡 In Progress | Medium |
| 006 | Authentication        | 🔴 Planned     | High   |
| 007 | Mobile Architecture   | 🔴 Planned     | High   |
| 008 | Testing Strategy      | 🟡 In Progress | Medium |
| 009 | Deployment & DevOps   | 🟡 In Progress | Medium |
| 010 | Error Handling        | 🔴 Planned     | Medium |

---

**Next**: Review [Technical Architecture](technical-architecture.md) for implementation details.
