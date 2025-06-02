# 🚀 Installation Guide

> **Complete setup instructions for ConstructTrack development environment**

This guide will walk you through setting up ConstructTrack for development, from initial clone to running the application.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js** (v18.0.0 or higher)
  ```bash
  node --version  # Should be 18.0.0+
  ```

- **npm** (v8.0.0 or higher) or **yarn**
  ```bash
  npm --version   # Should be 8.0.0+
  ```

- **Git** (latest version)
  ```bash
  git --version
  ```

### Development Tools

- **Expo CLI** (for mobile development)
  ```bash
  npm install -g @expo/cli
  ```

- **VS Code** (recommended) with extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - React Native Tools

### Required Services

You'll need accounts and API keys for:

1. **Supabase** - Database and authentication
2. **MapBox** - Mapping services
3. **Notion** (optional) - Project management sync

## 🛠️ Installation Steps

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/OliYeet/ConstructTtrack.git
cd TiefbauApp

# Verify you're on the main branch
git branch
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Build shared packages
npm run packages:build
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Interactive setup (recommended)
npm run env:setup

# Or manually edit .env file
```

See [Environment Variables Guide](../environment-variables.md) for detailed configuration.

### 4. Database Setup

```bash
# Test Supabase connection
npm run test:supabase

# Run database migrations (if any)
npm run db:migrate
```

### 5. Verify Installation

```bash
# Validate environment
npm run env:validate

# Check workspace integrity
npm run validate:workspace

# Run basic tests
npm test
```

## 🚀 Running the Application

### Web Application

```bash
# Start web development server
npm run web:dev

# Or navigate to web app directory
cd apps/web
npm run dev
```

The web application will be available at `http://localhost:3000`

### Mobile Application

```bash
# Start mobile development server
npm run mobile:dev

# Or navigate to mobile app directory
cd apps/mobile
npm start
```

### Both Applications

```bash
# Start both web and mobile simultaneously
npm run dev
```

## 🔧 Development Tools Setup

### ESLint and Prettier

Code formatting and linting are automatically configured:

```bash
# Check code quality
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format
```

### Git Hooks

Husky is configured for pre-commit hooks:

```bash
# Hooks are automatically installed after npm install
# They will run linting and formatting on commit
```

## 📱 Mobile Development Setup

### iOS Development

```bash
# Install iOS dependencies (macOS only)
cd apps/mobile
npx pod-install

# Run on iOS simulator
npm run ios
```

### Android Development

```bash
# Run on Android emulator
cd apps/mobile
npm run android
```

## 🗺️ MapBox Setup

1. Create account at [mapbox.com](https://www.mapbox.com/)
2. Get your access token from the dashboard
3. Add to your `.env` file:
   ```
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here
   ```

## 🗄️ Supabase Setup

1. Create project at [supabase.com](https://supabase.com/)
2. Get your project URL and anon key
3. Add to your `.env` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

## ✅ Verification Checklist

- [ ] Node.js and npm installed
- [ ] Repository cloned successfully
- [ ] Dependencies installed without errors
- [ ] Environment variables configured
- [ ] Supabase connection working
- [ ] Web app starts on localhost:3000
- [ ] Mobile app starts with Expo
- [ ] Linting and formatting work
- [ ] Git hooks are active

## 🛠️ Troubleshooting

### Common Issues

**Node version conflicts**
```bash
# Use nvm to manage Node versions
nvm install 18
nvm use 18
```

**Package installation failures**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Expo CLI issues**
```bash
# Update Expo CLI
npm install -g @expo/cli@latest

# Clear Expo cache
npx expo install --fix
```

For more troubleshooting help, see [Common Issues](../troubleshooting/common-issues.md).

## 📞 Getting Help

- **Installation Issues**: Check [Troubleshooting Guide](../troubleshooting/common-issues.md)
- **Environment Setup**: See [Environment Variables Guide](../environment-variables.md)
- **Development Questions**: Review [Development Setup](../development/development-setup.md)

---

**Next Steps**: Once installation is complete, check out the [Quick Start Guide](quick-start.md) to begin development.
