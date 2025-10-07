const { exec } = require('child_process');
const path = require('path');

async function fetchPositions(privateKey) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'fetch-positions.ts');
    
    // Set environment variables and use provided private key
    // Respect HYPERLIQUID_TESTNET from environment (defaults to testnet if not set)
    const env = {
      ...process.env,
      HYPERLIQUID_PK: privateKey
    };
    
    exec(`npx ts-node "${scriptPath}"`, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to fetch positions: ${error.message}`));
        return;
      }
      
      if (stderr) {
        console.error('Stderr:', stderr);
      }
      
      try {
        const data = JSON.parse(stdout.trim());
        resolve(data);
      } catch (parseError) {
        reject(new Error(`Failed to parse positions data: ${parseError.message}`));
      }
    });
  });
}

module.exports = { fetchPositions };
