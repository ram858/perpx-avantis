import dotenv from 'dotenv';
dotenv.config();

import { initBlockchain, closeAllPositions } from './hyperliquid';

async function main() {
  try {
    // Ensure key is present
    const key = process.env.HYPERLIQUID_PK;
    if (!key || !key.startsWith('0x') || key.length !== 66) {
      console.error('HYPERLIQUID_PK missing or invalid. Aborting close-all.');
      process.exit(1);
      return;
    }

    await initBlockchain();
    await closeAllPositions();
    console.log('✅ closeAll: Completed closing all positions');
    process.exit(0);
  } catch (err) {
    console.error('❌ closeAll: Failed to close all positions:', err);
    process.exit(1);
  }
}

main();


