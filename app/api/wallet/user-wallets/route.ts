import { NextRequest, NextResponse } from 'next/server'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { WebWalletService } from '@/lib/services/WebWalletService'
import { verifyTokenAndGetContext } from '@/lib/utils/authHelper'

// Lazy initialization - create services at runtime, not build time
function getFarcasterWalletService(): BaseAccountWalletService {
  return new BaseAccountWalletService()
}

function getWebWalletService(): WebWalletService {
  return new WebWalletService()
}

// GET /api/wallet/user-wallets - Get user's wallets (supports both Farcaster and Web)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const authContext = await verifyTokenAndGetContext(token)
    
    type WalletResponse = {
      id: string;
      address: string;
      chain: string;
      createdAt: Date;
      updatedAt: Date;
      walletType: 'base-account' | 'trading' | 'legacy';
    };

    const wallets: WalletResponse[] = []

    if (authContext.context === 'farcaster') {
      // Farcaster user - use existing logic
      if (!authContext.fid) {
        return NextResponse.json(
          { error: 'Base Account (FID) required' },
          { status: 400 }
        )
      }

      const farcasterWalletService = getFarcasterWalletService()
      // Base Account wallet (smart wallet)
      const baseAddress = await farcasterWalletService.getBaseAccountAddress(authContext.fid)
      if (baseAddress) {
        wallets.push({
          id: `fid_${authContext.fid}_base-account`,
          address: baseAddress,
          chain: 'base',
          createdAt: new Date(),
          updatedAt: new Date(),
          walletType: 'base-account'
        })
      }

      // Trading wallet (fallback EOA with private key)
      const tradingWallet = await farcasterWalletService.getWalletWithKey(authContext.fid, 'ethereum')
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
    } else {
      // Web user - use web wallet service
      if (!authContext.webUserId) {
        console.error('[user-wallets] Web user ID missing from auth context:', authContext)
        return NextResponse.json(
          { error: 'Web user ID required' },
          { status: 400 }
        )
      }

      console.log(`[user-wallets] Fetching wallets for web user ID: ${authContext.webUserId}`)
      const webWalletService = getWebWalletService()
      
      try {
        const webWallets = await webWalletService.getAllWallets(authContext.webUserId)
        console.log(`[user-wallets] Found ${webWallets.length} wallets for web user ${authContext.webUserId}`)
        
        for (const wallet of webWallets) {
          wallets.push({
            id: `web_${wallet.id}`,
            address: wallet.address,
            chain: wallet.chain,
            createdAt: new Date(wallet.created_at),
            updatedAt: new Date(wallet.updated_at),
            walletType: wallet.wallet_type === 'trading' ? 'trading' : 'legacy'
          })
        }
        
        // If no wallets found, automatically create one (should have been created during auth, but create as fallback)
        if (webWallets.length === 0) {
          console.warn(`[user-wallets] No wallets found for web user ${authContext.webUserId}. Creating wallet now...`)
          try {
            const newWallet = await webWalletService.ensureTradingWallet(authContext.webUserId)
            console.log(`[user-wallets] ✅ Created trading wallet for web user ${authContext.webUserId}: ${newWallet.address}`)
            wallets.push({
              id: `web_${newWallet.id}`,
              address: newWallet.address,
              chain: newWallet.chain,
              createdAt: new Date(newWallet.created_at),
              updatedAt: new Date(newWallet.updated_at),
              walletType: newWallet.wallet_type === 'trading' ? 'trading' : 'legacy'
            })
          } catch (createError) {
            console.error(`[user-wallets] ❌ Failed to create wallet for web user ${authContext.webUserId}:`, createError)
            // Don't throw - return empty array instead
          }
        }
      } catch (walletError) {
        console.error(`[user-wallets] Error fetching wallets for web user ${authContext.webUserId}:`, walletError)
        throw walletError // Re-throw to be caught by outer catch block
      }
    }

    return NextResponse.json({ wallets })
  } catch (error) {
    console.error('Error fetching user wallets:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Log full error details for debugging
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch wallets',
        message: errorMessage,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {})
      },
      { status: 500 }
    )
  }
}

// POST /api/wallet/user-wallets - Create a new wallet (supports both Farcaster and Web)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const authContext = await verifyTokenAndGetContext(token)
    
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
    
    if (authContext.context === 'farcaster') {
      // Farcaster user - use existing logic
      if (!authContext.fid) {
        return NextResponse.json(
          { error: 'Base Account (FID) required' },
          { status: 400 }
        )
      }

      if (chainType === 'ethereum') {
        // Ensure trading wallet exists (create if needed)
        const farcasterWalletService = getFarcasterWalletService()
        const wallet = await farcasterWalletService.ensureTradingWallet(authContext.fid)
        
        if (!wallet) {
          console.error(`[API] Failed to create fallback trading wallet for FID ${authContext.fid}`)
          return NextResponse.json(
            { error: 'Failed to create wallet. Please try again.' },
            { status: 500 }
          )
        }

        console.log(`[API] Trading wallet ready for FID ${authContext.fid}: ${wallet.address}`)

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
        const farcasterWalletService = getFarcasterWalletService()
        const baseAddress = await farcasterWalletService.getBaseAccountAddress(authContext.fid)
        return NextResponse.json({
          wallet: baseAddress
            ? {
                id: `fid_${authContext.fid}_base-account`,
                address: baseAddress,
                chain: 'base',
                createdAt: new Date(),
                walletType: 'base-account'
              }
            : null
        })
      }
    } else {
      // Web user - use web wallet service
      if (!authContext.webUserId) {
        return NextResponse.json(
          { error: 'Web user ID required' },
          { status: 400 }
        )
      }

      if (chainType === 'ethereum') {
        // Ensure trading wallet exists (create if needed)
        const webWalletService = getWebWalletService()
        const wallet = await webWalletService.ensureTradingWallet(authContext.webUserId)
        
        if (!wallet) {
          console.error(`[API] Failed to create trading wallet for web user ${authContext.webUserId}`)
          return NextResponse.json(
            { error: 'Failed to create wallet. Please try again.' },
            { status: 500 }
          )
        }

        console.log(`[API] Trading wallet ready for web user ${authContext.webUserId}: ${wallet.address}`)

        return NextResponse.json({ 
          wallet: {
            id: `web_${wallet.id}`,
            address: wallet.address,
            chain: wallet.chain,
            createdAt: new Date(wallet.created_at),
            walletType: 'trading'
          }
        })
      }
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
