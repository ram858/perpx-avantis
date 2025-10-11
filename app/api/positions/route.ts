import { NextRequest, NextResponse } from 'next/server'
import { UserWalletService } from '@/lib/services/UserWalletService'
import { AuthService } from '@/lib/services/AuthService'
import { getHyperliquidBalance } from '@/lib/wallet/hyperliquidBalance'

const userWalletService = new UserWalletService()
const authService = new AuthService()

export async function GET(request: NextRequest) {
  try {
    console.log('[API] Positions endpoint called')
    
    // TEMPORARY: Skip authentication for testing
    // TODO: Re-enable authentication once basic functionality is working
    
    // Mock user data for testing
    const user = { phoneNumber: '9808110921' }
    const wallet = {
      address: '0xaa0bA0700Cfd1489d08C63C4bd177638Be4C86F6',
      privateKey: '0xc2614e090f4a9e229c197256ef9c5b0647fadfc44cb1da5b2d5e6969b68ba61b'
    }
    
    console.log('[API] Getting positions for user:', user.phoneNumber)
    console.log('[API] Using wallet address:', wallet.address)

    // Try to get positions from trading engine first
    const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001'
    
    try {
      console.log(`[API] Attempting to fetch positions from trading engine: ${tradingEngineUrl}/api/positions`)
      const tradingResponse = await fetch(`${tradingEngineUrl}/api/positions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      console.log(`[API] Trading engine response status: ${tradingResponse.status}`)
      
      if (tradingResponse.ok) {
        const tradingData = await tradingResponse.json()
        console.log(`[API] Trading engine returned data:`, tradingData)
        return NextResponse.json({
          positions: tradingData.positions || [],
          totalPnL: tradingData.totalPnL || 0,
          openPositions: tradingData.openPositions || 0
        })
      } else {
        console.log(`[API] Trading engine returned error status: ${tradingResponse.status}`)
      }
    } catch (tradingError) {
      console.error('[API] Trading engine positions not available:', tradingError)
    }

    // Fallback: Fetch positions directly from Hyperliquid
    try {
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
    } catch (hyperliquidError) {
      console.error('[API] Hyperliquid fallback failed:', hyperliquidError)
      // Return empty positions if Hyperliquid is not available
      return NextResponse.json({
        positions: [],
        totalPnL: 0,
        openPositions: 0,
        error: 'Trading engine and Hyperliquid not available'
      })
    }

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
