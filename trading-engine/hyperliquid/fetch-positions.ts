import { initBlockchain, getPositions, getTotalPnL, account } from './hyperliquid';

async function fetchData() {
  try {
    await initBlockchain();
    
    // Debug: Show wallet address
    console.error('Wallet address:', account?.address);
    
    const positions = await getPositions();
    const totalPnL = await getTotalPnL();
    
    // Debug: Show raw positions data
    console.error('Raw positions:', JSON.stringify(positions, null, 2));
    
    // Transform positions data for frontend
    const transformedPositions = positions.map(pos => {
      const coin = pos.coin || pos.position?.coin;
      const szi = pos.szi || pos.position?.szi;
      const size = Math.abs(parseFloat(szi || '0'));
      const entryPrice = parseFloat(pos.entryPx || pos.position?.entryPx || '0');
      const markPrice = parseFloat(pos.position?.markPrice || entryPrice); // Use entry price as fallback
      
      // Calculate PnL
      const side = pos.side || (parseFloat(szi || '0') > 0 ? 'long' : 'short');
      const pnl = size * (markPrice - entryPrice) * (side === 'long' ? 1 : -1);
      const positionValue = size * markPrice;
      const roe = entryPrice > 0 ? (pnl / (positionValue * 0.1)) * 100 : 0; // Assuming 10x leverage
      
      return {
        coin,
        size: size.toFixed(6),
        side,
        entryPrice,
        markPrice,
        pnl,
        roe,
        positionValue,
        margin: 'Cross', // Default margin type
        leverage: '10x' // Default leverage
      };
    });
    
    const result = {
      positions: transformedPositions,
      totalPnL: totalPnL,
      openPositions: transformedPositions.length
    };
    
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

fetchData();
