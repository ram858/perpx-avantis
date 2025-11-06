import { NextRequest, NextResponse } from 'next/server'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { AuthService } from '@/lib/services/AuthService'

const walletService = new BaseAccountWalletService()
const authService = new AuthService()

// GET /api/wallet/primary - Get user's primary trading wallet
export async function GET(request: NextRequest) {
  try {
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
    
    const wallet = await walletService.getWalletAddress(payload.fid, 'ethereum')
    
    return NextResponse.json({ 
      wallet: wallet ? { address: wallet, chain: 'ethereum' } : null 
    })
  } catch (error) {
    console.error('Error fetching primary wallet:', error)
    return NextResponse.json(
      { error: 'Failed to fetch primary wallet' },
      { status: 500 }
    )
  }
}
