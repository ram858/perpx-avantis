import { NextRequest, NextResponse } from 'next/server'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { AuthService } from '@/lib/services/AuthService'

const walletService = new BaseAccountWalletService()
const authService = new AuthService()

// GET /api/wallet/user-wallets - Get user's wallets
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
    
    // For Base Account, users typically have one wallet per chain
    const wallet = await walletService.getWalletAddress(payload.fid, 'ethereum')
    const wallets = wallet ? [{ address: wallet, chain: 'ethereum' }] : []
    
    return NextResponse.json({ wallets })
  } catch (error) {
    console.error('Error fetching user wallets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallets' },
      { status: 500 }
    )
  }
}

// POST /api/wallet/user-wallets - Create a new wallet
export async function POST(request: NextRequest) {
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
    
    const { chain, mnemonic } = await request.json()
    
    const wallet = await walletService.getOrCreateWallet(payload.fid, chain || 'ethereum')
    
    if (!wallet) {
      return NextResponse.json(
        { error: 'Failed to create wallet' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ wallet })
  } catch (error) {
    console.error('Error creating wallet:', error)
    return NextResponse.json(
      { error: 'Failed to create wallet' },
      { status: 500 }
    )
  }
}
