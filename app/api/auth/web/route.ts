/**
 * Web Authentication API Endpoint
 * 
 * Creates or authenticates web users and automatically creates trading wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebAuthService } from '@/lib/services/WebAuthService';
import { WebWalletService } from '@/lib/services/WebWalletService';

const webAuthService = new WebAuthService();
const webWalletService = new WebWalletService();

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

    // Create or get web user
    const user = await webAuthService.createOrGetWebUser({
      email,
      username,
    });

    // Generate JWT token
    const token = await webAuthService.generateJwtToken(user);

    // Automatically create trading wallet for the user
    let wallet;
    try {
      wallet = await webWalletService.ensureTradingWallet(user.id);
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

    const token = authHeader.substring(7);
    const payload = await webAuthService.verifyToken(token);

    // Get user details
    const user = await webAuthService.getWebUserById(payload.webUserId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get wallet
    const wallet = await webWalletService.getWallet(payload.webUserId, 'ethereum');

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

