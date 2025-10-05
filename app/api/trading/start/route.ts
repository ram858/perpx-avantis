import { NextRequest, NextResponse } from 'next/server'
import { HyperliquidTradingService, TradingConfig } from '@/lib/services/HyperliquidTradingService'
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
    const { totalBudget, profitGoal, maxPositions, leverage } = body

    // Validate required fields
    if (!totalBudget || !profitGoal || !maxPositions) {
      return NextResponse.json(
        { error: 'Missing required fields: totalBudget, profitGoal, maxPositions' },
        { status: 400 }
      )
    }

    // Validate values
    if (totalBudget <= 0 || profitGoal <= 0 || maxPositions <= 0) {
      return NextResponse.json(
        { error: 'All values must be positive' },
        { status: 400 }
      )
    }

    // Create trading config
    const config: TradingConfig = {
      totalBudget: parseFloat(totalBudget),
      profitGoal: parseFloat(profitGoal),
      maxPositions: parseInt(maxPositions),
      leverage: leverage ? parseFloat(leverage) : undefined
    }

    // Start trading session
    const result = await tradingService.startTradingSession(payload.phoneNumber, config)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Trading session started successfully',
        sessionId: result.sessionId
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error starting trading session:', error)
    return NextResponse.json(
      { error: 'Failed to start trading session' },
      { status: 500 }
    )
  }
}
