-- ============================================================================
-- PerpX Wallet Storage Schema for Supabase/PostgreSQL
-- ============================================================================
-- This schema creates the necessary tables to store user wallets securely
-- with encrypted private keys.
-- ============================================================================

-- Create users table (optional but recommended)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- Create index on fid for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);

-- ============================================================================
-- Wallets Table (Main Storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  fid INTEGER NOT NULL,
  address VARCHAR(42) NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_fid_chain UNIQUE(fid, chain),
  CONSTRAINT valid_ethereum_address CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_wallet_type CHECK (wallet_type IN ('trading', 'base-account'))
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_wallets_fid ON wallets(fid);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_type ON wallets(wallet_type);
CREATE INDEX IF NOT EXISTS idx_wallets_chain ON wallets(chain);

-- ============================================================================
-- Wallet Metadata Table (Optional - for analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_metadata (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
  balance_usd DECIMAL(20, 8) DEFAULT 0,
  last_balance_check TIMESTAMP,
  total_deposits DECIMAL(20, 8) DEFAULT 0,
  total_withdrawals DECIMAL(20, 8) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_metadata_wallet_id ON wallet_metadata(wallet_id);

-- ============================================================================
-- Audit Log Table (Recommended for security)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_audit_log (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES wallets(id),
  action VARCHAR(50) NOT NULL,
  accessed_by VARCHAR(100),
  ip_address INET,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_wallet_id ON wallet_audit_log(wallet_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON wallet_audit_log(timestamp);

-- ============================================================================
-- Auto-update timestamp trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to wallets table
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to wallet_metadata table
CREATE TRIGGER update_wallet_metadata_updated_at
  BEFORE UPDATE ON wallet_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for backend API)
CREATE POLICY "Service role has full access"
  ON wallets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can do everything on users
CREATE POLICY "Service role has full access to users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can do everything on metadata
CREATE POLICY "Service role has full access to metadata"
  ON wallet_metadata
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can do everything on audit log
CREATE POLICY "Service role has full access to audit log"
  ON wallet_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get wallet by FID and chain
CREATE OR REPLACE FUNCTION get_wallet_by_fid_and_chain(
  p_fid INTEGER,
  p_chain VARCHAR(50)
)
RETURNS TABLE (
  id INTEGER,
  fid INTEGER,
  address VARCHAR(42),
  encrypted_private_key TEXT,
  iv VARCHAR(32),
  chain VARCHAR(50),
  wallet_type VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.fid,
    w.address,
    w.encrypted_private_key,
    w.iv,
    w.chain,
    w.wallet_type,
    w.created_at,
    w.updated_at
  FROM wallets w
  WHERE w.fid = p_fid AND w.chain = p_chain;
END;
$$ LANGUAGE plpgsql;

-- Function to log wallet access
CREATE OR REPLACE FUNCTION log_wallet_access(
  p_wallet_id INTEGER,
  p_action VARCHAR(50),
  p_accessed_by VARCHAR(100) DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO wallet_audit_log (wallet_id, action, accessed_by, ip_address)
  VALUES (p_wallet_id, p_action, p_accessed_by, p_ip_address);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Sample Queries (for testing)
-- ============================================================================

-- Count total wallets
-- SELECT COUNT(*) as total_wallets FROM wallets;

-- Count wallets by type
-- SELECT wallet_type, COUNT(*) as count FROM wallets GROUP BY wallet_type;

-- Get all wallets for a user
-- SELECT * FROM wallets WHERE fid = 1464243;

-- Get wallet by address
-- SELECT * FROM wallets WHERE address = '0x...';

-- Get recent wallet creations
-- SELECT * FROM wallets ORDER BY created_at DESC LIMIT 10;

-- ============================================================================
-- End of Schema
-- ============================================================================

