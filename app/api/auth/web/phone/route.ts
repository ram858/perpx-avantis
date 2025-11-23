/**
 * Web Phone Authentication API
 * Sends OTP (for now, always returns success with default OTP 123456)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || phoneNumber.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // For now, we always return success with default OTP
    // In production, you would send actual OTP via SMS
    console.log(`[API] OTP requested for phone: ${phoneNumber}`);
    console.log(`[API] Default OTP: 123456`);

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      // In production, don't send OTP in response
      // For testing only:
      otp: '123456',
    });
  } catch (error) {
    console.error('[API] Phone auth error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP',
      },
      { status: 500 }
    );
  }
}

