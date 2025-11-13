import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/AuthService'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'

const authService = new AuthService()
const walletService = new BaseAccountWalletService()

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Trading start endpoint called')
    
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)
    
    // FID is required for Base Account users
    if (!payload.fid) {
      return NextResponse.json(
        { error: 'Base Account (FID) required. This app runs in Base app only.' },
        { status: 400 }
      )
    }
    
    // Parse request body
    const config = await request.json()
    console.log('[API] Trading config:', config)
    
    // For Base Account users, we use their Base Account address
    // Note: Base Accounts are smart wallets (ERC-4337), so they don't have traditional private keys
    // The trading engine will need to work with the address and use Base Account SDK for signing
    
    // Try to get Base Account address from stored wallet or use a trading wallet
    let walletAddress: string | null = null;
    let privateKey: string | null = null;
    let isBaseAccount = false;
    
    // First, try to get Base Account address (if stored)
    const baseAccountAddress = await walletService.getBaseAccountAddress(payload.fid);
    
    if (baseAccountAddress) {
      // Use Base Account address
      walletAddress = baseAccountAddress;
      isBaseAccount = true; // Assume it's a Base Account if we only have address
      console.log('[API] Using Base Account address:', walletAddress, 'for FID:', payload.fid);
      
      // For Base Accounts, we don't have a private key (they're smart wallets)
      // The trading engine will need to handle Base Account transactions differently
      // Actual trading will need to be done via Base Account SDK on the frontend
    } else {
      // Fallback: Create a trading wallet for automated trading
      // This is a workaround - ideally all trading should use Base Account
      const wallet = await walletService.ensureTradingWallet(payload.fid);
      
      if (!wallet || !wallet.privateKey) {
        return NextResponse.json(
          { error: 'No trading wallet found. Please ensure you are signed in with Base Account.' },
          { status: 404 }
        );
      }
      
      walletAddress = wallet.address;
      privateKey = wallet.privateKey;
      isBaseAccount = false;
      console.log('[API] Using trading wallet:', walletAddress, 'for FID:', payload.fid);
    }
    
    console.log('[API] Calling trading engine with address:', walletAddress, 'isBaseAccount:', isBaseAccount);
    
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
        avantisApiWallet: privateKey, // May be null for Base Accounts
        userFid: payload.fid,
        walletAddress: walletAddress, // Base Account address or trading wallet address
        isBaseAccount: isBaseAccount, // Flag to indicate if this is a Base Account (no private key)
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