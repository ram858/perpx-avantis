import jwt from 'jsonwebtoken'
import { DatabaseService } from './DatabaseService'

export interface JwtPayload {
  userId: string
  phoneNumber: string
  iat?: number
  exp?: number
}

export class AuthService {
  private readonly jwtSecret: string
  private readonly jwtExpirationTime: string
  private db = new DatabaseService()

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
    this.jwtExpirationTime = process.env.JWT_EXPIRATION_TIME || '7d'
  }

  async generateJwtToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    try {
      const token = jwt.sign(payload, this.jwtSecret, {
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
      const decoded = jwt.verify(token, this.jwtSecret, {
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
      const user = await this.db.findUserById(userId)
      console.log(`🔍 Retrieved user by ID: ${userId}`, user ? 'Found' : 'Not found')
      return user
    } catch (error) {
      console.error('Error fetching user by ID:', error)
      return null
    }
  }

  async getUserByPhone(phoneNumber: string): Promise<any | null> {
    try {
      const user = await this.db.findUserByPhone(phoneNumber)
      console.log(`🔍 Retrieved user by phone: ${phoneNumber}`)
      return user
    } catch (error) {
      console.error('Error fetching user by phone:', error)
      return null
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
      await this.db.updateUserLastLogin(userId)
      console.log(`🕒 Updated last login for user: ${userId}`)
    } catch (error) {
      console.error('Error updating last login:', error)
    }
  }
}
