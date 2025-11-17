# Fix Avantis Service Docker Environment Variables

## Problem
The Avantis Docker container is using `base-testnet` but needs `base-mainnet`.

## Solution: Update Docker Environment Variables

### Option 1: Update docker-compose.yml and Restart (Recommended)

1. **SSH into your server:**
```bash
ssh your-server
```

2. **Navigate to the avantis-service directory:**
```bash
cd /path/to/avantis-service
# OR wherever your docker-compose.yml is located
```

3. **Edit docker-compose.yml:**
```bash
nano docker-compose.yml
# OR
vi docker-compose.yml
```

4. **Update the environment section:**
```yaml
environment:
  - HOST=0.0.0.0
  - PORT=8000
  - DEBUG=false
  - AVANTIS_NETWORK=base-mainnet  # ← Change from base-testnet
  - AVANTIS_RPC_URL=https://mainnet.base.org  # ← Change from sepolia
  - MAX_RETRIES=3
  - RETRY_DELAY=1.0
  - CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://avantis.superapp.gg
```

5. **Restart the container:**
```bash
docker-compose down
docker-compose up -d
```

### Option 2: Update Running Container Environment (Quick Fix)

If you can't modify docker-compose.yml immediately:

1. **SSH into your server:**
```bash
ssh your-server
```

2. **Find the container:**
```bash
docker ps | grep avantis
# Note the container name/ID
```

3. **Stop the container:**
```bash
docker stop avantis-trading-service
# OR use the container ID from step 2
```

4. **Remove the old container:**
```bash
docker rm avantis-trading-service
```

5. **Start with new environment variables:**
```bash
docker run -d \
  --name avantis-trading-service \
  -p 8000:8000 \
  -e HOST=0.0.0.0 \
  -e PORT=8000 \
  -e DEBUG=false \
  -e AVANTIS_NETWORK=base-mainnet \
  -e AVANTIS_RPC_URL=https://mainnet.base.org \
  -e MAX_RETRIES=3 \
  -e RETRY_DELAY=1.0 \
  -e CORS_ORIGINS="http://localhost:3000,http://localhost:3001,https://avantis.superapp.gg" \
  --restart unless-stopped \
  your-avantis-image:tag
```

### Option 3: Update via Docker Exec (Temporary - Not Recommended)

This won't persist after container restart, but can work for immediate testing:

```bash
# Set environment in running container
docker exec -it avantis-trading-service bash -c "export AVANTIS_NETWORK=base-mainnet"
docker exec -it avantis-trading-service bash -c "export AVANTIS_RPC_URL=https://mainnet.base.org"

# Restart the service inside container (if it's a Python service)
docker exec -it avantis-trading-service pkill -f python
# The container should auto-restart, or restart the container:
docker restart avantis-trading-service
```

**Note:** This method won't persist after container restart. Use Option 1 or 2 for permanent fix.

## Verification

After updating, verify:

```bash
curl https://avantis.superapp.gg/api/avantis/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "avantis-trading-service",
  "network": "base-mainnet"  // ✅ Should be base-mainnet now
}
```

## Check Current Container Environment

To see current environment variables:

```bash
docker exec avantis-trading-service env | grep AVANTIS
```

## If Using Docker Compose with .env file

If your docker-compose.yml uses `${AVANTIS_NETWORK}`, create/update `.env` file:

```bash
cd /path/to/avantis-service
cat > .env << EOF
AVANTIS_NETWORK=base-mainnet
AVANTIS_RPC_URL=https://mainnet.base.org
DEBUG=false
MAX_RETRIES=3
RETRY_DELAY=1.0
EOF

docker-compose down
docker-compose up -d
```

## Troubleshooting

If the container won't start:
```bash
# Check logs
docker logs avantis-trading-service

# Check if port is in use
docker ps | grep 8000

# Check container status
docker ps -a | grep avantis
```

