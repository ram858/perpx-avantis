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
    
    // Verify token (supports both Farcaster and Web users)
    let authContext;
    try {
      authContext = await verifyTokenAndGetContext(token)
      console.log(`[API] Verified ${authContext.context} user:`, authContext.context === 'farcaster' ? `FID ${authContext.fid}` : `WebUserId ${authContext.webUserId}`)
    } catch (authError) {
      console.error('[API] Token verification failed:', authError)
      return NextResponse.json(
        { success: false, error: authError instanceof Error ? authError.message : 'Authentication failed' },
        { status: 401 }
      )
    }
    
    // Call the trading engine to get sessions
    const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001'
    
    try {
      const response = await fetch(`${tradingEngineUrl}/api/trading/sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Note: Trading engine doesn't require auth token, it's stateless
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData;
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` }
        }
        
        // If trading engine returns 404 (endpoint not found or no sessions), return empty array with 200
        // This is expected behavior - no sessions exist yet
        if (response.status === 404) {
          console.log(`[API] Trading engine returned 404 (no sessions or endpoint not found), returning empty array`)
          return NextResponse.json({
            success: true,
            sessions: []
          })
        }
        
        console.error(`[API] Trading engine error (${response.status}):`, errorData)
        // For other errors, return empty array with 200 status (graceful degradation)
        return NextResponse.json({ 
          success: true, 
          sessions: [] // Return empty array on error (graceful degradation)
        })
      }

      const result = await response.json()
      console.log(`[API] Trading engine returned ${result.sessions?.length || 0} sessions`)
      
      // Ensure we return the expected format
      return NextResponse.json({
        success: true,
        sessions: result.sessions || []
      })
    } catch (fetchError) {
      console.error('[API] Error calling trading engine:', fetchError)
      // If trading engine is down or unreachable, return empty sessions (graceful degradation)
      // This prevents frontend errors when trading engine is not available
      return NextResponse.json({
        success: true,
        sessions: []
      })
    }
  } catch (error) {
    console.error('[API] Unexpected error fetching trading sessions:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch trading sessions',
        sessions: [] // Return empty array on error
      },
      { status: 500 }
    )
  }
}