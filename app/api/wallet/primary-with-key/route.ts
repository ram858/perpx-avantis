import { NextRequest, NextResponse } from 'next/server'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { WebWalletService } from '@/lib/services/WebWalletService'
import { verifyTokenAndGetContext } from '@/lib/utils/authHelper'

const farcasterWalletService = new BaseAccountWalletService()
const webWalletService = new WebWalletService()

// GET /api/wallet/primary-with-key - Get user's primary trading wallet with private key (supports both Farcaster and Web)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[API] primary-with-key - Missing or invalid authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    let authContext
    try {
      authContext = await verifyTokenAndGetContext(token)
    } catch (authError) {
      console.error('[API] primary-with-key - Token verification failed:', authError)
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }
    
    let wallet: { id: string; address: string; chain: string; privateKey: string; createdAt: Date } | null = null
    
    if (authContext.context === 'farcaster') {
      // Farcaster user
      if (!authContext.fid) {
        console.error('[API] primary-with-key - No FID in token payload')
        return NextResponse.json(
          { error: 'Base Account (FID) required' },
          { status: 400 }
        )
      }
      
      console.log('[API] primary-with-key - Fetching wallet for FID:', authContext.fid)
      
      try {
        const farcasterWallet = await farcasterWalletService.getWalletWithKey(authContext.fid, 'ethereum')
        if (farcasterWallet) {
          wallet = {
            id: farcasterWallet.id,
            address: farcasterWallet.address,
            chain: farcasterWallet.chain,
            privateKey: farcasterWallet.privateKey || '',
            createdAt: farcasterWallet.createdAt
          }
        }
      } catch (walletError) {
        console.error('[API] primary-with-key - Error fetching wallet:', walletError)
        return NextResponse.json(
          { 
            error: 'Failed to fetch wallet from database',
            details: walletError instanceof Error ? walletError.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    } else {
      // Web user
      if (!authContext.webUserId) {
        console.error('[API] primary-with-key - No web user ID in token payload')
        return NextResponse.json(
          { error: 'Web user ID required' },
          { status: 400 }
        )
      }
      
      console.log('[API] primary-with-key - Fetching wallet for web user:', authContext.webUserId)
      
      try {
        const webWallet = await webWalletService.getWallet(authContext.webUserId, 'ethereum')
        if (webWallet) {
          const privateKey = await webWalletService.getPrivateKey(authContext.webUserId, 'ethereum')
          if (privateKey) {
            wallet = {
              id: `web_${webWallet.id}`,
              address: webWallet.address,
              chain: webWallet.chain,
              privateKey: privateKey,
              createdAt: new Date(webWallet.created_at)
            }
          }
        }
      } catch (walletError) {
        console.error('[API] primary-with-key - Error fetching wallet:', walletError)
        return NextResponse.json(
          { 
            error: 'Failed to fetch wallet from database',
            details: walletError instanceof Error ? walletError.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }
    
    console.log('[API] primary-with-key - Wallet fetch result:', {
      context: authContext.context,
      hasWallet: !!wallet,
      address: wallet?.address,
      hasPrivateKey: !!wallet?.privateKey,
      privateKeyLength: wallet?.privateKey?.length || 0,
      chain: wallet?.chain
    })
    
    if (!wallet) {
      console.error('[API] primary-with-key - No wallet found')
      return NextResponse.json(
        { 
          error: 'No trading wallet found',
          message: 'Please deposit funds to create your trading wallet first.'
        },
        { status: 404 }
      )
    }
    
    if (!wallet.privateKey || wallet.privateKey.length === 0) {
      console.error('[API] primary-with-key - Wallet found but no private key')
      return NextResponse.json(
        { 
          error: 'Wallet found but private key not available',
          message: 'The trading wallet exists but the private key is missing. Please try depositing funds again to reinitialize your trading wallet.',
          walletAddress: wallet.address
        },
        { status: 404 }
      )
    }
    
    // Validate private key format (should start with 0x and be 66 chars)
    if (!wallet.privateKey.startsWith('0x') || wallet.privateKey.length !== 66) {
      console.error('[API] primary-with-key - Invalid private key format:', {
        length: wallet.privateKey.length,
        startsWith0x: wallet.privateKey.startsWith('0x')
      })
      return NextResponse.json(
        { 
          error: 'Invalid private key format',
          message: 'The private key stored in the database is invalid. Please contact support.'
        },
        { status: 500 }
      )
    }
    
    console.log('[API] primary-with-key - ✅ Successfully returning wallet with private key')
    
    // Return wallet with private key (security: only return to authenticated user)
    return NextResponse.json({ 
      wallet: {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        privateKey: wallet.privateKey, // Only returned to authenticated user
        createdAt: wallet.createdAt
      }
    })
  } catch (error) {
    console.error('[API] primary-with-key - Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch primary wallet with key',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
