#!/bin/bash
# Quick Fix Script for Avantis Docker Service
# Run this on your server where the Avantis service is deployed

echo "=========================================="
echo "Avantis Docker Service Network Fix"
echo "=========================================="
echo ""

# Check if container exists
CONTAINER_NAME="avantis-trading-service"
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "✅ Found container: $CONTAINER_NAME"
    
    # Show current environment
    echo ""
    echo "Current environment:"
    docker exec $CONTAINER_NAME env | grep AVANTIS || echo "No AVANTIS env vars found"
    
    echo ""
    echo "To fix:"
    echo "1. Stop container: docker stop $CONTAINER_NAME"
    echo "2. Remove container: docker rm $CONTAINER_NAME"
    echo "3. Update docker-compose.yml with:"
    echo "   - AVANTIS_NETWORK=base-mainnet"
    echo "   - AVANTIS_RPC_URL=https://mainnet.base.org"
    echo "4. Restart: docker-compose up -d"
    echo ""
    echo "OR run the commands below:"
    echo ""
    echo "# Stop and remove"
    echo "docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME"
    echo ""
    echo "# Then update docker-compose.yml and run:"
    echo "docker-compose up -d"
else
    echo "❌ Container $CONTAINER_NAME not found"
    echo "List all containers:"
    docker ps -a
fi

echo ""
echo "After fixing, verify with:"
echo "curl https://avantis.superapp.gg/api/avantis/health"
