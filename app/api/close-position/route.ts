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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)
    
    // Parse request body
    const { symbol } = await request.json()
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    console.log(`[ClosePosition] Closing position for ${symbol} for user ${payload.phoneNumber}`)

    // Use the trading service to close the position
    const result = await tradingService.closePosition(symbol)
    
    if (result.success) {
      console.log(`[ClosePosition] Successfully closed position for ${symbol}`)
      return NextResponse.json({
        success: true,
        message: result.message
      })
    } else {
      console.error(`[ClosePosition] Failed to close position for ${symbol}: ${result.message}`)
      return NextResponse.json({
        success: false,
        error: result.message
      }, { status: 400 })
    }

  } catch (error) {
    console.error('[ClosePosition] Error closing position:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close position'
      },
      { status: 500 }
    )
  }
}
