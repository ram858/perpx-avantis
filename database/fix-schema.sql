-- Fix: Allow encrypted_private_key to be NULL for Base Account wallets
-- Base Account wallets are smart wallets and don't have private keys

ALTER TABLE wallets 
  ALTER COLUMN encrypted_private_key DROP NOT NULL;

ALTER TABLE wallets 
  ALTER COLUMN iv DROP NOT NULL;

-- Add a check to ensure trading wallets have private keys
ALTER TABLE wallets 
  DROP CONSTRAINT IF EXISTS check_trading_has_key;

ALTER TABLE wallets
  ADD CONSTRAINT check_trading_has_key 
  CHECK (
    (wallet_type = 'base-account') OR 
    (wallet_type = 'trading' AND encrypted_private_key IS NOT NULL AND iv IS NOT NULL)
  );

-- Verify the changes
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'wallets' 
AND column_name IN ('encrypted_private_key', 'iv');

