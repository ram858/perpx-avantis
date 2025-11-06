import { NextRequest, NextResponse } from 'next/server'
import { BaseAccountWalletService } from '@/lib/services/BaseAccountWalletService'
import { AuthService } from '@/lib/services/AuthService'
import { AvantisClient } from '@/lib/services/AvantisClient'

const walletService = new BaseAccountWalletService()
const authService = new AuthService()

export async function GET(request: NextRequest) {
  try {
    console.log('[API] Positions endpoint called')
    
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await authService.verifyToken(token)
    
    // FID is required for Base Account users
    if (!payload.fid) {
      return NextResponse.json({
        positions: [],
        totalPnL: 0,
        openPositions: 0,
        error: 'Base Account (FID) required'
      })
    }
    
    // Get user's wallet using FID
    // For Base Accounts, we may only have an address (no private key)
    const wallet = await walletService.getWalletWithKey(payload.fid, 'ethereum')
    
    if (!wallet || !wallet.address) {
      return NextResponse.json({
        positions: [],
        totalPnL: 0,
        openPositions: 0,
        error: 'No trading wallet found'
      })
    }
    
    // Check if this is a Base Account (no private key)
    const isBaseAccount = !wallet.privateKey || wallet.privateKey.length === 0;
    
    console.log('[API] Getting positions for FID:', payload.fid)
    console.log('[API] Using wallet address:', wallet.address)

    // Try to get positions from trading engine first
    const tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001'
    
    try {
      console.log(`[API] Attempting to fetch positions from trading engine: ${tradingEngineUrl}/api/positions`)
      // For Base Accounts, pass address and isBaseAccount flag
      const queryParams = isBaseAccount 
        ? `?address=${wallet.address}&isBaseAccount=true`
        : '';
      const tradingResponse = await fetch(`${tradingEngineUrl}/api/positions${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      console.log(`[API] Trading engine response status: ${tradingResponse.status}`)
      
      if (tradingResponse.ok) {
        const tradingData = await tradingResponse.json()
        console.log(`[API] Trading engine returned data:`, tradingData)
        return NextResponse.json({
          positions: tradingData.positions || [],
          totalPnL: tradingData.totalPnL || 0,
          openPositions: tradingData.openPositions || 0
        })
      } else {
        console.log(`[API] Trading engine returned error status: ${tradingResponse.status}`)
      }
    } catch (tradingError) {
      console.error('[API] Trading engine positions not available:', tradingError)
    }

    // Fallback: Fetch positions directly from Avantis
    try {
      const avantisApiUrl = process.env.AVANTIS_API_URL || 'http://localhost:8000'
      
      if (isBaseAccount && wallet.address) {
        // For Base Accounts, try to query by address
        try {
          const { getAvantisBalanceByAddress } = await import('@/lib/wallet/avantisBalance');
          const balanceData = await getAvantisBalanceByAddress(wallet.address);
          
          const formattedPositions = balanceData.positions.map(pos => ({
            coin: pos.symbol,
            pair_index: pos.pair_index,
            size: Math.abs(pos.size).toString(),
            side: pos.is_long ? 'long' : 'short',
            entryPrice: pos.entryPrice,
            markPrice: pos.currentPrice,
            pnl: pos.pnl,
            roe: pos.entryPrice > 0 ? (pos.pnl / (Math.abs(pos.size) * pos.entryPrice)) * 100 : 0,
            positionValue: Math.abs(pos.size) * pos.currentPrice,
            margin: (Math.abs(pos.size) / pos.leverage).toString(),
            leverage: pos.leverage.toString()
          }));

          return NextResponse.json({
            positions: formattedPositions,
            totalPnL: balanceData.positions.reduce((sum, pos) => sum + pos.pnl, 0),
            openPositions: balanceData.positions.length
          });
        } catch (addressError) {
          console.error('[API] Failed to query by address, trying with private key:', addressError);
          // Fall through to try with private key if available
        }
      }
      
      // For traditional wallets or if address query failed
      if (wallet.privateKey) {
        const avantisClient = new AvantisClient({ 
          baseUrl: avantisApiUrl,
          privateKey: wallet.privateKey 
        })
        
        const positions = await avantisClient.getPositions()
        const balance = await avantisClient.getBalance()
      
      // Convert Avantis positions to our format
      const formattedPositions = positions.map(pos => ({
        coin: pos.symbol,
        pair_index: pos.pair_index,
        size: (pos.collateral * pos.leverage).toString(),
        side: pos.is_long ? 'long' : 'short',
        entryPrice: pos.entry_price,
        markPrice: pos.current_price,
        pnl: pos.pnl,
        roe: pos.entry_price > 0 ? (pos.pnl / (pos.collateral * pos.leverage)) * 100 : 0,
        positionValue: pos.collateral * pos.leverage,
        margin: pos.collateral.toString(),
        leverage: pos.leverage.toString()
      }))

      return NextResponse.json({
        positions: formattedPositions,
        totalPnL: balance.total_collateral || 0,
        openPositions: positions.length
      })
    } catch (avantisError) {
      console.error('[API] Avantis fallback failed:', avantisError)
      // Return empty positions if Avantis is not available
      return NextResponse.json({
        positions: [],
        totalPnL: 0,
        openPositions: 0,
        error: 'Trading engine and Avantis not available'
      })
    }

  } catch (error) {
    console.error('Error fetching positions:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch positions',
        positions: [],
        totalPnL: 0,
        openPositions: 0
      },
      { status: 500 }
    )
  }
}
