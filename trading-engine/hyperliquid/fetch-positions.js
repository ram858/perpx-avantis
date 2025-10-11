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
        // Find the last line that looks like JSON (starts with {)
        const lines = stdout.trim().split('\n');
        const jsonLine = lines.find(line => line.trim().startsWith('{'));
        
        if (!jsonLine) {
          throw new Error('No valid JSON found in output');
        }
        
        const data = JSON.parse(jsonLine);
        resolve(data);
      } catch (parseError) {
        console.error('Failed to parse positions data. Raw stdout:', stdout);
        reject(new Error(`Failed to parse positions data: ${parseError.message}`));
      }
    });
  });
}

module.exports = { fetchPositions };
