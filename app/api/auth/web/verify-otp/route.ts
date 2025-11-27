/**
 * Web OTP Verification API
 * Verifies OTP and creates/authenticates user with wallet
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

// Default OTP for testing
const DEFAULT_OTP = '123456';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json();

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { success: false, error: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    // Verify OTP (for now, accept default OTP 123456)
    if (otp !== DEFAULT_OTP) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP. Use 123456 for testing.' },
        { status: 401 }
      );
    }

    console.log(`[API] Starting OTP verification for phone: ${phoneNumber}`);

    let authService: WebAuthService;
    let walletService: WebWalletService;
    
    try {
      authService = getWebAuthService();
      walletService = getWebWalletService();
      console.log('[API] Services initialized successfully');
    } catch (serviceError) {
      console.error('[API] Failed to initialize services:', serviceError);
      return NextResponse.json(
        {
          success: false,
          error: `Service initialization failed: ${serviceError instanceof Error ? serviceError.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    // Create or get web user by phone number
    let user;
    try {
      console.log('[API] Creating/getting web user by phone number...');
      user = await authService.createOrGetWebUserByPhone(phoneNumber);
      console.log(`[API] ✅ User created/retrieved: ID ${user.id}`);
    } catch (userError) {
      console.error('[API] ❌ Failed to create/get web user:', userError);
      const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
      // Check if it's a database connection error
      if (errorMessage.includes('fetch failed') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database connection failed. Please check your Supabase configuration.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: `Failed to create web user: ${errorMessage}`,
        },
        { status: 500 }
      );
    }

    // Generate JWT token
    let token: string;
    try {
      console.log('[API] Generating JWT token...');
      token = await authService.generateJwtToken(user);
      console.log('[API] ✅ JWT token generated');
    } catch (tokenError) {
      console.error('[API] ❌ Failed to generate JWT token:', tokenError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to generate token: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    // Automatically create trading wallet for the user (if doesn't exist)
    let wallet;
    try {
      console.log(`[API] Ensuring trading wallet exists for user ${user.id}...`);
      wallet = await walletService.ensureTradingWallet(user.id);
      if (!wallet) {
        throw new Error('Wallet creation returned null');
      }
      console.log(`[API] ✅ Trading wallet ready for web user ${user.id}: ${wallet.address}`);
    } catch (walletError) {
      console.error(`[API] ❌ Failed to create trading wallet for web user ${user.id}:`, walletError);
      const errorMessage = walletError instanceof Error ? walletError.message : 'Unknown error';
      // Check if it's a database connection error
      if (errorMessage.includes('fetch failed') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database connection failed while creating wallet. Please check your Supabase configuration.',
          },
          { status: 500 }
        );
      }
      // Return error - wallet creation is critical
      return NextResponse.json(
        {
          success: false,
          error: `Failed to create trading wallet: ${errorMessage}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone_number: user.phone_number,
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
    console.error('[API] OTP verification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'OTP verification failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[API] Error stack:', errorStack);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

