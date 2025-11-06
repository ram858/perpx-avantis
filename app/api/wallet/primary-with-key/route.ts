import { NextRequest, NextResponse } from 'next/server'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { AuthService } from '@/lib/services/AuthService'

const walletService = new BaseAccountWalletService()
const authService = new AuthService()

// GET /api/wallet/primary-with-key - Get user's primary trading wallet with private key
export async function GET(request: NextRequest) {
  try {
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
    
    const wallet = await walletService.getWalletWithKey(payload.fid, 'ethereum')
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'No wallet found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ wallet })
  } catch (error) {
    console.error('Error fetching primary wallet with key:', error)
    return NextResponse.json(
      { error: 'Failed to fetch primary wallet with key' },
      { status: 500 }
    )
  }
}
