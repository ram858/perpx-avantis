import { NextRequest, NextResponse } from 'next/server'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { AuthService } from '@/lib/services/AuthService'

// Lazy initialization - create services at runtime, not build time
function getWalletService(): BaseAccountWalletService {
  return new BaseAccountWalletService()
}

function getAuthService(): AuthService {
  return new AuthService()
}

// GET /api/wallet/primary - Get user's primary trading wallet
export async function GET(request: NextRequest) {
  try {
    const walletService = getWalletService()
    const authService = getAuthService()
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)
    
    if (!payload.fid) {
      return NextResponse.json(
        { error: 'Base Account (FID) required' },
        { status: 400 }
      )
    }
    
    const wallet = await walletService.getBaseAccountAddress(payload.fid)
    
    return NextResponse.json({ 
      wallet: wallet ? { address: wallet, chain: 'base', walletType: 'base-account' } : null 
    })
  } catch (error) {
    console.error('Error fetching primary wallet:', error)
    return NextResponse.json(
      { error: 'Failed to fetch primary wallet' },
      { status: 500 }
    )
  }
}
