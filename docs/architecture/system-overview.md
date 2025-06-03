# 🏗️ System Architecture Overview

> **High-level architecture of the ConstructTrack platform**

ConstructTrack is designed as a modern, scalable fiber optic installation management platform with a
focus on real-time collaboration, mobile-first design, and geospatial data management.

## 📊 Implementation Status

### Current Development State

- **Foundation**: ✅ Complete - Project setup, environment, and basic infrastructure
- **API Layer**: 🟡 In Progress - Base structure implemented, expanding endpoints
- **Database**: ✅ Complete - Schema designed and migrated with PostGIS support
- **Authentication**: 🔴 Planned - Supabase Auth integration pending
- **Web Client**: 🟡 In Progress - Next.js app with basic API integration
- **Mobile Client**: 🔴 Planned - React Native setup complete, features pending
- **Mapping**: 🔴 Planned - MapBox integration architecture defined

## 🎯 Architecture Principles

### Core Design Goals

- **Mobile-First**: Optimized for field workers using mobile devices
- **Real-time**: Live updates across all connected clients
- **Offline-Capable**: Works without internet connectivity
- **Scalable**: Handles growing teams and project complexity
- **Secure**: Enterprise-grade security and data protection

### Technology Decisions

- **TypeScript**: Type safety across the entire stack
- **Monorepo**: Shared code and consistent tooling
- **Supabase**: Managed backend with real-time capabilities
- **React Ecosystem**: Consistent UI patterns across platforms

### Architectural Patterns

- **API-First Design**: RESTful APIs with OpenAPI 3.0 specification
- **Domain-Driven Design**: Clear separation of business domains
- **Event-Driven Architecture**: Real-time updates via Supabase subscriptions
- **Multi-Tenant SaaS**: Organization-based data isolation with RLS

## 🏛️ High-Level Architecture

### System Overview Diagram

> 📊 **Interactive Diagram**: See [System Architecture Diagram](system-architecture-diagram.md) for
> a detailed Mermaid diagram that can be viewed in GitHub or any Mermaid-compatible viewer.

```
                    ConstructTrack Fiber Optic Management Platform
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        ▼                               ▼                               ▼
┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
│   Web Client    │            │  Mobile Client  │            │  Admin Portal   │
│   (Next.js)     │            │ (React Native)  │            │   (Next.js)     │
│                 │            │                 │            │                 │
│ • Project Mgmt  │            │ • Field Tools   │            │ • System Admin  │
│ • Dashboards    │            │ • GPS Tracking  │            │ • User Mgmt     │
│ • Reporting     │            │ • Photo Capture │            │ • Analytics     │
│ • Customer UI   │            │ • Offline Mode  │            │ • Configuration │
└─────────┬───────┘            └─────────┬───────┘            └─────────┬───────┘
          │                              │                              │
          │                              │                              │
          └──────────────────────────────┼──────────────────────────────┘
                                         │
                                         ▼
                            ┌─────────────────────────┐
                            │     API Gateway         │
                            │   (Supabase Edge)       │
                            │                         │
                            │ • Authentication        │
                            │ • Rate Limiting         │
                            │ • Request Routing       │
                            │ • Response Caching      │
                            └─────────────┬───────────┘
                                          │
                ┌─────────────────────────┼─────────────────────────┐
                │                         │                         │
                ▼                         ▼                         ▼
    ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
    │     Database        │   │   Auth Service      │   │   File Storage      │
    │  (PostgreSQL +      │   │   (Supabase)        │   │   (Supabase)        │
    │     PostGIS)        │   │                     │   │                     │
    │                     │   │ • JWT Tokens        │   │ • Photos/Documents  │
    │ • Projects          │   │ • Role-Based Access │   │ • Map Tiles         │
    │ • Users/Teams       │   │ • Session Mgmt      │   │ • File Versioning   │
    │ • Fiber Routes      │   │ • Password Policies │   │ • CDN Distribution  │
    │ • Work Areas        │   │ • 2FA Support       │   │ • Backup/Archive    │
    │ • Tasks/Progress    │   │ • Audit Logging     │   │ • Access Control    │
    │ • Geospatial Data   │   └─────────────────────┘   └─────────────────────┘
    │ • Real-time Sync    │
    └─────────────────────┘
                │
                ▼
    ┌─────────────────────┐
    │  External Services  │
    │                     │
    │ • MapBox API        │
    │ • Weather Services  │
    │ • Geocoding APIs    │
    │ • Email/SMS         │
    │ • WhatsApp Business │
    │ • Notion API        │
    └─────────────────────┘
```

### Key Components Summary

#### Client Applications

- **Web Client (Next.js)**: Management dashboard for project oversight, reporting, and customer
  interactions
- **Mobile Client (React Native)**: Field worker tools with offline capabilities, GPS tracking, and
  photo documentation
- **Admin Portal**: System administration, user management, and platform configuration

#### Backend Services

- **API Gateway (Supabase Edge)**: Centralized request handling, authentication, and routing
- **Database (PostgreSQL + PostGIS)**: Primary data store with geospatial capabilities
- **Authentication Service**: JWT-based auth with role-based access control
- **File Storage**: Secure file management with CDN distribution

#### External Integrations

- **MapBox**: Interactive mapping and geospatial services
- **Communication APIs**: Email, SMS, and WhatsApp integration
- **Third-party Services**: Weather data, geocoding, and project management tools

## 📱 Client Applications

### Web Application (Next.js)

- **Purpose**: Management dashboard and administrative interface
- **Users**: Project managers, administrators, office staff
- **Features**:
  - Project planning and oversight
  - Team management
  - Reporting and analytics
  - Customer portal

### Mobile Application (React Native + Expo)

- **Purpose**: Field worker tools and data collection
- **Users**: Field technicians, installers, surveyors
- **Features**:
  - GPS-enabled task management
  - Photo documentation with geotags
  - Offline data collection
  - Real-time progress updates

## 🗄️ Backend Architecture

### Supabase Platform (Current Implementation)

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Platform                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   PostgreSQL    │   Auth Service  │    Edge Functions       │
│   + PostGIS     │   (Planned)     │     (Future)            │
├─────────────────┼─────────────────┼─────────────────────────┤
│  Real-time      │  File Storage   │    API Gateway          │
│  Subscriptions  │   (Planned)     │   (Next.js API)         │
│   (Planned)     │                 │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Database Layer (✅ Implemented)

- **PostgreSQL**: Primary data store with ACID compliance
- **PostGIS**: Geospatial data extension for mapping features
- **Row Level Security**: Multi-tenant data isolation (policies defined)
- **Real-time**: WebSocket-based live updates (planned)
- **Schema**: Complete with organizations, projects, fiber_routes, tasks, photos

### Current Database Schema

```sql
-- Core Tables (Implemented)
organizations     # Multi-tenant isolation
profiles         # User management extending auth.users
projects         # Project management with geospatial data
fiber_routes     # Fiber optic route planning with PostGIS
fiber_connections # Connection points and equipment
tasks            # Work assignment and tracking
photos           # Geotagged documentation
customer_agreements # Legal documentation

-- Key Features
- UUID primary keys
- Automatic timestamps with triggers
- Geospatial indexes (GIST)
- JSONB metadata fields
- Enum types for status management
```

### API Architecture (🟡 In Progress)

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Middleware    │   Route Handlers │    Response Utils       │
│                 │                 │                         │
│ • withAuth      │ • /api/v1/      │ • Standardized          │
│ • Rate Limiting │   projects ✅   │   responses             │
│ • Validation    │ • /api/v1/      │ • Error handling        │
│ • CORS          │   health ✅     │ • Pagination            │
│                 │ • /api/v1/test ✅│                        │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Authentication & Authorization (🔴 Planned)

- **Supabase Auth**: Email/password, OAuth providers
- **JWT Tokens**: Stateless authentication
- **Role-Based Access Control**: Admin, Manager, Field Worker, Customer
- **Organization Isolation**: Data segregation by company
- **Row Level Security**: Database-level access control

## 🗺️ Geospatial Architecture

### Mapping Stack

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MapBox GL JS  │    │  React Native   │    │    PostGIS      │
│   (Web Maps)    │    │   MapBox SDK    │    │  (Geospatial    │
│                 │    │  (Mobile Maps)  │    │   Database)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │    Geospatial API         │
                    │  (Supabase Functions)     │
                    └───────────────────────────┘
```

### Geospatial Features

- **Fiber Route Management**: Line strings for cable paths
- **Work Area Polygons**: Geofenced project boundaries
- **Point Assets**: Equipment locations and customer premises
- **GPS Tracking**: Real-time field worker locations

## 📊 Data Flow Architecture

### Real-time Data Synchronization

```
Mobile App ──┐
             ├──► Supabase Real-time ──► Web Dashboard
Web Client ──┘                      └──► Other Clients
```

### Offline-First Mobile Strategy

```
Mobile App ──► Local Storage ──► Sync Queue ──► Supabase
     ↑                                            │
     └────────── Conflict Resolution ←────────────┘
```

## 🔐 Security Architecture

### Multi-Layer Security

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Transport     │   Application   │      Data Layer         │
│   (HTTPS/TLS)   │   (JWT/RLS)     │   (Encryption at Rest)  │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Security Features

- **Transport Security**: HTTPS/TLS encryption
- **Authentication**: JWT-based stateless auth
- **Authorization**: Row Level Security policies
- **Data Encryption**: At-rest and in-transit
- **API Security**: Rate limiting and input validation

## 📦 Package Architecture

### Monorepo Structure (Current Implementation)

```
ConstructTrack/
├── apps/
│   ├── web/                    # Next.js Web Application
│   │   ├── src/
│   │   │   ├── app/           # App Router structure
│   │   │   │   ├── api/v1/    # API routes (projects, health, test)
│   │   │   │   ├── docs/      # API documentation viewer
│   │   │   │   └── page.tsx   # Landing page
│   │   │   ├── lib/           # Shared utilities
│   │   │   │   ├── api/       # API middleware, validation, responses
│   │   │   │   └── errors/    # Error handling utilities
│   │   │   ├── tests/         # Test suites
│   │   │   └── types/         # TypeScript definitions
│   │   └── package.json       # Web app dependencies
│   └── mobile/                # React Native Mobile App
│       ├── App.tsx            # Main mobile app component
│       ├── assets/            # Mobile assets
│       └── package.json       # Mobile app dependencies
├── packages/
│   ├── shared/                # Common utilities and types
│   │   ├── src/               # Source code
│   │   ├── types/             # Shared TypeScript definitions
│   │   ├── utils/             # Helper functions
│   │   └── constants/         # Application constants
│   ├── ui/                    # Shared UI components
│   │   └── index.ts           # Component exports
│   └── supabase/              # Database client and types
│       ├── client/            # Supabase client setup
│       ├── types/             # Database type definitions
│       └── index.ts           # Client exports
├── supabase/
│   ├── migrations/            # Database schema migrations
│   │   └── 001_initial_schema.sql
│   └── config.toml            # Supabase configuration
├── docs/                      # Comprehensive documentation
│   ├── api/                   # API documentation
│   ├── architecture/          # System architecture docs
│   ├── development/           # Development guides
│   └── features/              # Feature specifications
└── scripts/                   # Automation and utility scripts
    ├── env-setup.js           # Environment setup
    ├── env-validator.js       # Environment validation
    └── test-*.js              # Testing utilities
```

### Package Dependencies & Communication

```
┌─────────────────┐    ┌─────────────────┐
│   Web App       │    │   Mobile App    │
│   (Next.js)     │    │ (React Native)  │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌─────────────────┐
          │   Shared Packages │
          ├─────────────────┤
          │ @constructtrack/ │
          │ ├── shared      │
          │ ├── ui          │
          │ └── supabase    │
          └─────────────────┘
```

## 🔄 Integration Architecture

### External Service Integrations

```
ConstructTrack ──┬──► MapBox (Mapping)
                 ├──► Notion (Project Management)
                 ├──► WhatsApp (Communication)
                 ├──► Email Services (Notifications)
                 └──► Weather APIs (Field Conditions)
```

### Webhook Architecture

```
External Service ──► Webhook Endpoint ──► Event Processing ──► Database Update
                                      └──► Real-time Broadcast
```

## 📈 Scalability Considerations

### Horizontal Scaling

- **Stateless Architecture**: No server-side sessions
- **Database Scaling**: Supabase managed scaling
- **CDN Integration**: Static asset distribution
- **Edge Functions**: Geographically distributed compute

### Performance Optimization

- **Code Splitting**: Lazy loading of application modules
- **Image Optimization**: Automatic image compression and resizing
- **Caching Strategy**: Multi-level caching (browser, CDN, database)
- **Bundle Optimization**: Tree shaking and minification

## 🔍 Monitoring & Observability

### Application Monitoring

```
Application ──► Metrics Collection ──► Dashboard
            └──► Error Tracking    ──► Alerting
            └──► Performance APM   ──► Analytics
```

### Key Metrics

- **Performance**: Response times, throughput
- **Reliability**: Error rates, uptime
- **Usage**: Active users, feature adoption
- **Business**: Project completion rates, efficiency gains

## 🚀 Deployment Architecture

### Environment Strategy

```
Development ──► Staging ──► Production
     ↑              ↑           ↑
   Local Dev    Integration   Live System
```

### Infrastructure

- **Vercel**: Web application hosting
- **Expo**: Mobile app distribution
- **Supabase**: Managed backend services
- **GitHub Actions**: CI/CD pipeline

## 🚧 Development Roadmap & Next Steps

### Immediate Priorities (Story 0.2 Completion)

1. **🔐 Authentication Integration** - Implement Supabase Auth with JWT tokens
2. **🗄️ Database Schema Refinement** - Add RLS policies and optimize queries
3. **🔄 Migration System** - Complete database versioning and seed data
4. **📋 API Expansion** - Add remaining CRUD endpoints for all entities

### Phase 1: Core Platform (Weeks 1-4)

- ✅ Project foundation and environment setup
- 🟡 API architecture and basic endpoints
- 🔴 User authentication and authorization
- 🔴 Basic project management features

### Phase 2: Mapping & Geospatial (Weeks 4-8)

- 🔴 MapBox integration and interactive maps
- 🔴 Fiber route visualization and editing
- 🔴 GPS tracking and geofencing
- 🔴 Offline map capabilities

### Phase 3: Mobile & Field Tools (Weeks 8-12)

- 🔴 React Native app development
- 🔴 Photo documentation with GPS tagging
- 🔴 Offline data collection and sync
- 🔴 Field worker task management

### Phase 4: Advanced Features (Weeks 12-16)

- 🔴 WhatsApp integration for communication
- 🔴 Customer portal and agreements
- 🔴 Advanced reporting and analytics
- 🔴 Third-party integrations

## 🔧 Development Guidelines

### Code Organization Principles

- **Domain-Driven Structure**: Organize code by business domains
- **Shared-First**: Maximize code reuse between web and mobile
- **Type-Safe**: Leverage TypeScript for compile-time safety
- **Test-Driven**: Write tests alongside feature development

### API Design Standards

- **RESTful Conventions**: Standard HTTP methods and status codes
- **OpenAPI Documentation**: Maintain up-to-date API specifications
- **Versioning Strategy**: Use URL versioning (/api/v1/)
- **Error Handling**: Consistent error response format

### Database Design Patterns

- **Multi-Tenancy**: Organization-based data isolation
- **Audit Trails**: Track all data changes with timestamps
- **Soft Deletes**: Preserve data integrity with status flags
- **Geospatial Optimization**: Proper indexing for location queries

---

**Next**: Explore specific architectural components in [Database Schema](database-schema.md) and
[API Design](../api/api-overview.md).
