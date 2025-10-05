import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { OTPService } from '@/lib/services/OTPService'

// In-memory storage for users (in production, use database)
const userStorage = new Map<string, {
  id: string
  phoneNumber: string
  createdAt: Date
  walletAddress?: string
}>()

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json()

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      )
    }

    // Verify OTP using shared service
    const otpService = new OTPService()
    const result = await otpService.verifyOtp(phoneNumber, otp)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    // Check if user exists
    let user = userStorage.get(phoneNumber)
    
    if (!user) {
      // Create new user
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      user = {
        id: userId,
        phoneNumber,
        createdAt: new Date(),
        walletAddress: undefined // Will be created after authentication
      }
      userStorage.set(phoneNumber, user)
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { 
        expiresIn: '7d',
        issuer: 'prepx',
        audience: 'prepx-users'
      }
    )

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        hasWallet: !!user.walletAddress,
        createdAt: user.createdAt
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

// Helper function to get user by phone number
export function getUserByPhone(phoneNumber: string) {
  return userStorage.get(phoneNumber)
}

// Helper function to update user wallet
export function updateUserWallet(phoneNumber: string, walletAddress: string) {
  const user = userStorage.get(phoneNumber)
  if (user) {
    user.walletAddress = walletAddress
    userStorage.set(phoneNumber, user)
  }
}
