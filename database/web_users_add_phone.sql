-- Add phone_number column to web_users table
ALTER TABLE web_users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE;

-- Create index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_web_users_phone ON web_users(phone_number);

