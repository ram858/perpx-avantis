import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Close all positions endpoint called')

    // TEMPORARY: Skip authentication for testing
    // TODO: Re-enable authentication once basic functionality is working

    // Call the trading engine to close all positions
    const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001'
    
    console.log(`[API] Calling trading engine to close all positions: ${tradingEngineUrl}/api/close-all-positions`)
    
    const response = await fetch(`${tradingEngineUrl}/api/close-all-positions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json()
      } catch (parseError) {
        const textResponse = await response.text()
        console.error('[API] Non-JSON response from trading engine:', textResponse.substring(0, 200))
        errorData = { error: `Trading engine error: ${response.status} ${response.statusText}` }
      }
      return NextResponse.json({
        success: false,
        error: errorData.error || 'Failed to close all positions'
      }, { status: response.status })
    }

    const result = await response.json()
    console.log('[API] Trading engine response:', result)
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('[API] Error closing all positions:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close all positions'
      },
      { status: 500 }
    )
  }
}
