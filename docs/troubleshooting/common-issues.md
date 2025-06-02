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

---

**Still having issues?** Check the [Error Codes Reference](error-codes.md) or create a GitHub issue with the debug information above.
