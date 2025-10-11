import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/AuthService'
import { UserWalletService } from '@/lib/services/UserWalletService'
import { HyperliquidTradingService } from '@/lib/services/HyperliquidTradingService'

const authService = new AuthService()
const userWalletService = new UserWalletService()
const hyperliquidService = new HyperliquidTradingService()

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)
    
    console.log(`[CloseAllPositions] Closing all positions for user ${payload.phoneNumber}`)

    // Get user's primary wallet
    const wallet = await userWalletService.getPrimaryTradingWalletWithKey(payload.phoneNumber)
    
    if (!wallet || !wallet.privateKey) {
      return NextResponse.json({ 
        success: false,
        error: 'Wallet not found or private key not available' 
      }, { status: 404 })
    }

    // Call the Hyperliquid service to close all positions
    console.log(`[CloseAllPositions] Calling Hyperliquid service to close all positions for wallet ${wallet.address}`)
    
    const result = await hyperliquidService.closeAllPositions(payload.phoneNumber)
    
    if (result.success) {
      console.log(`[CloseAllPositions] Successfully closed all positions for user ${payload.phoneNumber}`)
      return NextResponse.json({
        success: true,
        message: result.message || 'All positions closed successfully',
        walletAddress: wallet.address
      })
    } else {
      console.error(`[CloseAllPositions] Failed to close positions: ${result.message}`)
      return NextResponse.json({
        success: false,
        error: result.message || 'Failed to close all positions'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('[CloseAllPositions] Error closing positions:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close positions'
      },
      { status: 500 }
    )
  }
}
