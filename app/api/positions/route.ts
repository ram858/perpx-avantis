import { NextRequest, NextResponse } from 'next/server'
import { UserWalletService } from '@/lib/services/UserWalletService'
import { AuthService } from '@/lib/services/AuthService'
import { getHyperliquidBalance } from '@/lib/wallet/hyperliquidBalance'

const userWalletService = new UserWalletService()
const authService = new AuthService()

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)
    
    // Get user's primary wallet
    const wallet = await userWalletService.getPrimaryTradingWalletWithKey(payload.phoneNumber)
    
    if (!wallet) {
      return NextResponse.json({ 
        positions: [],
        totalPnL: 0,
        openPositions: 0
      })
    }

    // Fetch positions from Hyperliquid
    const balance = await getHyperliquidBalance(wallet.address)
    
    // Convert Hyperliquid positions to our format
    const positions = balance.positions.map(pos => ({
      coin: pos.symbol,
      size: pos.size.toString(),
      side: pos.size > 0 ? 'long' : 'short',
      entryPrice: pos.entryPrice,
      markPrice: pos.markPrice,
      pnl: pos.pnl,
      roe: pos.pnl / Math.abs(pos.size * pos.entryPrice) * 100, // Calculate ROE
      positionValue: Math.abs(pos.size * pos.markPrice),
      margin: '0', // Not available from Hyperliquid API
      leverage: '1' // Not available from Hyperliquid API
    }))

    return NextResponse.json({
      positions,
      totalPnL: balance.totalValue,
      openPositions: positions.length
    })

  } catch (error) {
    console.error('Error fetching positions:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch positions',
        positions: [],
        totalPnL: 0,
        openPositions: 0
      },
      { status: 500 }
    )
  }
}
