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
    
    type WalletResponse = {
      id: string;
      address: string;
      chain: string;
      createdAt: Date;
      updatedAt: Date;
      walletType: 'base-account' | 'trading' | 'legacy';
    };

    const wallets: WalletResponse[] = []

    // Base Account wallet (smart wallet)
    const baseAddress = await walletService.getBaseAccountAddress(payload.fid)
    if (baseAddress) {
      wallets.push({
        id: `fid_${payload.fid}_base-account`,
        address: baseAddress,
        chain: 'base',
        createdAt: new Date(),
        updatedAt: new Date(),
        walletType: 'base-account'
      })
    }

    // Trading wallet (fallback EOA with private key)
    const tradingWallet = await walletService.getWalletWithKey(payload.fid, 'ethereum')
    if (tradingWallet) {
      wallets.push({
        id: tradingWallet.id,
        address: tradingWallet.address,
        chain: 'ethereum',
        createdAt: tradingWallet.createdAt,
        updatedAt: tradingWallet.createdAt,
        walletType: tradingWallet.privateKey ? 'trading' : 'legacy'
      })
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
    
    if (chainType === 'ethereum') {
      // Ensure trading wallet exists (create if needed)
      const wallet = await walletService.ensureTradingWallet(payload.fid)
      
      if (!wallet) {
        console.error(`[API] Failed to create fallback trading wallet for FID ${payload.fid}`)
        return NextResponse.json(
          { error: 'Failed to create wallet. Please try again.' },
          { status: 500 }
        )
      }

      console.log(`[API] Trading wallet ready for FID ${payload.fid}: ${wallet.address}`)

      return NextResponse.json({ 
        wallet: {
          id: wallet.id,
          address: wallet.address,
          chain: wallet.chain,
          createdAt: wallet.createdAt,
          walletType: 'trading'
        }
      })
    }

    if (chainType === 'base-account') {
      const baseAddress = await walletService.getBaseAccountAddress(payload.fid)
      return NextResponse.json({
        wallet: baseAddress
          ? {
              id: `fid_${payload.fid}_base-account`,
              address: baseAddress,
              chain: 'base',
              createdAt: new Date(),
              walletType: 'base-account'
            }
          : null
      })
    }

    return NextResponse.json(
      { error: `Unsupported chain "${chainType}" for wallet creation.` },
      { status: 400 }
    )
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
