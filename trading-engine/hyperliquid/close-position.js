const { exec } = require('child_process');
const path = require('path');

async function closePosition(symbol, privateKey) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'close-position.ts');
    
    // Set environment variables for mainnet and use provided private key
    const env = {
      ...process.env,
      HYPERLIQUID_TESTNET: 'false',
      HYPERLIQUID_PK: privateKey
    };
    
    exec(`npx ts-node "${scriptPath}" "${symbol}"`, { env }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      if (stderr) {
        console.error('Stderr:', stderr);
      }
      
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (parseError) {
        resolve({ success: false, error: 'Failed to parse result' });
      }
    });
  });
}

module.exports = { closePosition };
