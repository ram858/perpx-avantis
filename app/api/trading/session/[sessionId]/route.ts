import { NextRequest, NextResponse } from 'next/server'
import { HyperliquidTradingService } from '@/lib/services/HyperliquidTradingService'
import { AuthService } from '@/lib/services/AuthService'

const tradingService = new HyperliquidTradingService()
const authService = new AuthService()

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    const { sessionId } = params

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get trading session
    const session = await tradingService.getTradingSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Trading session not found' },
        { status: 404 }
      )
    }

    // Check if user owns this session
    if (session.phoneNumber !== payload.phoneNumber) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        totalPnL: session.totalPnL,
        positions: session.positions,
        config: session.config,
        error: session.error
      }
    })

  } catch (error) {
    console.error('Error fetching trading session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trading session' },
      { status: 500 }
    )
  }
}
