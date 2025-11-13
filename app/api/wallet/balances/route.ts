import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { AuthService } from '@/lib/services/AuthService'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { RealBalanceService } from '@/lib/services/RealBalanceService'

export const runtime = 'nodejs'

const authService = new AuthService()
const walletService = new BaseAccountWalletService()

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

    const url = new URL(request.url)
    const addressParam = url.searchParams.get('address')

    if (!addressParam || !ethers.isAddress(addressParam)) {
      return NextResponse.json(
        { error: 'A valid wallet address is required' },
        { status: 400 }
      )
    }

    const address = addressParam.toLowerCase()

    const baseAddress = (await walletService.getBaseAccountAddress(payload.fid))?.toLowerCase() || null
    const tradingWallet = await walletService.getWalletWithKey(payload.fid, 'ethereum')
    const tradingAddress = tradingWallet?.address?.toLowerCase() || null

    if (address !== baseAddress && address !== tradingAddress) {
      return NextResponse.json(
        { error: 'Address not authorized for this user' },
        { status: 403 }
      )
    }

    const balanceService = new RealBalanceService()
    const balance = await balanceService.getAllBalances(address)

    return NextResponse.json({
      address,
      balance
    })
  } catch (error) {
    console.error('[API] Failed to fetch wallet balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallet balances' },
      { status: 500 }
    )
  }
}

