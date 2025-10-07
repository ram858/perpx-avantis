import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '../services/AuthService'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string
    phoneNumber: string
  }
}

export class JwtAuthGuard {
  private authService: AuthService

  constructor() {
    this.authService = new AuthService()
  }

  async authenticate(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const authHeader = request.headers.get('authorization')
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          success: false,
          error: 'No token provided'
        }
      }

      const token = authHeader.substring(7) // Remove 'Bearer ' prefix
      const payload = await this.authService.verifyToken(token)
      
      console.log(`🔍 JWT Auth Guard: Looking up user with ID: ${payload.userId}`)
      
      // Verify user still exists
      const user = await this.authService.getUserById(payload.userId)
      if (!user) {
        console.log(`❌ JWT Auth Guard: User not found for ID: ${payload.userId}`)
        return {
          success: false,
          error: 'User not found'
        }
      }
      
      console.log(`✅ JWT Auth Guard: User found: ${user.phoneNumber} (ID: ${user.id})`)

      return {
        success: true,
        user: {
          userId: payload.userId,
          phoneNumber: payload.phoneNumber
        }
      }
    } catch (error) {
      console.error('Authentication error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }
    }
  }

  // Middleware function for API routes
  async middleware(request: NextRequest): Promise<NextResponse | null> {
    const authResult = await this.authenticate(request)
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Add user to request object for use in route handlers
    ;(request as AuthenticatedRequest).user = authResult.user
    return null // Continue to route handler
  }
}

// Helper function to extract user from request
export function getUserFromRequest(request: AuthenticatedRequest) {
  return request.user
}
