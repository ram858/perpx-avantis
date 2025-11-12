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
    
    // Get wallet address for Ethereum (primary chain)
    // Use getWalletAddress to only retrieve, not create
    const walletAddress = await walletService.getWalletAddress(payload.fid, 'ethereum')
    
    // If wallet exists, get full wallet details
    type WalletResponse = {
      id: string;
      address: string;
      chain: string;
      createdAt: Date;
      updatedAt: Date;
    };
    
    let wallets: WalletResponse[] = []
    if (walletAddress) {
      const wallet = await walletService.getOrCreateWallet(payload.fid, 'ethereum')
      if (wallet) {
        wallets = [{
          id: wallet.id,
          address: wallet.address,
          chain: wallet.chain,
          createdAt: wallet.createdAt,
          updatedAt: wallet.createdAt
        }]
      }
    }
    
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
    const chainType = (chain || 'ethereum').toLowerCase()
    
    // Validate chain parameter
    const validChains = ['ethereum', 'bitcoin', 'solana', 'aptos']
    if (chainType && !validChains.includes(chainType)) {
      return NextResponse.json(
        { error: `Invalid chain. Must be one of: ${validChains.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Try to get existing wallet first
    let wallet = await walletService.getOrCreateWallet(payload.fid, chainType)
    
    // If no wallet exists, create a fallback trading wallet
    // This handles cases where Base Account address wasn't stored during auth
    if (!wallet) {
      console.log(`[API] No wallet found for FID ${payload.fid}, creating fallback trading wallet...`)
      wallet = await walletService.createTradingWallet(payload.fid, chainType)
      
      if (!wallet) {
        console.error(`[API] Failed to create fallback trading wallet for FID ${payload.fid}`)
        return NextResponse.json(
          { error: 'Failed to create wallet. Please try again.' },
          { status: 500 }
        )
      }
      
      console.log(`[API] Created fallback trading wallet for FID ${payload.fid}: ${wallet.address}`)
    }
    
    return NextResponse.json({ 
      wallet: {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        createdAt: wallet.createdAt
      }
    })
  } catch (error) {
    console.error('Error creating wallet:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create wallet',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
