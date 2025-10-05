import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/AuthService'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify JWT token using AuthService
    const authService = new AuthService()
    const decoded = await authService.verifyToken(token)

    // Return user information
    return NextResponse.json({
      success: true,
      user: {
        id: decoded.userId,
        phoneNumber: decoded.phoneNumber,
        iat: decoded.iat
      }
    })

  } catch (error) {
    console.error('Token verification failed:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Invalid token') {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        )
      }
      
      if (error.message === 'Token expired') {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Token verification failed' },
      { status: 500 }
    )
  }
}
