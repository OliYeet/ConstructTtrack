# 🚀 Installation Guide

> **Complete setup instructions for ConstructTrack development environment**

This guide will walk you through setting up ConstructTrack for development, from initial clone to
running the application.

## 📋 Prerequisites

### Supported Platforms

| Platform                  | Support Level        | Notes                                |
| ------------------------- | -------------------- | ------------------------------------ |
| **macOS**                 | ✅ Full Support      | Recommended for iOS development      |
| **Windows 10/11**         | ✅ Full Support      | WSL2 recommended for best experience |
| **Linux (Ubuntu/Debian)** | ✅ Full Support      | Tested on Ubuntu 20.04+              |
| **Linux (Other)**         | 🟡 Community Support | May require additional setup         |

### System Requirements

#### Minimum Requirements

- **RAM**: 8GB (16GB recommended for mobile development)
- **Storage**: 10GB free space (20GB+ recommended)
- **CPU**: Multi-core processor (Intel/AMD/Apple Silicon)
- **Internet**: Stable connection for package downloads

#### For Mobile Development

- **macOS**: Xcode 14+ for iOS development
- **Windows/Linux**: Android Studio for Android development
- **RAM**: 16GB recommended for emulator performance

### Required Software

#### Node.js (v18.19.0 or higher)

```bash
# Check Node.js version
node --version  # Should be 18.19.0+

# If not installed, use Node Version Manager (recommended)
# macOS/Linux:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18.19.0

# Windows:
# Download nvm-windows from: https://github.com/coreybutler/nvm-windows
```

#### Package Manager

```bash
# npm (comes with Node.js)
npm --version   # Should be 10.0.0+

# Or yarn (optional but recommended)
npm install -g yarn
yarn --version

# Or pnpm (alternative)
npm install -g pnpm
pnpm --version
```

#### Git Version Control

```bash
# Check Git version
git --version  # Should be 2.30.0+

# Install if needed:
# macOS: xcode-select --install
# Windows: Download from https://git-scm.com/
# Linux: sudo apt install git
```

#### Code Editor

- **VS Code** (recommended) with extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier - Code formatter
  - React Native Tools
  - Expo Tools
  - GitLens
  - Auto Rename Tag
  - Bracket Pair Colorizer

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

#### Required Environment Variables

ConstructTrack requires several environment variables to function properly:

```bash
# Copy environment template
cp .env.example .env

# Interactive setup (recommended)
npm run env:setup
```

#### Manual Environment Setup

If you prefer to configure manually, edit `.env` with the following variables:

```bash
# Database Configuration (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Mapping Services (MapBox)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token

# Authentication & Security
JWT_SECRET=your-jwt-secret-min-32-characters
ENCRYPTION_KEY=your-32-character-encryption-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Project Management Integration (Optional)
NOTION_API_KEY=secret_your-notion-integration-key
NOTION_DATABASE_ID=your-notion-database-id
NOTION_WEBHOOK_SECRET=your-webhook-secret

# Communication Services (Optional)
WHATSAPP_BUSINESS_TOKEN=your-whatsapp-token
EMAIL_SERVICE_API_KEY=your-email-service-key
SMS_SERVICE_API_KEY=your-sms-service-key

# Development Configuration
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Webhook Configuration (for Notion sync)
WEBHOOK_PORT=3001
NGROK_TUNNEL_URL=https://your-ngrok-url.ngrok-free.app
```

#### Environment Variable Validation

```bash
# Validate all environment variables
npm run env:validate

# Check specific variables
npm run env:check

# Get help with environment setup
npm run env:help
```

#### Security Notes

⚠️ **Important Security Guidelines:**

1. **Never commit `.env` files** to version control
2. **Use strong, unique secrets** for JWT_SECRET and ENCRYPTION_KEY
3. **Rotate API keys regularly** in production
4. **Use different keys** for development and production
5. **Limit API key permissions** to minimum required scope

See [Environment Variables Guide](../environment-variables.md) for detailed configuration and
security best practices.

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

**Next Steps**: Once installation is complete, check out the [Quick Start Guide](quick-start.md) to
begin development.
