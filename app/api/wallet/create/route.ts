import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { ethers } from 'ethers'

// In-memory storage for users (in production, use database)
const userStorage = new Map<string, {
  id: string
  phoneNumber: string
  createdAt: Date
  walletAddress?: string
  walletPrivateKey?: string
}>()

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { phoneNumber: string; userId: string }

    const { userId, phoneNumber } = await request.json()

    if (!userId || !phoneNumber) {
      return NextResponse.json(
        { error: 'User ID and phone number are required' },
        { status: 400 }
      )
    }

    // Verify the user exists and matches the token
    const user = userStorage.get(phoneNumber)
    if (!user || user.id !== userId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user already has a wallet
    if (user.walletAddress) {
      return NextResponse.json({
        success: true,
        message: 'Wallet already exists',
        walletAddress: user.walletAddress,
        hasWallet: true
      })
    }

    // Generate a new wallet
    const wallet = ethers.Wallet.createRandom()
    const walletAddress = wallet.address
    const walletPrivateKey = wallet.privateKey

    // Update user with wallet information
    user.walletAddress = walletAddress
    user.walletPrivateKey = walletPrivateKey
    userStorage.set(phoneNumber, user)

    // In production, you would:
    // 1. Store the wallet securely in a database
    // 2. Encrypt the private key
    // 3. Set up proper key management
    // 4. Initialize the wallet with some testnet funds

    return NextResponse.json({
      success: true,
      message: 'Wallet created successfully',
      walletAddress,
      hasWallet: true
    })

  } catch (error) {
    console.error('Error creating wallet:', error)
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create wallet' },
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
