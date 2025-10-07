import { NextRequest, NextResponse } from 'next/server'
import { UserWalletService } from '@/lib/services/UserWalletService'
import { AuthService } from '@/lib/services/AuthService'

const userWalletService = new UserWalletService()
const authService = new AuthService()

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)

    console.log(`[DEBUG] Getting wallet for phone: ${payload.phoneNumber}`)
    
    // Test wallet retrieval
    const wallet = await userWalletService.getPrimaryTradingWalletWithKey(payload.phoneNumber)
    
    if (wallet) {
      return NextResponse.json({
        success: true,
        wallet: {
          id: wallet.id,
          address: wallet.address,
          chain: wallet.chain,
          hasPrivateKey: !!wallet.privateKey,
          createdAt: wallet.createdAt
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'No wallet found'
      })
    }

  } catch (error) {
    console.error('Debug wallet test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
