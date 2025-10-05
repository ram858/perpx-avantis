import { NextRequest, NextResponse } from 'next/server'
import { HyperliquidTradingService } from '@/lib/services/HyperliquidTradingService'
import { AuthService } from '@/lib/services/AuthService'

const tradingService = new HyperliquidTradingService()
const authService = new AuthService()

export async function GET(request: NextRequest) {
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

    // Get user's trading sessions
    const sessions = await tradingService.getUserTradingSessions(payload.phoneNumber)

    return NextResponse.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        totalPnL: session.totalPnL,
        positions: session.positions.length,
        config: {
          totalBudget: session.config.totalBudget,
          profitGoal: session.config.profitGoal,
          maxPositions: session.config.maxPositions
        },
        error: session.error
      }))
    })

  } catch (error) {
    console.error('Error fetching trading sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trading sessions' },
      { status: 500 }
    )
  }
}
