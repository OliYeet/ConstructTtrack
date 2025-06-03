# 🏗️ ConstructTrack System Architecture Diagram

> **Visual representation of the ConstructTrack system architecture**

This document contains the Mermaid diagram for the ConstructTrack system architecture. You can view
this diagram in any Markdown viewer that supports Mermaid (like GitHub, GitLab, or VS Code with
Mermaid extension).

## System Architecture Overview

```mermaid
graph TB
    subgraph "Client Applications"
        WEB["mdi:web Web App<br/>Next.js"]
        MOBILE["mdi:cellphone Mobile App<br/>React Native"]
        ADMIN["mdi:shield-account Admin Portal<br/>Next.js"]
    end

    subgraph "Shared Packages"
        SHARED["mdi:package-variant shared<br/>Types & Utils"]
        UI["mdi:palette ui<br/>Components"]
        SUPABASE_PKG["mdi:database-outline supabase<br/>Client & Types"]
    end

    subgraph "API Layer"
        API["mdi:api Next.js API Routes<br/>/api/v1/*"]
        MIDDLEWARE["mdi:shield-check Middleware<br/>Auth, Validation, CORS"]
        DOCS["mdi:file-document API Documentation<br/>OpenAPI 3.0"]
    end

    subgraph "Supabase Platform"
        AUTH["mdi:account-key Authentication<br/>JWT Tokens"]
        DB[("mdi:database PostgreSQL<br/>+ PostGIS")]
        STORAGE["mdi:folder-image File Storage<br/>Photos & Documents"]
        REALTIME["mdi:lightning-bolt Real-time<br/>WebSocket"]
    end

    subgraph "External Services"
        MAPBOX["mdi:map MapBox<br/>Mapping & GPS"]
        WHATSAPP["mdi:whatsapp WhatsApp<br/>Business API"]
        EMAIL["mdi:email Email<br/>Notifications"]
        NOTION["mdi:notebook Notion<br/>Project Sync"]
    end

    %% Client to Shared Packages
    WEB --> SHARED
    WEB --> UI
    WEB --> SUPABASE_PKG
    MOBILE --> SHARED
    MOBILE --> UI
    MOBILE --> SUPABASE_PKG
    ADMIN --> SHARED
    ADMIN --> UI
    ADMIN --> SUPABASE_PKG

    %% Client to API
    WEB --> API
    MOBILE --> API
    ADMIN --> API

    %% API Layer
    API --> MIDDLEWARE
    API --> DOCS

    %% API to Supabase
    MIDDLEWARE --> AUTH
    API --> DB
    API --> STORAGE
    API --> REALTIME

    %% External Integrations
    API --> MAPBOX
    API --> WHATSAPP
    API --> EMAIL
    API --> NOTION

    %% Real-time connections
    REALTIME -.-> WEB
    REALTIME -.-> MOBILE

    %% Styling
    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef shared fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef api fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef backend fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef external fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class WEB,MOBILE,ADMIN client
    class SHARED,UI,SUPABASE_PKG shared
    class API,MIDDLEWARE,DOCS api
    class AUTH,DB,STORAGE,REALTIME backend
    class MAPBOX,WHATSAPP,EMAIL,NOTION external
```

## Component Descriptions

### Client Applications (Blue)

- **Web App**: Next.js-based management dashboard for project oversight
- **Mobile App**: React Native field worker application with offline capabilities
- **Admin Portal**: System administration and configuration interface

### Shared Packages (Purple)

- **shared**: Common utilities, types, and constants used across applications
- **ui**: Reusable React components with consistent styling
- **supabase**: Database client configuration and type definitions

### API Layer (Green)

- **API Routes**: RESTful endpoints following OpenAPI 3.0 specification
- **Middleware**: Authentication, validation, CORS, and rate limiting
- **Documentation**: Interactive API documentation viewer

### Supabase Platform (Orange)

- **Authentication**: JWT-based auth with role-based access control
- **Database**: PostgreSQL with PostGIS for geospatial data
- **Storage**: File storage for photos and documents
- **Real-time**: WebSocket subscriptions for live updates

### External Services (Pink)

- **MapBox**: Interactive mapping and geospatial services
- **WhatsApp**: Business API for communication workflows
- **Email**: Notification and communication services
- **Notion**: Project management integration and sync

## Data Flow Patterns

### Synchronous API Calls

```mermaid
sequenceDiagram
    participant C as mdi:cellphone Client
    participant A as mdi:api API
    participant M as mdi:shield-check Middleware
    participant D as mdi:database Database

    C->>A: HTTP Request
    A->>M: Validate & Auth
    M->>D: Query Data
    D-->>M: Result
    M-->>A: Processed Data
    A-->>C: JSON Response
```

### Real-time Updates

```mermaid
sequenceDiagram
    participant D as mdi:database Database
    participant R as mdi:lightning-bolt Real-time
    participant W as mdi:web Web Client
    participant M as mdi:cellphone Mobile Client

    D->>R: Data Change Event
    R->>W: WebSocket Push
    R->>M: WebSocket Push
    W->>W: Update UI
    M->>M: Update UI
```

### Shared Package Usage

```mermaid
graph LR
    WEB["mdi:web Web App"] --> IMPORT["mdi:import Import"]
    MOBILE["mdi:cellphone Mobile App"] --> IMPORT
    IMPORT --> SHARED["mdi:package-variant Shared Package"]
    SHARED --> UTIL["mdi:tools-outline Utility/Component"]
```

## Viewing Instructions

To view this diagram:

1. **GitHub/GitLab**: The diagram will render automatically in the web interface
2. **VS Code**: Install the "Mermaid Markdown Syntax Highlighting" extension
3. **Local Markdown Viewer**: Use any viewer that supports Mermaid syntax
4. **Mermaid Live Editor**: Copy the diagram code to https://mermaid.live/

## Maintenance

When updating the architecture:

1. Update this diagram to reflect changes
2. Update the corresponding documentation in `system-overview.md`
3. Update the Architecture Decision Records if needed
4. Ensure the diagram stays in sync with the actual implementation

---

**Related Documents**:

- [System Overview](system-overview.md)
- [Technical Architecture](technical-architecture.md)
- [Architecture Decisions](architecture-decisions.md)
