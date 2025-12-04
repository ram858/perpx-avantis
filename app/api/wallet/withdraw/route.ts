import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/AuthService'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { getNetworkConfig } from '@/lib/config/network'
import { ethers } from 'ethers'

// Lazy initialization - create services at runtime, not build time
function getAuthService(): AuthService {
  return new AuthService()
}

function getWalletService(): BaseAccountWalletService {
  return new BaseAccountWalletService()
}

// Get network config at runtime
function getNetwork() {
  return getNetworkConfig()
}

interface WithdrawRequestBody {
  amount: string
  recipientAddress: string
  asset?: 'USDC' | 'ETH'
}

export async function POST(request: NextRequest) {
  try {
    const authService = getAuthService()
    const walletService = getWalletService()
    const network = getNetwork()
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)

    if (!payload.fid) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 400 }
      )
    }

    const body: WithdrawRequestBody = await request.json()
    const { amount, recipientAddress, asset = 'USDC' } = body

    // Validate amount
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      )
    }

    // Validate recipient address
    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      return NextResponse.json(
        { error: 'Invalid recipient wallet address' },
        { status: 400 }
      )
    }

    // Only USDC withdrawals for now
    if (asset !== 'USDC') {
      return NextResponse.json(
        { error: 'Only USDC withdrawals are supported' },
        { status: 400 }
      )
    }

    // Get trading wallet with private key
    const tradingWallet = await walletService.getWalletWithKey(payload.fid, 'ethereum')
    
    if (!tradingWallet || !tradingWallet.privateKey) {
      return NextResponse.json(
        { error: 'Trading wallet not found or private key unavailable' },
        { status: 404 }
      )
    }

    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(network.rpcUrl)
    const wallet = new ethers.Wallet(tradingWallet.privateKey, provider)

    // Check current USDC balance
    const usdcContract = new ethers.Contract(
      network.usdcAddress,
      [
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)'
      ],
      wallet
    )

    const currentBalance = await usdcContract.balanceOf(wallet.address)
    const amountInUnits = ethers.parseUnits(amount, network.usdcDecimals)

    if (currentBalance < amountInUnits) {
      const balanceFormatted = ethers.formatUnits(currentBalance, network.usdcDecimals)
      return NextResponse.json(
        { error: `Insufficient balance. Available: $${Number(balanceFormatted).toFixed(2)} USDC` },
        { status: 400 }
      )
    }

    // Check if there are active trading sessions
    try {
      const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001'
      const sessionsResponse = await fetch(`${tradingEngineUrl}/api/trading/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }).catch(() => null)
      
      if (sessionsResponse?.ok) {
        const sessionsData = await sessionsResponse.json()
        const activeSessions = sessionsData.sessions?.filter((s: any) => s.status === 'running') || []
        if (activeSessions.length > 0) {
          return NextResponse.json(
            { error: 'Cannot withdraw while trading session is active. Please stop trading first.' },
            { status: 400 }
          )
        }
      }
    } catch (sessionCheckError) {
      // If session check fails, allow withdrawal (better UX)
      console.warn('[API] Failed to check active sessions:', sessionCheckError)
    }

    // Execute the transfer
    try {
      const tx = await usdcContract.transfer(recipientAddress, amountInUnits)
      const receipt = await tx.wait()

      return NextResponse.json({
        success: true,
        txHash: receipt.hash,
        amount,
        asset: 'USDC',
        recipient: recipientAddress,
        message: `Successfully withdrew $${amount} USDC`
      })
    } catch (txError) {
      console.error('[API] Withdrawal transaction failed:', txError)
      return NextResponse.json(
        { error: 'Transaction failed. Please check your balance and try again.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API] Withdrawal failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to process withdrawal',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

