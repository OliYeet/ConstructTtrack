# ⚡ Quick Start Guide

> **Get ConstructTrack running in 5 minutes**

This guide helps you quickly set up and explore ConstructTrack's core features.

## 🚀 5-Minute Setup

### 1. Prerequisites Check
```bash
node --version    # Should be 18+
npm --version     # Should be 8+
git --version     # Any recent version
```

### 2. Clone & Install
```bash
git clone https://github.com/OliYeet/ConstructTtrack.git
cd TiefbauApp
npm install
npm run packages:build
```

### 3. Environment Setup
```bash
cp .env.example .env
npm run env:setup  # Interactive setup
```

### 4. Start Development
```bash
npm run dev  # Starts both web and mobile
```

## 🎯 First Steps

### Access the Applications

- **Web App**: http://localhost:3000
- **Mobile App**: Scan QR code in terminal with Expo Go app

### Explore Key Features

1. **Authentication** - Sign up/login system
2. **Project Dashboard** - Create and manage projects
3. **Interactive Map** - View fiber routes and locations
4. **Mobile Interface** - Field worker tools

## 🗺️ Core Features Demo

### 1. Create Your First Project

```bash
# Web interface at localhost:3000
1. Click "New Project"
2. Enter project details
3. Set location on map
4. Save project
```

### 2. Explore the Map

- **Zoom/Pan**: Navigate the MapBox interface
- **Add Markers**: Click to add fiber route points
- **Draw Routes**: Connect points to create fiber paths
- **Layer Controls**: Toggle different map layers

### 3. Mobile App Testing

```bash
# On your mobile device with Expo Go
1. Scan QR code from terminal
2. Test GPS functionality
3. Take sample photos
4. View offline capabilities
```

## 🔧 Development Workflow

### Code Structure
```
apps/
├── web/          # Next.js web application
├── mobile/       # React Native mobile app
packages/
├── shared/       # Shared utilities
├── ui/           # UI components
└── supabase/     # Database client
```

### Common Commands
```bash
# Development
npm run web:dev      # Web only
npm run mobile:dev   # Mobile only
npm run dev          # Both applications

# Code Quality
npm run lint         # Check code quality
npm run format       # Format code
npm run type-check   # TypeScript validation

# Testing
npm test             # Run tests
npm run test:watch   # Watch mode
```

## 📱 Mobile Development

### iOS Setup
```bash
cd apps/mobile
npm run ios          # Requires Xcode
```

### Android Setup
```bash
cd apps/mobile
npm run android      # Requires Android Studio
```

### Web Preview
```bash
cd apps/mobile
npm run web          # Test mobile app in browser
```

## 🗄️ Database & Backend

### Supabase Integration
- **Authentication**: Email/password login
- **Real-time**: Live data updates
- **Storage**: File uploads and management
- **PostGIS**: Geospatial data support

### Test Database Connection
```bash
npm run test:supabase
```

## 🎨 UI/UX Features

### Design System
- **Tailwind CSS**: Utility-first styling
- **Responsive Design**: Mobile-first approach
- **Dark/Light Mode**: Theme switching
- **Component Library**: Reusable UI components

### Key Components
- Interactive maps with MapBox
- Form builders for customer agreements
- Photo galleries with GPS tagging
- Real-time progress indicators

## 🔐 Authentication Flow

### User Roles
- **Admin**: Full system access
- **Manager**: Project management
- **Field Worker**: Mobile app access
- **Customer**: Limited portal access

### Test Authentication
```bash
# Create test user in Supabase dashboard
# Or use demo credentials (if configured)
```

## 📊 Project Management

### Notion Integration
```bash
# Sync project data with Notion
npm run notion:sync

# Setup webhook for real-time updates
npm run notion:webhook
```

### Agile Workflow
- Epic → Story → Task hierarchy
- Story points and progress tracking
- Team assignments and role-based planning

## 🛠️ Troubleshooting Quick Fixes

### Common Issues

**Port conflicts**
```bash
# Change ports in package.json or .env
NEXT_PUBLIC_PORT=3001
EXPO_PORT=19001
```

**Environment variables**
```bash
# Validate configuration
npm run env:validate

# Reset environment
npm run env:setup
```

**Package issues**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

**Expo issues**
```bash
# Clear Expo cache
npx expo install --fix
```

## 📚 Next Steps

### Learn More
- [**Installation Guide**](installation.md) - Detailed setup instructions
- [**Architecture Overview**](../architecture/system-overview.md) - System design
- [**API Documentation**](../api/api-overview.md) - Backend integration
- [**User Guides**](../user-guides/) - Feature-specific guides

### Development Resources
- [**Contributing Guidelines**](../development/contributing.md)
- [**Code Standards**](../development/code-standards.md)
- [**Testing Guide**](../development/testing.md)

### Feature Exploration
- [**Mapping Features**](../features/mapping.md)
- [**Mobile App Guide**](../features/mobile.md)
- [**Authentication System**](../features/authentication.md)

## 🤝 Getting Help

- **Issues**: Create GitHub issue
- **Questions**: Check documentation
- **Discussions**: Join team chat

---

**Ready to build?** Start with the [Development Setup Guide](../development/development-setup.md) for advanced configuration.
