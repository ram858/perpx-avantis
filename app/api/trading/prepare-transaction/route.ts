import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/AuthService';

// Lazy initialization - create services at runtime, not build time
function getAuthService(): AuthService {
  return new AuthService();
}

/**
 * Prepare transaction for Base Account signing
 * This endpoint proxies to the trading engine to prepare transaction data
 */
export async function POST(request: NextRequest) {
  try {
    const authService = getAuthService();
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await authService.verifyToken(token);
    
    if (!payload.fid) {
      return NextResponse.json(
        { error: 'Base Account (FID) required' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();
    
    // Get trading engine URL from environment
    const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001';
    
    // Remove /api/trading-engine suffix if present (it's added by nginx)
    const cleanUrl = tradingEngineUrl.replace(/\/api\/trading-engine\/?$/, '');
    
    // Proxy request to trading engine
    try {
      const response = await fetch(`${cleanUrl}/api/trading/prepare-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Forward auth token
        },
        body: JSON.stringify({
          ...body,
          userFid: payload.fid, // Include FID in request
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return NextResponse.json(
          { error: errorData.error || 'Failed to prepare transaction' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError) {
      console.error('[API] Error connecting to trading engine:', fetchError);
      return NextResponse.json(
        { 
          error: 'Trading engine unavailable',
          message: 'Unable to connect to trading engine. Please try again later.'
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('[API] Error preparing transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to prepare transaction',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

