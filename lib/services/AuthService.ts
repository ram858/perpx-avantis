import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: string
  fid?: number // Farcaster ID for Base Account users
  phoneNumber?: string // Optional for legacy phone auth
  iat?: number
  exp?: number
}

export class AuthService {
  private readonly jwtExpirationTime: string
  private db: any = null // DatabaseService - optional, loaded dynamically

  private getDb(): any {
    // Database is optional for Base mini-apps - always return null
    // Wallet storage is handled by WalletStorageService
    return null
  }

  constructor() {
    // JWT_SECRET validation moved to runtime (getSecret method)
    // This prevents Next.js from crashing during build
    this.jwtExpirationTime = process.env.JWT_EXPIRATION_TIME || '7d'
  }

  /**
   * Get JWT secret - validates at runtime, not build time
   * This prevents Next.js build failures when JWT_SECRET is not available during build
   */
  private getSecret(): string {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET missing at runtime.");
    }
    
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required. Please set it in your .env file.');
    }
    
    return secret;
  }

  async generateJwtToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    try {
      const secret = this.getSecret();
      // @ts-ignore - JWT type issue with expiresIn
      const token = jwt.sign(payload, secret, {
        expiresIn: this.jwtExpirationTime,
        issuer: 'prepx',
        audience: 'prepx-users'
      })
      
      return token
    } catch (error) {
      console.error('Error generating JWT token:', error)
      throw new Error('Failed to generate authentication token')
    }
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const secret = this.getSecret();
      const decoded = jwt.verify(token, secret, {
        issuer: 'prepx',
        audience: 'prepx-users'
      }) as JwtPayload
      
      return decoded
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token')
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired')
      }
      throw new Error('Token verification failed')
    }
  }

  async getUserById(userId: string): Promise<any | null> {
    try {
      const db = this.getDb()
      if (!db) {
        return null // Database not available
      }
      const user = await db.findUserById(userId)
      console.log(`🔍 Retrieved user by ID: ${userId}`, user ? 'Found' : 'Not found')
      return user
    } catch (error) {
      console.error('Error fetching user by ID:', error)
      return null
    }
  }

  async getUserByFid(fid: number): Promise<any | null> {
    try {
      const db = this.getDb()
      if (!db) {
        return null // Database not available, that's fine
      }
      const user = await db.findUserByFid(fid)
      console.log(`🔍 Retrieved user by FID: ${fid}`)
      return user
    } catch (error) {
      console.error('Error fetching user by FID:', error)
      return null
    }
  }

  async getUserByPhone(phoneNumber: string): Promise<any | null> {
    try {
      const db = this.getDb()
      if (!db) {
        return null // Database not available
      }
      const user = await db.findUserByPhone(phoneNumber)
      console.log(`🔍 Retrieved user by phone: ${phoneNumber}`)
      return user
    } catch (error) {
      console.error('Error fetching user by phone:', error)
      return null
    }
  }

  async createUserByFid(fid: number): Promise<any> {
    try {
      // For Base mini-apps, we don't need database storage
      // Just return a user object with FID as identifier
      // This avoids database dependency while maintaining compatibility
      
      // Check if database is available (optional)
      try {
        const existingUser = await this.getUserByFid(fid)
        if (existingUser) {
          console.log(`👤 User already exists: FID ${fid}`)
          return existingUser
        }
      } catch (dbError) {
        // Database not available - that's fine, we'll use in-memory user
        console.log('📝 Database not available, using FID-based user')
      }

      // Create user object without database (for Base mini-apps)
      // Use FID as both id and identifier
      const user = {
        id: `fid_${fid}`,
        fid: fid,
        phoneNumber: null,
        isVerified: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }

      // Try to save to database if available (optional)
      try {
        const db = this.getDb()
        if (db) {
          await db.createUserByFid(fid)
        }
      } catch (dbError) {
        // Database not available - that's fine
        console.log('📝 Skipping database save (database not available)')
      }

      console.log(`✅ Created user for FID: ${fid}`)
      
      return user
    } catch (error) {
      console.error('Error creating user by FID:', error)
      // Even if database fails, return a user object
      return {
        id: `fid_${fid}`,
        fid: fid,
        phoneNumber: null,
        isVerified: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }
    }
  }

  async createUser(phoneNumber: string): Promise<any> {
    try {
      // Check if user already exists
      const existingUser = await this.getUserByPhone(phoneNumber)
      if (existingUser) {
        console.log(`👤 User already exists: ${phoneNumber}`)
        return existingUser
      }

      // Create new user
      const user = await this.db.createUser(phoneNumber)
      console.log(`✅ Created new user: ${phoneNumber} (ID: ${user.id})`)
      
      return user
    } catch (error) {
      console.error('Error creating user:', error)
      throw new Error('Failed to create user')
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      const db = this.getDb()
      if (db) {
        await db.updateUserLastLogin(userId)
        console.log(`🕒 Updated last login for user: ${userId}`)
      }
    } catch (error) {
      console.error('Error updating last login:', error)
    }
  }
}
