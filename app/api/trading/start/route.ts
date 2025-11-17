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
    
    // FID is required for user identification
    if (!payload.fid) {
      return NextResponse.json(
        { error: 'User authentication (FID) required. This app runs in Base app only.' },
        { status: 400 }
      )
    }
    
    // Parse request body
    const config = await request.json()
    console.log('[API] Trading config:', config)
    
    // Get or create trading wallet (required for automated trading)
    const wallet = await walletService.ensureTradingWallet(payload.fid);
    
    if (!wallet || !wallet.privateKey) {
      console.error('[API] Failed to get trading wallet with private key for FID:', payload.fid);
      return NextResponse.json(
        { error: 'No trading wallet found. Please ensure your trading wallet is properly set up.' },
        { status: 404 }
      );
    }
    
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;
    console.log('[API] Using trading wallet for automated trading:', walletAddress, 'for FID:', payload.fid);
    console.log('[API] Private key available:', privateKey ? `${privateKey.slice(0, 10)}...${privateKey.slice(-4)}` : 'MISSING');
    
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
        maxPerSession: config.maxPositions || config.maxPerSession || 3,
        lossThreshold: config.lossThreshold || 10,
        avantisApiWallet: privateKey, // Private key for Avantis trading
        userFid: payload.fid,
        walletAddress: walletAddress, // Trading wallet address
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
      console.error('[API] Trading engine returned error:', errorData);
      return NextResponse.json({ 
        success: false, 
        error: errorData.error || `Failed to start trading (${response.status})` 
      }, { status: response.status })
    }

    const result = await response.json()
    console.log('[API] Trading session started successfully:', result.sessionId);
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Error starting trading:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { success: false, error: `Failed to start trading: ${errorMessage}` },
      { status: 500 }
    )
  }
}