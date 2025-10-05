import { NextRequest, NextResponse } from 'next/server'
import { OtpService } from '@/lib/services/OTPService'
import { TwilioService } from '@/lib/services/TwilioService'

export async function POST(request: NextRequest) {
  try {

    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Send OTP using the database service
    const otpService = new OtpService()
    const result = await otpService.sendOtp(phoneNumber)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    // Try to send via Twilio if configured
    try {
      const twilioService = new TwilioService()
      await twilioService.sendOTP(phoneNumber, result.otp!)
    } catch (error) {
      console.error('Twilio error:', error)
      // Continue anyway - OTP is already logged to console
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      // In development, include OTP in response
      ...(process.env.NODE_ENV === 'development' && { otp: result.otp })
    })

  } catch (error) {
    console.error('Error sending OTP:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
