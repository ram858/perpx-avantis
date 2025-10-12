import { Client } from 'pg'
import { OtpModel, CreateOtpData, OtpFilters } from '../database/models/Otp'

export class DatabaseService {
  private client: Client | null = null

  constructor() {
    // Don't create client in constructor
  }

  private async getClient(): Promise<Client> {
    if (!this.client) {
      this.client = new Client({
        host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
        database: process.env.POSTGRES_DB || process.env.DB_DATABASE || 'prepx',
        user: process.env.POSTGRES_USER || process.env.DB_USERNAME || 'postgres',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'password',
      })
      
      await this.client.connect()
      console.log('✅ Database connected')
    }
    return this.client
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end()
      this.client = null
    }
  }

  // OTP operations
  async createOtp(data: CreateOtpData): Promise<OtpModel> {
    const client = await this.getClient()
    
    const query = `
      INSERT INTO otps (phone_number, code, expires_at, is_verified)
      VALUES ($1, $2, $3, $4)
      RETURNING id, phone_number as "phoneNumber", code, is_verified as "isVerified", 
                expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
    `
    
    const values = [data.phoneNumber, data.code, data.expiresAt, data.isVerified || false]
    const result = await client.query(query, values)
    
    return result.rows[0]
  }

  async findOtp(filters: OtpFilters): Promise<OtpModel | null> {
    const client = await this.getClient()
    
    let query = `
      SELECT id, phone_number as "phoneNumber", code, is_verified as "isVerified",
             expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
      FROM otps
      WHERE 1=1
    `
    const values: any[] = []
    let paramCount = 0

    if (filters.phoneNumber) {
      paramCount++
      query += ` AND phone_number = $${paramCount}`
      values.push(filters.phoneNumber)
    }

    if (filters.code) {
      paramCount++
      query += ` AND code = $${paramCount}`
      values.push(filters.code)
    }

    if (filters.isVerified !== undefined) {
      paramCount++
      query += ` AND is_verified = $${paramCount}`
      values.push(filters.isVerified)
    }

    if (filters.expired !== undefined) {
      if (filters.expired) {
        query += ` AND expires_at < NOW()`
      } else {
        query += ` AND expires_at >= NOW()`
      }
    }

    query += ` ORDER BY created_at DESC LIMIT 1`

    const result = await client.query(query, values)
    return result.rows[0] || null
  }

  async updateOtp(id: string, updates: Partial<OtpModel>): Promise<OtpModel | null> {
    const client = await this.getClient()
    
    const setClause = []
    const values = []
    let paramCount = 0

    if (updates.isVerified !== undefined) {
      paramCount++
      setClause.push(`is_verified = $${paramCount}`)
      values.push(updates.isVerified)
    }

    if (setClause.length === 0) {
      return null
    }

    paramCount++
    setClause.push(`updated_at = $${paramCount}`)
    values.push(new Date())

    paramCount++
    values.push(id)

    const query = `
      UPDATE otps 
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, phone_number as "phoneNumber", code, is_verified as "isVerified",
                expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
    `

    const result = await client.query(query, values)
    return result.rows[0] || null
  }

  async deleteOtp(id: string): Promise<boolean> {
    const client = await this.getClient()
    
    const query = `DELETE FROM otps WHERE id = $1`
    const result = await client.query(query, [id])
    
    return (result.rowCount ?? 0) > 0
  }

  async deleteOtpsByPhone(phoneNumber: string): Promise<number> {
    const client = await this.getClient()
    
    const query = `DELETE FROM otps WHERE phone_number = $1`
    const result = await client.query(query, [phoneNumber])
    
    return result.rowCount || 0
  }

  // User operations
  async createUser(phoneNumber: string): Promise<any> {
    const client = await this.getClient()
    
    const query = `
      INSERT INTO users (phone_number, is_verified, last_login_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (phone_number) 
      DO UPDATE SET last_login_at = $3, updated_at = CURRENT_TIMESTAMP
      RETURNING id, phone_number as "phoneNumber", is_verified as "isVerified",
                last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
    `
    
    const values = [phoneNumber, true, new Date()]
    const result = await client.query(query, values)
    
    return result.rows[0]
  }

  async findUserByPhone(phoneNumber: string): Promise<any | null> {
    const client = await this.getClient()
    
    const query = `
      SELECT id, phone_number as "phoneNumber", is_verified as "isVerified",
             last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE phone_number = $1
    `
    
    const result = await client.query(query, [phoneNumber])
    return result.rows[0] || null
  }

  async findUserById(userId: string): Promise<any | null> {
    const client = await this.getClient()
    
    const query = `
      SELECT id, phone_number as "phoneNumber", is_verified as "isVerified",
             last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE id = $1
    `
    
    const result = await client.query(query, [userId])
    return result.rows[0] || null
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    const client = await this.getClient()
    
    const query = `
      UPDATE users 
      SET last_login_at = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `
    
    await client.query(query, [new Date(), userId])
  }

  // Wallet operations
  async createWallet(data: {
    phoneNumber: string
    chain: string
    address: string
    privateKey: string
    iv: string
  }): Promise<any> {
    const client = await this.getClient()
    
    const query = `
      INSERT INTO wallets (phone_number, chain, address, private_key, iv, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (phone_number, chain) 
      DO UPDATE SET address = $3, private_key = $4, iv = $5, updated_at = CURRENT_TIMESTAMP
      RETURNING id, phone_number as "phoneNumber", chain, address, 
                private_key as "privateKey", iv, created_at as "createdAt", updated_at as "updatedAt"
    `
    
    const values = [data.phoneNumber, data.chain, data.address, data.privateKey, data.iv]
    const result = await client.query(query, values)
    
    return result.rows[0]
  }

  async findWalletByPhoneAndChain(phoneNumber: string, chain: string): Promise<any | null> {
    const client = await this.getClient()
    
    const query = `
      SELECT id, phone_number as "phoneNumber", chain, address, 
             private_key as "privateKey", iv, created_at as "createdAt", updated_at as "updatedAt"
      FROM wallets
      WHERE phone_number = $1 AND chain = $2
    `
    
    const result = await client.query(query, [phoneNumber, chain])
    return result.rows[0] || null
  }

  async findWalletsByPhone(phoneNumber: string): Promise<any[]> {
    const client = await this.getClient()
    
    const query = `
      SELECT id, phone_number as "phoneNumber", chain, address, 
             private_key as "privateKey", iv, created_at as "createdAt", updated_at as "updatedAt"
      FROM wallets
      WHERE phone_number = $1
      ORDER BY created_at DESC
    `
    
    const result = await client.query(query, [phoneNumber])
    return result.rows
  }

  async updateWallet(id: string, updates: {
    address?: string
    privateKey?: string
    iv?: string
  }): Promise<any | null> {
    const client = await this.getClient()
    
    const setClause = []
    const values = []
    let paramCount = 0

    if (updates.address !== undefined) {
      paramCount++
      setClause.push(`address = $${paramCount}`)
      values.push(updates.address)
    }

    if (updates.privateKey !== undefined) {
      paramCount++
      setClause.push(`private_key = $${paramCount}`)
      values.push(updates.privateKey)
    }

    if (updates.iv !== undefined) {
      paramCount++
      setClause.push(`iv = $${paramCount}`)
      values.push(updates.iv)
    }

    if (setClause.length === 0) {
      return null
    }

    paramCount++
    setClause.push(`updated_at = $${paramCount}`)
    values.push(new Date())

    paramCount++
    values.push(id)

    const query = `
      UPDATE wallets 
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, phone_number as "phoneNumber", chain, address, 
                private_key as "privateKey", iv, created_at as "createdAt", updated_at as "updatedAt"
    `

    const result = await client.query(query, values)
    return result.rows[0] || null
  }

  async deleteWallet(id: string): Promise<boolean> {
    const client = await this.getClient()
    
    const query = `DELETE FROM wallets WHERE id = $1`
    const result = await client.query(query, [id])
    
    return (result.rowCount ?? 0) > 0
  }

  async deleteWalletsByPhone(phoneNumber: string): Promise<number> {
    const client = await this.getClient()
    
    const query = `DELETE FROM wallets WHERE phone_number = $1`
    const result = await client.query(query, [phoneNumber])
    
    return result.rowCount || 0
  }
}
