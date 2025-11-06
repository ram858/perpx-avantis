import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/AuthService'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { AvantisTradingService } from '@/lib/services/AvantisTradingService'

const authService = new AuthService()
const walletService = new BaseAccountWalletService()
const tradingService = new AvantisTradingService()

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Close all positions endpoint called')

    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)

    // FID is required for Base Account users
    if (!payload.fid) {
      return NextResponse.json(
        { error: 'Base Account (FID) required' },
        { status: 400 }
      )
    }

    // Get user's wallet using FID
    const wallet = await walletService.getWalletWithKey(payload.fid, 'ethereum')
    
    if (!wallet || !wallet.privateKey) {
      return NextResponse.json({ 
        error: 'No wallet found with private key' 
      }, { status: 404 })
    }

    // Use Avantis trading service to close all positions
    const result = await tradingService.closeAllPositions(payload.fid)
    
    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }


  } catch (error) {
    console.error('[API] Error closing all positions:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close all positions'
      },
      { status: 500 }
    )
  }
}
