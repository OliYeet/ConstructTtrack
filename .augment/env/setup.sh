#!/bin/bash
 set -euo pipefail

echo "🚀 Setting up ConstructTrack development environment..."

# Update system packages
sudo apt-get update -y

# Install Node.js 20 LTS (required for the project)
echo "📦 Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js and npm installation
echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Add Node.js and npm to PATH in user profile
echo 'export PATH="/usr/bin:$PATH"' >> $HOME/.profile

# Navigate to workspace directory
 cd "${WORKSPACE_DIR:-$(pwd)}"

# Create basic environment file for testing
echo "🔧 Setting up test environment variables..."
cat > .env.test << EOF
NODE_ENV=test
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=test-anon-key
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
API_VERSION=1.0.0-test
EOF

# Install dependencies for all workspaces
echo "📦 Installing dependencies..."
npm install

# Build packages (required before running tests)
echo "🔨 Building packages..."
npm run packages:build

# Set up Jest environment for better test isolation
echo "🧪 Configuring test environment..."
export NODE_ENV=test
export JEST_WORKER_ID=1

echo "✅ Setup complete! Ready to run tests."