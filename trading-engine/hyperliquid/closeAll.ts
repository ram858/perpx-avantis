import dotenv from 'dotenv';
dotenv.config();

import { initBlockchain, closeAllPositions } from './hyperliquid';

async function main() {
  try {
    console.log('🔧 [DEBUG] Starting closeAll script...');
    
    // Ensure key is present
    const key = process.env.HYPERLIQUID_PK;
    console.log(`🔧 [DEBUG] HYPERLIQUID_PK present: ${key ? 'YES' : 'NO'}`);
    console.log(`🔧 [DEBUG] Key starts with 0x: ${key?.startsWith('0x') ? 'YES' : 'NO'}`);
    console.log(`🔧 [DEBUG] Key length: ${key?.length || 0}`);
    
    if (!key || !key.startsWith('0x') || key.length !== 66) {
      console.error('❌ HYPERLIQUID_PK missing or invalid. Aborting close-all.');
      console.error(`   Key: ${key ? key.substring(0, 10) + '...' : 'undefined'}`);
      process.exit(1);
      return;
    }

    console.log('🔧 [DEBUG] Initializing blockchain connection...');
    await initBlockchain();
    console.log('🔧 [DEBUG] Blockchain initialized, calling closeAllPositions...');
    
    await closeAllPositions();
    console.log('✅ closeAll: Completed closing all positions');
    process.exit(0);
  } catch (err) {
    console.error('❌ closeAll: Failed to close all positions:', err);
    console.error('❌ Error details:', err);
    process.exit(1);
  }
}

main();


