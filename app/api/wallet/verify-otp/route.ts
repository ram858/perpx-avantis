import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/AuthService'
import { OtpService } from '@/lib/services/OTPService'
import { TwilioService } from '@/lib/services/TwilioService'

export async function POST(request: NextRequest) {
  try {

    const { phoneNumber, otp } = await request.json()

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      )
    }

        // Verify OTP using database service
        const otpService = new OtpService()
        const otpResult = await otpService.verifyOtp(phoneNumber, otp)
        
        if (!otpResult.success) {
          return NextResponse.json(
            { error: otpResult.message },
            { status: 400 }
          )
        }

        // Mark OTP as verified after successful verification
        await otpService.markOtpAsVerified(phoneNumber, otp)

    // Create or get user
    const authService = new AuthService()
    let user = await authService.getUserByPhone(phoneNumber)
    
    if (!user) {
      user = await authService.createUser(phoneNumber)
      
      // Send welcome message
      try {
        const twilioService = new TwilioService()
        await twilioService.sendWelcomeMessage(phoneNumber)
      } catch (error) {
        console.error('Failed to send welcome message:', error)
      }
    } else {
      // Update last login
      await authService.updateLastLogin(user.id)
    }

    // Generate JWT token
    const token = await authService.generateJwtToken({
      userId: user.id,
      phoneNumber: user.phoneNumber
    })

    console.log(`🎉 Authentication successful for ${phoneNumber}`)

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        accessToken: token,
        user: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      }
    })

  } catch (error) {
    console.error('Error verifying OTP:', error)
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
