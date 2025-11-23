/**
 * Web OTP Verification API
 * Verifies OTP and creates/authenticates user with wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebAuthService } from '@/lib/services/WebAuthService';
import { WebWalletService } from '@/lib/services/WebWalletService';

const webAuthService = new WebAuthService();
const webWalletService = new WebWalletService();

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

    // Create or get web user by phone number
    const user = await webAuthService.createOrGetWebUserByPhone(phoneNumber);

    // Generate JWT token
    const token = await webAuthService.generateJwtToken(user);

    // Automatically create trading wallet for the user (if doesn't exist)
    let wallet;
    try {
      wallet = await webWalletService.ensureTradingWallet(user.id);
      if (!wallet) {
        throw new Error('Wallet creation returned null');
      }
      console.log(`[API] ✅ Trading wallet ready for web user ${user.id}: ${wallet.address}`);
    } catch (walletError) {
      console.error(`[API] ❌ Failed to create trading wallet for web user ${user.id}:`, walletError);
      // Return error - wallet creation is critical
      return NextResponse.json(
        {
          success: false,
          error: `Failed to create trading wallet: ${walletError instanceof Error ? walletError.message : 'Unknown error'}`,
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'OTP verification failed',
      },
      { status: 500 }
    );
  }
}

