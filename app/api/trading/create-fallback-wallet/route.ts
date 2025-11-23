import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/AuthService';
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService';

// Lazy initialization - create services at runtime, not build time
function getAuthService(): AuthService {
  return new AuthService();
}

function getWalletService(): BaseAccountWalletService {
  return new BaseAccountWalletService();
}

/**
 * Create a fallback trading wallet for automated strategies
 * This is used when Base Account users want automated trading
 */
export async function POST(request: NextRequest) {
  try {
    const authService = getAuthService();
    const walletService = getWalletService();
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

    // Create a traditional trading wallet (with private key) for automated trading
    const tradingWallet = await walletService.createTradingWallet(payload.fid, 'ethereum');

    if (!tradingWallet || !tradingWallet.privateKey) {
      return NextResponse.json(
        { error: 'Failed to create trading wallet' },
        { status: 500 }
      );
    }

    console.log(`[API] Created fallback trading wallet for FID ${payload.fid}: ${tradingWallet.address}`);

    // Return wallet address (not private key for security)
    return NextResponse.json({
      success: true,
      walletAddress: tradingWallet.address,
      message: 'Fallback trading wallet created successfully. You can now use automated trading strategies.',
      note: 'This wallet will be used for automated trading. Your Base Account will still be used for manual transactions.',
    });
  } catch (error) {
    console.error('[API] Error creating fallback wallet:', error);
    return NextResponse.json(
      {
        error: 'Failed to create fallback wallet',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * Check if user has a fallback trading wallet
 */
export async function GET(request: NextRequest) {
  try {
    const authService = getAuthService();
    const walletService = getWalletService();
    
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

    // Check if user has a trading wallet (with private key)
    const wallet = await walletService.getWalletWithKey(payload.fid, 'ethereum');

    return NextResponse.json({
      hasFallbackWallet: !!(wallet && wallet.privateKey && wallet.privateKey.length > 0),
      walletAddress: wallet?.address || null,
    });
  } catch (error) {
    console.error('[API] Error checking fallback wallet:', error);
    return NextResponse.json(
      {
        error: 'Failed to check fallback wallet',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

