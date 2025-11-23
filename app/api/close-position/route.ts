import { NextRequest, NextResponse } from 'next/server'
import { AvantisTradingService } from '@/lib/services/AvantisTradingService'
import { AuthService } from '@/lib/services/AuthService'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'

// Lazy initialization - create services at runtime, not build time
function getTradingService(): AvantisTradingService {
  return new AvantisTradingService()
}

function getAuthService(): AuthService {
  return new AuthService()
}

function getWalletService(): BaseAccountWalletService {
  return new BaseAccountWalletService()
}

export async function POST(request: NextRequest) {
  try {
    // Initialize services at runtime
    const tradingService = getTradingService()
    const authService = getAuthService()
    const walletService = getWalletService()
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
    
    // Parse request body - Avantis uses pair_index instead of symbol
    const { pair_index, symbol } = await request.json()
    
    // pair_index is required for Avantis
    if (!pair_index && !symbol) {
      return NextResponse.json({ 
        error: 'pair_index is required (Avantis uses pair indices, not symbols)' 
      }, { status: 400 })
    }

    // Get user's wallet for private key using FID
    const wallet = await walletService.getWalletWithKey(payload.fid, 'ethereum')
    
    if (!wallet || !wallet.privateKey) {
      return NextResponse.json({ 
        error: 'No wallet found with private key' 
      }, { status: 404 })
    }

    // If symbol provided, we need to resolve it to pair_index
    // For now, require pair_index directly
    const pairIndex = pair_index || parseInt(symbol) // Fallback: try parsing symbol as number
    
    if (!pairIndex || isNaN(pairIndex)) {
      return NextResponse.json({ 
        error: 'Valid pair_index is required. Please provide the pair_index from the position data.' 
      }, { status: 400 })
    }

    console.log(`[ClosePosition] Closing position with pair_index ${pairIndex} for FID ${payload.fid}`)

    // Use the trading service to close the position with private key
    const result = await tradingService.closePosition(pairIndex, wallet.privateKey, payload.fid)
    
    if (result.success) {
      console.log(`[ClosePosition] Successfully closed position for pair_index ${pairIndex}`)
      return NextResponse.json({
        success: true,
        message: result.message
      })
    } else {
      console.error(`[ClosePosition] Failed to close position for pair_index ${pairIndex}: ${result.message}`)
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
