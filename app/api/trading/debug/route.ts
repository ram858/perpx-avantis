import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory log storage (for debugging only)
// In production, you'd want to use a proper logging service
const recentLogs: Array<{
  timestamp: Date
  requestId: string
  message: string
  data?: any
}> = []

export function addLog(requestId: string, message: string, data?: any) {
  recentLogs.push({
    timestamp: new Date(),
    requestId,
    message,
    data
  })
  // Keep only last 50 logs
  if (recentLogs.length > 50) {
    recentLogs.shift()
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get last N logs (default 20)
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')
    const filtered = recentLogs.slice(-limit)
    
    return NextResponse.json({
      success: true,
      logs: filtered,
      total: recentLogs.length
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

