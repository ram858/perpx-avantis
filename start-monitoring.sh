#!/bin/bash
# Start PrepX Monitoring Server (No Docker Required)

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting PrepX Monitoring Server${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first:${NC}"
    echo "   brew install node"
    echo "   or visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"

if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old. Please upgrade to v16 or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"

# Navigate to monitoring directory
cd "$(dirname "$0")/monitoring"

# Install dependencies if node_modules doesn't exist
if [[ ! -d "node_modules" ]]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if monitoring server is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Monitoring server is already running on port 3000${NC}"
    echo "   Kill existing process or use a different port"
    exit 1
fi

# Start the monitoring server
echo -e "${GREEN}🚀 Starting monitoring server...${NC}"
echo ""
echo -e "${BLUE}📊 Monitoring Dashboard:${NC} http://localhost:3000"
echo -e "${BLUE}🏥 Health API:${NC}         http://localhost:3000/api/health"
echo -e "${BLUE}📈 Metrics API:${NC}        http://localhost:3000/api/metrics"
echo -e "${BLUE}📝 Logs API:${NC}           http://localhost:3000/api/logs"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Start the server
npm start
