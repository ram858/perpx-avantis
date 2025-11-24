import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenAndGetContext } from '@/lib/utils/authHelper'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const authContext = await verifyTokenAndGetContext(token)
    
    // Call the trading engine to get sessions
    const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001'
    const response = await fetch(`${tradingEngineUrl}/api/trading/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json({ 
        success: false, 
        error: errorData.error || 'Failed to fetch trading sessions' 
      }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching trading sessions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trading sessions' },
      { status: 500 }
    )
  }
}