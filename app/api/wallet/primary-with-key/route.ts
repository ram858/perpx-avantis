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
    
    console.log('[API] primary-with-key - Wallet fetch result:', {
      fid: payload.fid,
      hasWallet: !!wallet,
      address: wallet?.address,
      hasPrivateKey: !!wallet?.privateKey,
      privateKeyLength: wallet?.privateKey?.length || 0
    })
    
    if (!wallet) {
      console.error('[API] primary-with-key - No wallet found for FID:', payload.fid)
      return NextResponse.json(
        { error: 'No wallet found' },
        { status: 404 }
      )
    }
    
    if (!wallet.privateKey) {
      console.error('[API] primary-with-key - Wallet found but no private key for FID:', payload.fid)
      return NextResponse.json(
        { error: 'Wallet found but private key not available. Please try depositing funds first to initialize your trading wallet.' },
        { status: 404 }
      )
    }
    
    console.log('[API] primary-with-key - Successfully returning wallet with private key')
    return NextResponse.json({ wallet })
  } catch (error) {
    console.error('Error fetching primary wallet with key:', error)
    return NextResponse.json(
      { error: 'Failed to fetch primary wallet with key' },
      { status: 500 }
    )
  }
}
