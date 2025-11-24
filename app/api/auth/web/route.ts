/**
 * Web Authentication API Endpoint
 * 
 * Creates or authenticates web users and automatically creates trading wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebAuthService } from '@/lib/services/WebAuthService';
import { WebWalletService } from '@/lib/services/WebWalletService';

// Lazy-load services to avoid requiring JWT_SECRET at build time
let webAuthService: WebAuthService | null = null;
let webWalletService: WebWalletService | null = null;

function getWebAuthService(): WebAuthService {
  if (!webAuthService) {
    webAuthService = new WebAuthService();
  }
  return webAuthService;
}

function getWebWalletService(): WebWalletService {
  if (!webWalletService) {
    webWalletService = new WebWalletService();
  }
  return webWalletService;
}

/**
 * POST /api/auth/web - Create or authenticate web user
 * 
 * Body (optional):
 * - email?: string
 * - username?: string
 * 
 * Returns:
 * - user: WebUser
 * - token: JWT token
 * - wallet: Trading wallet (automatically created)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, username } = body;

    const authService = getWebAuthService();
    const walletService = getWebWalletService();

    // Create or get web user
    const user = await authService.createOrGetWebUser({
      email,
      username,
    });

    // Generate JWT token
    const token = await authService.generateJwtToken(user);

    // Automatically create trading wallet for the user
    let wallet;
    try {
      wallet = await walletService.ensureTradingWallet(user.id);
      console.log(`[API] Auto-created trading wallet for web user ${user.id}: ${wallet.address}`);
    } catch (walletError) {
      console.error(`[API] Failed to create trading wallet for web user ${user.id}:`, walletError);
      // Continue without wallet - user can create it later
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        created_at: user.created_at,
      },
      token,
      wallet: wallet ? {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        wallet_type: wallet.wallet_type,
      } : null,
    });
  } catch (error) {
    console.error('[API] Web auth error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/web - Get current web user (requires auth token)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authService = getWebAuthService();
    const walletService = getWebWalletService();

    const token = authHeader.substring(7);
    const payload = await authService.verifyToken(token);

    // Get user details
    const user = await authService.getWebUserById(payload.webUserId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get wallet
    const wallet = await walletService.getWallet(payload.webUserId, 'ethereum');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        created_at: user.created_at,
      },
      wallet: wallet ? {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        wallet_type: wallet.wallet_type,
      } : null,
    });
  } catch (error) {
    console.error('[API] Web auth get error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user',
      },
      { status: 401 }
    );
  }
}

