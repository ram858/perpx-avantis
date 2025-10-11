import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/AuthService'
import { UserWalletService } from '@/lib/services/UserWalletService'

const authService = new AuthService()
const userWalletService = new UserWalletService()

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Trading start endpoint called')
    
    // Parse request body
    const config = await request.json()
    console.log('[API] Trading config:', config)
    
    // TEMPORARY: Skip authentication for testing
    // TODO: Re-enable authentication once basic functionality is working
    
    // Mock user data for testing
    const user = { phoneNumber: '9808110921' }
    const wallet = {
      address: '0xaa0bA0700Cfd1489d08C63C4bd177638Be4C86F6',
      privateKey: '0xc2614e090f4a9e229c197256ef9c5b0647fadfc44cb1da5b2d5e6969b68ba61b'
    }
    
    console.log('[API] Using test wallet:', wallet.address, 'for user:', user.phoneNumber)
    
    console.log('[API] Wallet found, calling trading engine...')
    
    // Call the trading engine to start trading
    const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001'
    const response = await fetch(`${tradingEngineUrl}/api/trading/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxBudget: config.totalBudget || config.investmentAmount || config.maxBudget,
        profitGoal: config.profitGoal || config.targetProfit,
        maxPerSession: config.maxPositions || config.maxPerSession || 5,
        hyperliquidApiWallet: wallet.privateKey,
        userPhoneNumber: user.phoneNumber,
        walletAddress: wallet.address
      })
    })

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json()
      } catch (parseError) {
        // If response is not JSON (e.g., HTML error page), create a generic error
        const textResponse = await response.text()
        console.error('[API] Non-JSON response from trading engine:', textResponse.substring(0, 200))
        errorData = { error: `Trading engine error: ${response.status} ${response.statusText}` }
      }
      return NextResponse.json({ 
        success: false, 
        error: errorData.error || 'Failed to start trading' 
      }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error starting trading:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to start trading' },
      { status: 500 }
    )
  }
}