# ⚡ Quick Start Guide

> **Get ConstructTrack running in 5 minutes**

This guide helps you quickly set up and explore ConstructTrack's core features. For detailed setup,
see the [Installation Guide](installation.md).

## 🚀 5-Minute Setup

### 1. Prerequisites Check

```bash
node --version    # Need 18.19.0+
npm --version     # Need 10.0.0+
git --version     # Any recent version
```

**Missing tools?** → [Installation Guide](installation.md#prerequisites)

### 2. Clone & Install

```bash
git clone https://github.com/OliYeet/ConstructTtrack.git
cd TiefbauApp
npm install && npm run packages:build
```

### 3. Environment Setup

```bash
cp .env.example .env
npm run env:setup  # Interactive setup
```

**Need help with environment variables?** → [Environment Guide](../environment-variables.md)

### 4. Start Development

```bash
npm run dev  # Starts both web and mobile
```

**Access Points:**

- 🌐 **Web App**: http://localhost:3000
- 📱 **Mobile App**: Scan QR code with Expo Go app

## 🎯 First Steps

### 1. Explore the Web Dashboard

- Navigate to http://localhost:3000
- Create your first project
- Explore the interactive map interface
- Test project management features

### 2. Try the Mobile App

- Install **Expo Go** on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) |
  [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- Scan QR code from terminal
- Test field worker tools and GPS features

### 3. Key Features to Test

- ✅ **Authentication**: Sign up/login system
- ✅ **Project Management**: Create and manage projects
- ✅ **Interactive Mapping**: MapBox integration with fiber routes
- ✅ **Mobile Tools**: GPS tracking and photo documentation

**Need help?** → [Troubleshooting Guide](../troubleshooting/common-issues.md)

## 🔧 Development Workflow

### Essential Commands

```bash
# Development servers
npm run dev          # Both web and mobile
npm run web:dev      # Web only (localhost:3000)
npm run mobile:dev   # Mobile only (Expo)

# Code quality
npm run lint         # Check code quality
npm run format       # Format with Prettier
npm test             # Run tests
```

### Project Structure

```
apps/web/           # Next.js dashboard
apps/mobile/        # React Native field app
packages/shared/    # Common utilities
packages/ui/        # Shared components
packages/supabase/  # Database client
```

**Learn more:** [Development Setup](../development/development-setup.md)

## 🚀 Next Steps

### For New Developers

1. **📖 Learn the System**: [Architecture Overview](../architecture/system-overview.md)
2. **🔧 Advanced Setup**: [Development Setup](../development/development-setup.md)
3. **🤝 Contributing**: [Contributing Guidelines](../development/contributing.md)

### For Different Roles

- **🏗️ Architects**: [System Architecture](../architecture/system-overview.md) →
  [API Overview](../api/api-overview.md)
- **👩‍💻 Frontend Devs**: [UI Components](../features/mapping.md) →
  [Mobile Guide](../features/mobile.md)
- **🗄️ Backend Devs**: [Database Schema](../architecture/database-schema.md) →
  [API Design](../api/api-overview.md)
- **📱 Mobile Devs**: [Mobile Features](../features/mobile.md) →
  [React Native Setup](installation.md#mobile-development-tools)

### Key Documentation

| Topic               | Quick Reference                                      | Detailed Guide                                                                 |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Setup Issues**    | [Common Issues](../troubleshooting/common-issues.md) | [Installation Guide](installation.md)                                          |
| **Environment**     | [Environment Variables](../environment-variables.md) | [Development Setup](../development/development-setup.md)                       |
| **API Integration** | [API Overview](../api/api-overview.md)               | [Projects API](../api/projects.md)                                             |
| **Mapping**         | [Mapping Features](../features/mapping.md)           | [MapBox Integration](../features/mapping.md#mapbox-integration)                |
| **Testing**         | [Testing Guide](../development/testing.md)           | [Contributing Guidelines](../development/contributing.md#testing-requirements) |

## 🛠️ Quick Troubleshooting

**Common Issues:**

- **Port conflicts**: Change ports in `.env` file
- **Environment errors**: Run `npm run env:validate`
- **Package issues**: Delete `node_modules` and reinstall
- **Expo problems**: Run `npx expo install --fix`

**Need more help?** → [Troubleshooting Guide](../troubleshooting/common-issues.md)

## 🤝 Getting Help

- **🐛 Found a bug?** Create a [GitHub issue](https://github.com/OliYeet/ConstructTtrack/issues)
- **❓ Have questions?** Check the [documentation](../README.md)
- **💬 Want to discuss?** Join team discussions

---

**Ready to contribute?** Check out the [Contributing Guidelines](../development/contributing.md) to
get started!
