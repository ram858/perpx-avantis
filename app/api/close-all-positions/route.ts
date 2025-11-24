import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenAndGetContext } from '@/lib/utils/authHelper'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { WebWalletService } from '@/lib/services/WebWalletService'
import { AvantisTradingService } from '@/lib/services/AvantisTradingService'

// Lazy initialization - create services at runtime, not build time
function getFarcasterWalletService(): BaseAccountWalletService {
  return new BaseAccountWalletService()
}

function getWebWalletService(): WebWalletService {
  return new WebWalletService()
}

function getTradingService(): AvantisTradingService {
  return new AvantisTradingService()
}

export async function POST(request: NextRequest) {
  try {
    // Initialize services at runtime
    const tradingService = getTradingService()
    console.log('[API] Close all positions endpoint called')

    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const authContext = await verifyTokenAndGetContext(token)

    // Get user's wallet and ID based on context
    let userId: number
    
    if (authContext.context === 'farcaster') {
      // Farcaster user
      if (!authContext.fid) {
        return NextResponse.json(
          { error: 'Base Account (FID) required' },
          { status: 400 }
        )
      }
      
      userId = authContext.fid
      const farcasterWalletService = getFarcasterWalletService()
      const wallet = await farcasterWalletService.getWalletWithKey(authContext.fid, 'ethereum')
      
      if (!wallet || !wallet.privateKey) {
        return NextResponse.json({ 
          error: 'No wallet found with private key' 
        }, { status: 404 })
      }
    } else {
      // Web user
      if (!authContext.webUserId) {
        return NextResponse.json(
          { error: 'Web user ID required' },
          { status: 400 }
        )
      }
      
      userId = authContext.webUserId
      const webWalletService = getWebWalletService()
      const webWallet = await webWalletService.getWallet(authContext.webUserId, 'ethereum')
      
      if (!webWallet) {
        return NextResponse.json({ 
          error: 'No wallet found' 
        }, { status: 404 })
      }
      
      const privateKey = await webWalletService.getPrivateKey(authContext.webUserId, 'ethereum')
      if (!privateKey) {
        return NextResponse.json({ 
          error: 'Wallet private key not available' 
        }, { status: 404 })
      }
    }

    // Use Avantis trading service to close all positions
    const result = await tradingService.closeAllPositions(userId)
    
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
