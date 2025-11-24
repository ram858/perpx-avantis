import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenAndGetContext } from '@/lib/utils/authHelper'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { WebWalletService } from '@/lib/services/WebWalletService'

// Lazy initialization - create services at runtime, not build time
function getFarcasterWalletService(): BaseAccountWalletService {
  return new BaseAccountWalletService()
}

function getWebWalletService(): WebWalletService {
  return new WebWalletService()
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Trading start endpoint called')
    
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[API] Missing or invalid authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Verify token and get context (supports both Farcaster and web users)
    let authContext
    try {
      authContext = await verifyTokenAndGetContext(token)
    } catch (authError) {
      console.error('[API] Token verification failed:', authError)
      const errorMessage = authError instanceof Error ? authError.message : 'Token verification failed'
      
      // Return appropriate error based on the type of authentication failure
      if (errorMessage.includes('expired') || errorMessage.includes('Token expired')) {
        return NextResponse.json(
          { error: 'Token expired. Please refresh your session and try again.' },
          { status: 401 }
        )
      }
      
      if (errorMessage.includes('Invalid token') || errorMessage.includes('invalid')) {
        return NextResponse.json(
          { error: 'Invalid authentication token. Please log in again.' },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { error: 'Unauthorized: Authentication failed. Please log in again.' },
        { status: 401 }
      )
    }
    
    // Parse request body
    const config = await request.json()
    console.log('[API] Trading config:', config)
    
    // Get trading wallet based on user context
    let wallet: { address: string; privateKey: string } | null = null
    let userId: string | number
    
    if (authContext.context === 'farcaster') {
      // Farcaster user
      if (!authContext.fid) {
        console.error('[API] No FID in token payload')
        return NextResponse.json(
          { error: 'User authentication (FID) required.' },
          { status: 400 }
        )
      }
      
      userId = authContext.fid
      const farcasterWalletService = getFarcasterWalletService()
      const farcasterWallet = await farcasterWalletService.ensureTradingWallet(authContext.fid)
      
      if (!farcasterWallet || !farcasterWallet.privateKey) {
        console.error('[API] Failed to get trading wallet with private key for FID:', authContext.fid)
        return NextResponse.json(
          { error: 'No trading wallet found. Please ensure your trading wallet is properly set up.' },
          { status: 404 }
        )
      }
      
      wallet = {
        address: farcasterWallet.address,
        privateKey: farcasterWallet.privateKey
      }
      console.log('[API] Using trading wallet for automated trading:', wallet.address, 'for FID:', authContext.fid)
    } else {
      // Web user
      if (!authContext.webUserId) {
        console.error('[API] No webUserId in token payload')
        return NextResponse.json(
          { error: 'User authentication (webUserId) required.' },
          { status: 400 }
        )
      }
      
      userId = authContext.webUserId
      const webWalletService = getWebWalletService()
      const webWallet = await webWalletService.ensureTradingWallet(authContext.webUserId)
      
      if (!webWallet) {
        console.error('[API] Failed to get trading wallet for webUserId:', authContext.webUserId)
        return NextResponse.json(
          { error: 'No trading wallet found. Please ensure your trading wallet is properly set up.' },
          { status: 404 }
        )
      }
      
      const privateKey = await webWalletService.getPrivateKey(authContext.webUserId, 'ethereum')
      if (!privateKey) {
        console.error('[API] Failed to get private key for webUserId:', authContext.webUserId)
        return NextResponse.json(
          { error: 'Trading wallet private key not available.' },
          { status: 404 }
        )
      }
      
      wallet = {
        address: webWallet.address,
        privateKey: privateKey
      }
      console.log('[API] Using trading wallet for automated trading:', wallet.address, 'for webUserId:', authContext.webUserId)
    }
    
    if (!wallet || !wallet.privateKey) {
      return NextResponse.json(
        { error: 'No trading wallet found. Please ensure your trading wallet is properly set up.' },
        { status: 404 }
      )
    }
    
    const walletAddress = wallet.address
    const privateKey = wallet.privateKey
    console.log('[API] Private key available:', privateKey ? `${privateKey.slice(0, 10)}...${privateKey.slice(-4)}` : 'MISSING')
    
    // Call the trading engine to start trading
    const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001'
    
    // Clean up URL (remove trailing /api/trading-engine if present)
    const cleanUrl = tradingEngineUrl.replace(/\/api\/trading-engine\/?$/, '');
    const tradingEngineEndpoint = `${cleanUrl}/api/trading/start`;
    
    console.log('[API] Calling trading engine at:', tradingEngineEndpoint);
    
    let response;
    try {
      response = await fetch(tradingEngineEndpoint, {
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
          userFid: authContext.context === 'farcaster' ? authContext.fid : undefined, // FID for Farcaster users
          userPhoneNumber: authContext.context === 'web' ? undefined : undefined, // Not used for web users
          webUserId: authContext.context === 'web' ? authContext.webUserId : undefined, // Web user ID
          walletAddress: walletAddress, // Trading wallet address
        }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
    } catch (fetchError) {
      // Handle network errors (connection refused, timeout, etc.)
      console.error('[API] Failed to connect to trading engine:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown network error';
      
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        return NextResponse.json({ 
          success: false, 
          error: `Trading engine is not accessible. Please ensure the trading engine is running at ${cleanUrl}. Error: ${errorMessage}` 
        }, { status: 502 });
      }
      
      if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
        return NextResponse.json({ 
          success: false, 
          error: `Trading engine request timed out. Please check if the trading engine is running and try again.` 
        }, { status: 504 });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: `Failed to connect to trading engine: ${errorMessage}` 
      }, { status: 502 });
    }

    if (!response.ok) {
      let errorData;
      // Read response as text first, then try to parse as JSON
      // This avoids "Body has already been read" error
      const responseText = await response.text();
      try {
        errorData = JSON.parse(responseText);
      } catch (parseError) {
        // If response is not JSON (e.g., HTML error page), create a generic error
        console.error('[API] Non-JSON response from trading engine:', responseText.substring(0, 200))
        errorData = { error: `Trading engine error: ${response.status} ${response.statusText}` }
      }
      console.error('[API] Trading engine returned error:', errorData);
      return NextResponse.json({ 
        success: false, 
        error: errorData.error || `Failed to start trading (${response.status}): ${response.statusText}` 
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