import { initBlockchain, getPositions, closePosition, fetchPrice } from './hyperliquid';

async function closePos(symbol) {
  try {
    await initBlockchain();
    const positions = await getPositions();
    const position = positions.find(p => p.coin === symbol || p.position?.coin === symbol);
    
    if (!position) {
      throw new Error('Position not found');
    }
    
    const price = await fetchPrice(symbol);
    if (!price || price <= 0) {
      throw new Error('Invalid price');
    }
    
    await closePosition(symbol, position, 'manual_close', price);
    console.log(JSON.stringify({ success: true }));
  } catch (err) {
    console.error(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
    process.exit(1);
  }
}

const symbol = process.argv[2];
if (!symbol) {
  console.error(JSON.stringify({ success: false, error: 'Symbol required' }));
  process.exit(1);
}

closePos(symbol);
