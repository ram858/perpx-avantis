import { NextRequest, NextResponse } from 'next/server'
import { JwtAuthGuard } from '@/lib/guards/JwtAuthGuard'
import { WalletService } from '@/lib/services/WalletService'
import { extractUser } from '@/lib/decorators/User'

const authGuard = new JwtAuthGuard()
const walletService = new WalletService()

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authGuard.authenticate(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = authResult.user!
    const { chain, mnemonic } = await request.json()

    if (!chain) {
      return NextResponse.json(
        { error: 'Chain is required' },
        { status: 400 }
      )
    }

    // Create or get wallet
    const result = await walletService.createOrGetWallet({
      phoneNumber: user.phoneNumber,
      chain,
      mnemonic
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create wallet' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      wallet: result.wallet
    })

  } catch (error) {
    console.error('Error creating wallet:', error)
    return NextResponse.json(
      { error: 'Failed to create wallet' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authGuard.authenticate(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = authResult.user!

    // Get all wallets for user
    const wallets = await walletService.getWalletsByPhone(user.phoneNumber)

    return NextResponse.json({
      success: true,
      wallets: wallets.map(wallet => ({
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        createdAt: wallet.createdAt
      }))
    })

  } catch (error) {
    console.error('Error fetching wallets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallets' },
      { status: 500 }
    )
  }
}
