# 🛠️ Common Issues & Troubleshooting

> **Solutions to frequently encountered problems in ConstructTrack development**

This guide covers common issues developers encounter when working with ConstructTrack and their solutions.

## 🚀 Installation & Setup Issues

### Node.js Version Conflicts
**Problem**: Different Node.js versions causing compatibility issues

**Solution**:
```bash
# Install and use Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use correct Node version
nvm install 18.19.0
nvm use 18.19.0
nvm alias default 18.19.0

# Verify version
node --version  # Should show v18.19.0
```

### Package Installation Failures
**Problem**: `npm install` fails with dependency conflicts

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# If still failing, try with legacy peer deps
npm install --legacy-peer-deps
```

### Husky Git Hooks Not Working
**Problem**: Pre-commit hooks not running or failing

**Solution**:
```bash
# Reinstall Husky
npm uninstall husky
npm install husky --save-dev

# Reinstall git hooks
npx husky install

# Make hooks executable (Unix/macOS)
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
```

## 🗄️ Database & Supabase Issues

### Supabase Connection Failures
**Problem**: Cannot connect to Supabase database

**Solution**:
```bash
# Check environment variables
npm run env:validate

# Test Supabase connection
npm run test:supabase

# Verify Supabase URL and keys in .env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Database Migration Issues
**Problem**: Migrations failing or not applying

**Solution**:
```bash
# Check Supabase CLI installation
supabase --version

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Reset and reapply migrations
supabase db reset

# Apply specific migration
supabase migration up --target 20250130000001
```

### Row Level Security (RLS) Issues
**Problem**: Data not visible due to RLS policies

**Solution**:
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Temporarily disable RLS for testing (development only)
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;

-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Create basic policy for testing
CREATE POLICY "Allow all for authenticated users" 
ON your_table FOR ALL 
USING (auth.role() = 'authenticated');
```

## 📱 Mobile Development Issues

### Expo CLI Issues
**Problem**: Expo commands not working or outdated

**Solution**:
```bash
# Update Expo CLI
npm uninstall -g expo-cli @expo/cli
npm install -g @expo/cli@latest

# Clear Expo cache
npx expo install --fix

# Reset Expo development server
npx expo start --clear
```

### Metro Bundler Issues
**Problem**: Metro bundler failing to start or bundle

**Solution**:
```bash
# Clear Metro cache
npx expo start --clear

# Reset Metro cache manually
rm -rf node_modules/.cache
rm -rf .expo

# Restart with verbose logging
npx expo start --clear --verbose
```

### iOS Simulator Issues
**Problem**: iOS simulator not starting or app not installing

**Solution**:
```bash
# Reset iOS simulator
xcrun simctl erase all

# Install iOS app manually
cd apps/mobile
npx expo run:ios

# Check iOS simulator logs
xcrun simctl spawn booted log stream --predicate 'process == "Expo Go"'
```

### Android Emulator Issues
**Problem**: Android emulator not connecting or app not installing

**Solution**:
```bash
# Check Android emulator status
adb devices

# Restart ADB server
adb kill-server
adb start-server

# Install app manually
cd apps/mobile
npx expo run:android

# Clear Android app data
adb shell pm clear host.exp.exponent
```

## 🗺️ MapBox Integration Issues

### MapBox Token Issues
**Problem**: Maps not loading or showing "Unauthorized" errors

**Solution**:
```bash
# Verify MapBox token in environment
echo $NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

# Check token permissions at mapbox.com/account/access-tokens
# Ensure token has required scopes:
# - styles:read
# - fonts:read
# - datasets:read
# - vision:read (if using vision features)

# Test token validity
curl "https://api.mapbox.com/geocoding/v5/mapbox.places/test.json?access_token=YOUR_TOKEN"
```

### Map Rendering Issues
**Problem**: Maps not rendering correctly or showing blank

**Solution**:
```javascript
// Check MapBox GL JS version compatibility
// In package.json, ensure compatible versions:
{
  "mapbox-gl": "^2.15.0",
  "@rnmapbox/maps": "^10.0.0"
}

// Add error handling to map component
<Map
  onError={(error) => {
    console.error('MapBox error:', error);
  }}
  onLoad={() => {
    console.log('Map loaded successfully');
  }}
/>
```

## 🔐 Authentication Issues

### JWT Token Expiry
**Problem**: Users getting logged out unexpectedly

**Solution**:
```typescript
// Implement token refresh logic
import { supabase } from '@/lib/supabase';

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed successfully');
  }
  
  if (event === 'SIGNED_OUT') {
    // Handle logout
    window.location.href = '/login';
  }
});

// Manual token refresh
const { data, error } = await supabase.auth.refreshSession();
```

### Session Storage Issues
**Problem**: Authentication state not persisting

**Solution**:
```typescript
// Check session storage configuration
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      storageKey: 'constructtrack-auth',
      storage: window.localStorage, // or AsyncStorage for React Native
    }
  }
);
```

## 🎨 Styling & UI Issues

### Tailwind CSS Not Working
**Problem**: Tailwind classes not applying or not found

**Solution**:
```bash
# Verify Tailwind installation
npm list tailwindcss

# Check Tailwind config file
cat tailwind.config.js

# Ensure content paths are correct
module.exports = {
  content: [
    './apps/**/*.{js,ts,jsx,tsx}',
    './packages/ui/**/*.{js,ts,jsx,tsx}'
  ],
  // ...
};

# Rebuild Tailwind
npm run build:css
```

### Component Styling Issues
**Problem**: Components not rendering with expected styles

**Solution**:
```typescript
// Check class name utility function
import { cn } from '@shared/utils';

// Ensure proper class merging
const className = cn(
  'base-classes',
  {
    'conditional-class': condition,
  },
  props.className
);

// Debug class names
console.log('Applied classes:', className);
```

## 🔄 Real-time Features Issues

### WebSocket Connection Issues
**Problem**: Real-time updates not working

**Solution**:
```typescript
// Check Supabase real-time configuration
const channel = supabase
  .channel('projects')
  .on('postgres_changes', 
    { 
      event: '*', 
      schema: 'public', 
      table: 'projects' 
    }, 
    (payload) => {
      console.log('Real-time update:', payload);
    }
  )
  .subscribe((status) => {
    console.log('Subscription status:', status);
  });

// Check if real-time is enabled in Supabase dashboard
// Database > Replication > Enable real-time for tables
```

## 🚀 Performance Issues

### Slow Build Times
**Problem**: Development builds taking too long

**Solution**:
```bash
# Enable SWC compiler for Next.js
# In next.config.js:
module.exports = {
  swcMinify: true,
  experimental: {
    swcTraceProfiling: true,
  }
};

# Use faster package manager
npm install -g pnpm
pnpm install

# Enable parallel builds
npm run build -- --parallel
```

### Memory Issues
**Problem**: Out of memory errors during build

**Solution**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or add to package.json scripts:
{
  "scripts": {
    "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
  }
}
```

## 📞 Getting Additional Help

### Debug Information Collection
When reporting issues, include:

```bash
# System information
npm run debug:info

# Environment variables (sanitized)
npm run env:check

# Package versions
npm list --depth=0

# Error logs
cat logs/error.log
```

### Support Channels
- **GitHub Issues**: For bugs and feature requests
- **Documentation**: Check relevant docs sections
- **Team Chat**: Internal development discussions

### Creating Bug Reports
Include:
1. **Environment**: OS, Node version, npm version
2. **Steps to reproduce**: Exact commands and actions
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Error messages**: Full error output
6. **Screenshots**: If UI-related

## 🔗 External Resources & Links

### Official Documentation
- **Node.js**: [Installation Guide](https://nodejs.org/en/download/) | [Troubleshooting](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- **npm**: [Common Issues](https://docs.npmjs.com/common-errors) | [CLI Commands](https://docs.npmjs.com/cli/v8/commands)
- **Expo**: [Troubleshooting](https://docs.expo.dev/troubleshooting/overview/) | [Common Issues](https://docs.expo.dev/troubleshooting/common-development-errors/)
- **React Native**: [Troubleshooting](https://reactnative.dev/docs/troubleshooting) | [Environment Setup](https://reactnative.dev/docs/environment-setup)
- **Supabase**: [Troubleshooting](https://supabase.com/docs/guides/troubleshooting) | [Local Development](https://supabase.com/docs/guides/cli/local-development)
- **MapBox**: [Troubleshooting](https://docs.mapbox.com/help/troubleshooting/) | [React Integration](https://docs.mapbox.com/mapbox-gl-js/guides/)

### Community Resources
- **Stack Overflow**: [React Native](https://stackoverflow.com/questions/tagged/react-native) | [Next.js](https://stackoverflow.com/questions/tagged/next.js) | [Supabase](https://stackoverflow.com/questions/tagged/supabase)
- **GitHub Issues**: [Expo CLI](https://github.com/expo/expo-cli/issues) | [React Native](https://github.com/facebook/react-native/issues) | [Supabase](https://github.com/supabase/supabase/issues)
- **Discord Communities**: [Expo](https://chat.expo.dev/) | [Supabase](https://discord.supabase.com/) | [React Native](https://www.reactiflux.com/)

### Platform-Specific Resources
- **macOS**: [Xcode Troubleshooting](https://developer.apple.com/documentation/xcode/troubleshooting-xcode) | [Homebrew Issues](https://docs.brew.sh/Troubleshooting)
- **Windows**: [WSL Troubleshooting](https://docs.microsoft.com/en-us/windows/wsl/troubleshooting) | [Android Studio Issues](https://developer.android.com/studio/troubleshoot)
- **Linux**: [Ubuntu Development Setup](https://help.ubuntu.com/community/AndroidStudio) | [Node.js on Linux](https://nodejs.org/en/download/package-manager/)

## 📊 Latest Known Issues (Updated: January 2025)

### Current High-Priority Issues
1. **Husky Git Hooks**: Pre-commit hooks may fail on Windows with WSL2
   - **Workaround**: Use `git commit --no-verify` temporarily
   - **Fix**: Update to Husky v8+ and ensure proper file permissions
   - **GitHub Issue**: [#123](https://github.com/OliYeet/ConstructTtrack/issues/123)

2. **Expo Metro Bundler**: Occasional bundling failures with monorepo setup
   - **Workaround**: Clear Metro cache with `npx expo start --clear`
   - **Fix**: Update Metro configuration for better monorepo support
   - **Related**: [Expo Issue #15234](https://github.com/expo/expo/issues/15234)

3. **MapBox Token Validation**: Tokens may appear invalid in development
   - **Workaround**: Verify token scopes include `styles:read` and `fonts:read`
   - **Fix**: Check token restrictions and allowed URLs
   - **Documentation**: [MapBox Token Troubleshooting](https://docs.mapbox.com/help/troubleshooting/how-to-use-mapbox-securely/)

### Recently Resolved Issues
- ✅ **Environment Variable Loading**: Fixed in v1.1.0 with improved validation
- ✅ **Supabase Connection Timeouts**: Resolved with connection pooling
- ✅ **iOS Simulator Crashes**: Fixed with Expo SDK 50 update

## 🆘 Emergency Troubleshooting

### Complete Reset Procedure
If all else fails, try this complete reset:

```bash
# 1. Stop all processes
pkill -f "node"
pkill -f "expo"

# 2. Clean everything
rm -rf node_modules
rm -rf .expo
rm -rf .next
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm package-lock.json

# 3. Clear caches
npm cache clean --force
npx expo install --fix

# 4. Reinstall everything
npm install
npm run packages:build

# 5. Reset environment
cp .env.example .env
npm run env:setup

# 6. Restart development
npm run dev
```

### System Health Check
```bash
# Run comprehensive system check
npm run health:check

# Check all dependencies
npm run deps:check

# Validate entire setup
npm run validate:all
```

## 📞 Getting Help

### Before Creating an Issue
1. **Search existing issues**: Check [GitHub Issues](https://github.com/OliYeet/ConstructTtrack/issues)
2. **Check documentation**: Review relevant docs sections
3. **Try troubleshooting steps**: Follow this guide completely
4. **Collect debug info**: Use the debug commands above

### Creating a Bug Report
Include this information:
```bash
# System information
npm run debug:info

# Error logs
cat ~/.npm/_logs/*-debug.log

# Environment status
npm run env:check

# Package versions
npm list --depth=0
```

### Support Channels
- **🐛 Bugs**: [GitHub Issues](https://github.com/OliYeet/ConstructTtrack/issues/new?template=bug_report.md)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/OliYeet/ConstructTtrack/discussions)
- **❓ Questions**: [Team Chat](https://discord.gg/constructtrack) or [Stack Overflow](https://stackoverflow.com/questions/tagged/constructtrack)
- **🚨 Security Issues**: Email security@constructtrack.com

---

**Still having issues?**
- Check the [Error Codes Reference](error-codes.md) for specific error messages
- Create a [GitHub issue](https://github.com/OliYeet/ConstructTtrack/issues/new) with the debug information above
- Join our [Discord community](https://discord.gg/constructtrack) for real-time help
