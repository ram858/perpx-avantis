import { NextRequest, NextResponse } from 'next/server'
import { UserWalletService } from '@/lib/services/UserWalletService'
import { AuthService } from '@/lib/services/AuthService'

const userWalletService = new UserWalletService()
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

    // Get user's primary wallet
    const wallet = await userWalletService.getPrimaryTradingWalletWithKey(payload.phoneNumber)
    
    if (!wallet || !wallet.privateKey) {
      return NextResponse.json({ error: 'Wallet not found or private key not available' }, { status: 404 })
    }

    // TODO: Implement actual position closing using Hyperliquid API
    // For now, return success (simulation)
    console.log(`Closing position for ${symbol} using wallet ${wallet.address}`)
    
    return NextResponse.json({
      success: true,
      message: `Position ${symbol} closed successfully`
    })

  } catch (error) {
    console.error('Error closing position:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to close position'
      },
      { status: 500 }
    )
  }
}
