import { AuthenticatedRequest } from '../guards/JwtAuthGuard'

export interface UserPayload {
  userId: string
  phoneNumber: string
}

// Decorator function to extract user from request
export function User(request: AuthenticatedRequest): UserPayload | null {
  return request.user || null
}

// Helper function for API routes
export function extractUser(request: AuthenticatedRequest): UserPayload {
  if (!request.user) {
    throw new Error('User not authenticated')
  }
  return request.user
}
