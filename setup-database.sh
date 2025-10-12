#!/bin/bash

echo "🗄️  Setting up PostgreSQL for PrepX Trading Bot..."
echo ""

# Stop any existing PostgreSQL processes
echo "🔧 Stopping existing PostgreSQL processes..."
pkill -9 postgres 2>/dev/null
sleep 2

# Set PostgreSQL paths
POSTGRES_DIR="/usr/local/var/postgresql@14"
POSTGRES_BIN="/usr/local/opt/postgresql@14/bin"

# Check if data directory exists, if not create it
if [ ! -d "$POSTGRES_DIR" ]; then
  echo "📁 Creating PostgreSQL data directory..."
  mkdir -p "$POSTGRES_DIR"
  
  echo "🔨 Initializing PostgreSQL..."
  "$POSTGRES_BIN/initdb" -D "$POSTGRES_DIR"
fi

# Start PostgreSQL
echo "🚀 Starting PostgreSQL..."
"$POSTGRES_BIN/postgres" -D "$POSTGRES_DIR" > /tmp/postgres.log 2>&1 &
POSTGRES_PID=$!

# Wait for PostgreSQL to start
echo "⏳ Waiting for PostgreSQL to start..."
sleep 5

# Check if PostgreSQL is running
if ps -p $POSTGRES_PID > /dev/null; then
  echo "✅ PostgreSQL is running (PID: $POSTGRES_PID)"
else
  echo "❌ PostgreSQL failed to start. Check /tmp/postgres.log for details"
  exit 1
fi

# Create database if it doesn't exist
echo "📊 Creating database 'perpex'..."
"$POSTGRES_BIN/createdb" -U mokshya perpex 2>/dev/null || echo "   Database 'perpex' already exists"

# Create tables
echo "🏗️  Creating database tables..."
"$POSTGRES_BIN/psql" -U mokshya -d perpex << EOF
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  address VARCHAR(255) UNIQUE NOT NULL,
  private_key TEXT NOT NULL,
  chain VARCHAR(50) DEFAULT 'ethereum',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create OTP table
CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone_number);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

EOF

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📊 Database Info:"
echo "   - Database: perpex"
echo "   - User: mokshya"
echo "   - Host: 127.0.0.1"
echo "   - Port: 5432"
echo ""
echo "🔍 PostgreSQL PID: $POSTGRES_PID"
echo "📝 PostgreSQL logs: /tmp/postgres.log"
echo ""
echo "To stop PostgreSQL:"
echo "   kill $POSTGRES_PID"
echo ""

