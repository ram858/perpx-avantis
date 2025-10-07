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

    // Verify user still exists in database
    const user = await authService.getUserById(decoded.userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    // Return user information
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        hasWallet: true, // Assume user has wallet if they're authenticated
        createdAt: user.createdAt
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
