import { NextRequest, NextResponse } from 'next/server'
import { HyperliquidTradingService } from '@/lib/services/HyperliquidTradingService'
import { AuthService } from '@/lib/services/AuthService'

const tradingService = new HyperliquidTradingService()
const authService = new AuthService()

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)

    // Parse request body
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Stop trading session
    const result = await tradingService.stopTradingSession(sessionId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Trading session stopped successfully'
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error stopping trading session:', error)
    return NextResponse.json(
      { error: 'Failed to stop trading session' },
      { status: 500 }
    )
  }
}
