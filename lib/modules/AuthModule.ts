import { AuthService } from '../services/AuthService'
import { JwtAuthGuard } from '../guards/JwtAuthGuard'

export class AuthModule {
  public readonly authService: AuthService
  public readonly jwtAuthGuard: JwtAuthGuard

  constructor() {
    this.authService = new AuthService()
    this.jwtAuthGuard = new JwtAuthGuard()
  }

  // JWT Token generation
  async generateJwtToken(payload: { userId: string; phoneNumber: string }): Promise<string> {
    return this.authService.generateJwtToken(payload)
  }

  // JWT Token verification
  async verifyToken(token: string) {
    return this.authService.verifyToken(token)
  }

  // User management
  async getUserById(userId: string) {
    return this.authService.getUserById(userId)
  }

  async getUserByPhone(phoneNumber: string) {
    return this.authService.getUserByPhone(phoneNumber)
  }

  async createUser(phoneNumber: string) {
    return this.authService.createUser(phoneNumber)
  }

  // Authentication guard
  async authenticate(request: Request) {
    return this.jwtAuthGuard.authenticate(request as any)
  }
}

// Export singleton instance
export const authModule = new AuthModule()
