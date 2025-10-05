const { Client } = require('pg')

const client = new Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'prepx',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
})

async function initDatabase() {
  try {
    await client.connect()
    console.log('✅ Connected to PostgreSQL')

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ Created users table')

    // Create wallets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) NOT NULL,
        iv VARCHAR(32) NOT NULL,
        private_key TEXT NOT NULL,
        chain VARCHAR(50) NOT NULL,
        address VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(phone_number, chain)
      )
    `)
    console.log('✅ Created wallets table')

    // Create OTPs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) NOT NULL,
        code VARCHAR(6) NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(phone_number, code)
      )
    `)
    console.log('✅ Created OTPs table')

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_phone_number ON wallets(phone_number)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallets_chain ON wallets(chain)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_otps_phone_number ON otps(phone_number)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at)
    `)
    console.log('✅ Created indexes')

    console.log('🎉 Database initialization complete!')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
  } finally {
    await client.end()
  }
}

initDatabase()

