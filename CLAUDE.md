# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TiefbauApp (ConstructTrack) is a fiber optic installation management platform built as a TypeScript monorepo with Next.js web and React Native mobile applications. The system focuses on field worker tools, project management, and real-time geospatial tracking using Supabase as the backend.

## Development Commands

### Primary Development

```bash
npm run dev              # Start both web and mobile
npm run web:dev          # Web development server (Next.js)
npm run mobile:dev       # Mobile development server (Expo)
npm run build            # Build all applications
npm run packages:build   # Build shared packages first
```

### Testing & Quality

```bash
npm test                 # Run all tests (37 tests, <1s execution)
npm test:watch           # Run tests in watch mode
npm test:coverage        # Generate coverage report
npm run lint             # ESLint with TypeScript
npm run type-check       # TypeScript checking
npm run format           # Prettier formatting
```

### Database Management

```bash
npm run db:start         # Start local Supabase
npm run db:migrate       # Push migrations
npm run db:types         # Generate TypeScript types
npm run db:reset         # Reset database
npm run db:setup         # Full database setup
```

### Environment & Setup

```bash
npm run env:setup        # Interactive environment setup
npm run env:validate     # Validate environment variables
npm run workspace:validate  # Validate monorepo structure
```

## Architecture

### Monorepo Structure

- `apps/web/` - Next.js 15.3.3 web application with API routes
- `apps/mobile/` - React Native 0.76.3 + Expo 53 mobile app
- `packages/` - Shared workspace packages (planned: shared, ui, supabase)
- `supabase/` - Database schema with 10 migrations including geospatial and monitoring features
- `scripts/` - Development utilities and database management tools
- `tests/` - Root-level unit tests for core functionality

### Testing Philosophy

The testing infrastructure has been deliberately simplified for rapid early development:
- **Focus**: Essential unit tests and basic API endpoint tests only
- **Structure**: Tests in `/tests/unit/` and `/apps/web/src/__tests__/`
- **Approach**: Mocked external dependencies, no database integration tests
- **Execution**: All tests run in <1 second for fast feedback loops

Current test coverage:
- Core business logic (math, string manipulation, array operations)
- Validation utilities (email, UUID, password, project data)
- API endpoints (health, projects) with mocked responses
- Total: 37 tests across 5 test files

### Database Schema

- Multi-tenant with organization-based Row Level Security
- PostGIS extension for geospatial fiber route mapping
- Core entities: organizations, profiles, projects, fiber_routes, tasks, photos
- UUID primary keys, automatic timestamps, JSONB metadata fields

### API Structure

RESTful API at `/api/v1/` with health, projects, monitoring, and performance endpoints. Uses standardized response format with comprehensive error handling.

### Monitoring System

Advanced real-time monitoring with:
- Connection, throughput, resource, and queue depth collectors
- P99 latency tracking with configurable thresholds
- TimescaleDB adapter for metrics persistence
- Configurable alert system with cooldown periods

## Key Dependencies

- **Frontend**: Next.js 15.3.3, React 19, TypeScript 5.3.3, Tailwind CSS 4
- **Mobile**: React Native 0.76.3, Expo SDK 53
- **Backend**: Supabase (PostgreSQL + PostGIS + Auth + Real-time)
- **Mapping**: MapBox GL JS (web), React Native MapBox SDK (mobile)
- **Testing**: Jest 29.7.0 with minimal configuration

## Development Notes

- Always run `npm run packages:build` before building applications
- Use workspace aliases: `@constructtrack/shared`, `@constructtrack/ui`, `@constructtrack/supabase`
- Database migrations are tracked in `supabase/migrations/` with 10 current migrations
- Environment variables must be validated with `npm run env:validate`
- Real-time monitoring configuration is extensive - check `apps/web/src/lib/monitoring/config/`
- All database tables use UUID primary keys and have RLS policies implemented
- Tests are intentionally minimal - focus on critical functionality over coverage metrics