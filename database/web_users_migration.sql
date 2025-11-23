-- ============================================================================
-- Web Users and Wallets Migration
-- ============================================================================
-- This migration creates separate tables for web users (non-Farcaster)
-- to enable testing and deployment in web environments
-- ============================================================================

-- ============================================================================
-- Web Users Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS web_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  username VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_web_users_email ON web_users(email);
CREATE INDEX IF NOT EXISTS idx_web_users_username ON web_users(username);

-- ============================================================================
-- Web Wallets Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS web_wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  address VARCHAR(42) NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  chain VARCHAR(50) NOT NULL DEFAULT 'ethereum',
  wallet_type VARCHAR(20) NOT NULL DEFAULT 'trading',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_chain UNIQUE(user_id, chain),
  CONSTRAINT valid_ethereum_address CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_wallet_type CHECK (wallet_type IN ('trading', 'base-account'))
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_web_wallets_user_id ON web_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_web_wallets_address ON web_wallets(address);
CREATE INDEX IF NOT EXISTS idx_web_wallets_type ON web_wallets(wallet_type);
CREATE INDEX IF NOT EXISTS idx_web_wallets_chain ON web_wallets(chain);

-- ============================================================================
-- Web Wallet Metadata Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS web_wallet_metadata (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES web_wallets(id) ON DELETE CASCADE,
  balance_usd DECIMAL(20, 8) DEFAULT 0,
  last_balance_check TIMESTAMP,
  total_deposits DECIMAL(20, 8) DEFAULT 0,
  total_withdrawals DECIMAL(20, 8) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_wallet_metadata_wallet_id ON web_wallet_metadata(wallet_id);

-- ============================================================================
-- Web Wallet Audit Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS web_wallet_audit_log (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES web_wallets(id),
  action VARCHAR(50) NOT NULL,
  accessed_by VARCHAR(100),
  ip_address INET,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_audit_log_wallet_id ON web_wallet_audit_log(wallet_id);
CREATE INDEX IF NOT EXISTS idx_web_audit_log_timestamp ON web_wallet_audit_log(timestamp);

-- ============================================================================
-- Auto-update timestamp triggers
-- ============================================================================
CREATE TRIGGER update_web_users_updated_at
  BEFORE UPDATE ON web_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_wallets_updated_at
  BEFORE UPDATE ON web_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_wallet_metadata_updated_at
  BEFORE UPDATE ON web_wallet_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
ALTER TABLE web_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_wallet_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_wallet_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for backend API)
CREATE POLICY "Service role has full access to web_users"
  ON web_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to web_wallets"
  ON web_wallets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to web_wallet_metadata"
  ON web_wallet_metadata
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to web_wallet_audit_log"
  ON web_wallet_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get web wallet by user_id and chain
CREATE OR REPLACE FUNCTION get_web_wallet_by_user_and_chain(
  p_user_id INTEGER,
  p_chain VARCHAR(50)
)
RETURNS TABLE (
  id INTEGER,
  user_id INTEGER,
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
    w.user_id,
    w.address,
    w.encrypted_private_key,
    w.iv,
    w.chain,
    w.wallet_type,
    w.created_at,
    w.updated_at
  FROM web_wallets w
  WHERE w.user_id = p_user_id AND w.chain = p_chain;
END;
$$ LANGUAGE plpgsql;

-- Function to log web wallet access
CREATE OR REPLACE FUNCTION log_web_wallet_access(
  p_wallet_id INTEGER,
  p_action VARCHAR(50),
  p_accessed_by VARCHAR(100) DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO web_wallet_audit_log (wallet_id, action, accessed_by, ip_address)
  VALUES (p_wallet_id, p_action, p_accessed_by, p_ip_address);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- End of Migration
-- ============================================================================

