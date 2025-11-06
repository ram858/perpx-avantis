#!/bin/bash

# Perpx-Avantis Deployment Script
# Run this script on your server after initial setup

set -e  # Exit on error

echo "🚀 Starting Perpx-Avantis Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run as root. Use a regular user with sudo privileges.${NC}"
   exit 1
fi

# Get current directory
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$APP_DIR"

echo -e "${GREEN}✓${NC} Working directory: $APP_DIR"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} Node.js not found. Please install Node.js 18+ first."
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Node.js version: $NODE_VERSION"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗${NC} Python3 not found. Please install Python 3.11+ first."
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓${NC} Python version: $PYTHON_VERSION"

# Check PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} PM2 not found. Installing PM2..."
    sudo npm install -g pm2
fi
echo -e "${GREEN}✓${NC} PM2 installed"

# Create logs directory
mkdir -p logs/pm2
echo -e "${GREEN}✓${NC} Logs directory created"

# Install Next.js dependencies
echo -e "${YELLOW}📦${NC} Installing Next.js dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
else
    npm install
fi
echo -e "${GREEN}✓${NC} Next.js dependencies installed"

# Build Next.js app
echo -e "${YELLOW}🔨${NC} Building Next.js app..."
npm run build
echo -e "${GREEN}✓${NC} Next.js app built"

# Install Trading Engine dependencies
echo -e "${YELLOW}📦${NC} Installing Trading Engine dependencies..."
cd trading-engine
if [ ! -d "node_modules" ]; then
    npm install
else
    npm install
fi
cd ..
echo -e "${GREEN}✓${NC} Trading Engine dependencies installed"

# Setup Avantis Service
echo -e "${YELLOW}📦${NC} Setting up Avantis Service..."
cd avantis-service
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate
cd ..
echo -e "${GREEN}✓${NC} Avantis Service setup complete"

# Check environment files
echo -e "${YELLOW}🔍${NC} Checking environment files..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠${NC} .env file not found. Please create it before starting services."
fi
if [ ! -f "trading-engine/.env" ]; then
    echo -e "${YELLOW}⚠${NC} trading-engine/.env file not found. Please create it before starting services."
fi
if [ ! -f "avantis-service/.env" ]; then
    echo -e "${YELLOW}⚠${NC} avantis-service/.env file not found. Please create it before starting services."
fi

# Start/restart PM2 services
echo -e "${YELLOW}🚀${NC} Starting PM2 services..."
pm2 delete all 2>/dev/null || true  # Delete existing if any
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✓${NC} PM2 services started"

# Show status
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Service Status:"
pm2 list
echo ""
echo "Useful commands:"
echo "  pm2 logs              - View all logs"
echo "  pm2 logs perpx-nextjs - View Next.js logs"
echo "  pm2 restart all       - Restart all services"
echo "  pm2 monit             - Monitor services"
echo ""
echo -e "${YELLOW}⚠${NC} Don't forget to:"
echo "  1. Configure Nginx reverse proxy"
echo "  2. Setup SSL certificate with certbot"
echo "  3. Configure Avantis Service (systemd or supervisor)"
echo "  4. Update Base Mini App URL in Base dashboard"
echo ""

