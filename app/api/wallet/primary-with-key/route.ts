import { NextRequest, NextResponse } from 'next/server'
import { UserWalletService } from '@/lib/services/UserWalletService'
import { AuthService } from '@/lib/services/AuthService'

const userWalletService = new UserWalletService()
const authService = new AuthService()

// GET /api/wallet/primary-with-key - Get user's primary trading wallet with private key
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)
    
    const wallet = await userWalletService.getPrimaryTradingWalletWithKey(payload.phoneNumber)
    
    return NextResponse.json({ wallet })
  } catch (error) {
    console.error('Error fetching primary wallet with key:', error)
    return NextResponse.json(
      { error: 'Failed to fetch primary wallet with key' },
      { status: 500 }
    )
  }
}
