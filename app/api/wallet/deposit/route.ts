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

const ERC20_INTERFACE = new ethers.Interface([
  'function transfer(address to, uint256 amount) returns (bool)'
])

// Get network config at runtime
function getNetwork() {
  return getNetworkConfig()
}

interface DepositRequestBody {
  amount: string
  asset: 'USDC' | 'ETH'
  baseAddress?: string
}

export async function POST(request: NextRequest) {
  try {
    const authService = getAuthService();
    const walletService = getWalletService();
    const network = getNetwork();
    
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

    const body: DepositRequestBody = await request.json()
    const asset = body.asset || 'USDC'
    const amount = body.amount

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      )
    }

    if (asset !== 'USDC' && asset !== 'ETH') {
      return NextResponse.json(
        { error: 'Unsupported asset. Only ETH and USDC are supported.' },
        { status: 400 }
      )
    }

    const baseAddress = (body.baseAddress || '').toLowerCase()
    const storedBaseAddress = (await walletService.getBaseAccountAddress(payload.fid))?.toLowerCase() || null

    if (storedBaseAddress && baseAddress && storedBaseAddress !== baseAddress) {
      return NextResponse.json(
        { error: 'Base wallet mismatch. Please reconnect your wallet.' },
        { status: 400 }
      )
    }

    const fromAddress = baseAddress || storedBaseAddress
    if (!fromAddress) {
      return NextResponse.json(
        { error: 'No Base wallet address is stored for this user.' },
        { status: 400 }
      )
    }

    // Ensure trading wallet exists (destination)
    const tradingWallet = await walletService.ensureTradingWallet(payload.fid)
    if (!tradingWallet) {
      return NextResponse.json(
        { error: 'Failed to prepare trading wallet. Please try again.' },
        { status: 500 }
      )
    }

    const destination = tradingWallet.address
    let transaction: { from: string; to: string; value: string; data: string; gas?: string }

    try {
      if (asset === 'ETH') {
        const value = ethers.toBeHex(ethers.parseEther(amount))
        transaction = {
          from: fromAddress,
          to: destination,
          value,
          data: '0x'
        }
      } else {
        const amountInUnits = ethers.parseUnits(amount, network.usdcDecimals)
        transaction = {
          from: fromAddress,
          to: network.usdcAddress,
          value: '0x0',
          data: ERC20_INTERFACE.encodeFunctionData('transfer', [destination, amountInUnits]),
          gas: ethers.toBeHex(BigInt(200000))
        }
      }
    } catch (amountError) {
      return NextResponse.json(
        { error: 'Invalid amount format. Please check your input.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      network: {
        name: network.name,
        chainId: network.chainId
      },
      asset,
      amount,
      depositAddress: destination,
      transaction,
      note: `Send ${asset} from your Base wallet to fund your PrepX trading vault`
    })
  } catch (error) {
    console.error('[API] Deposit preparation failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to prepare deposit transaction',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

