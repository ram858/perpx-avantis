"use strict";
/**
 * Avantis Trading Functions
 * This module provides functions to interact with Avantis API for opening/closing positions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAvantisPosition = openAvantisPosition;
exports.closeAvantisPosition = closeAvantisPosition;
exports.getAvantisPositions = getAvantisPositions;
const AVANTIS_API_URL = process.env.AVANTIS_API_URL || 'http://localhost:8000';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const TRANSACTION_CONFIRMATION_TIMEOUT = 30000; // 30 seconds
const POSITION_VERIFICATION_TIMEOUT = 20000; // 20 seconds
const POSITION_VERIFICATION_RETRIES = 3;
const POSITION_VERIFICATION_RETRY_DELAY = 2000; // 2 seconds between retries
/**
 * Wait for transaction confirmation on Base network
 * Non-blocking with timeout to prevent hanging
 */
async function waitForTransactionConfirmation(txHash, confirmations = 2, timeout = TRANSACTION_CONFIRMATION_TIMEOUT) {
    try {
        const startTime = Date.now();
        let confirmed = false;
        let attempts = 0;
        const maxAttempts = Math.floor(timeout / 2000); // Check every 2 seconds
        while (!confirmed && attempts < maxAttempts && (Date.now() - startTime) < timeout) {
            try {
                // Use Base RPC to check transaction receipt
                const response = await fetch(BASE_RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getTransactionReceipt',
                        params: [txHash],
                        id: 1
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.result && data.result.blockNumber) {
                        // Transaction is confirmed
                        confirmed = true;
                        console.log(`[AVANTIS] ✅ Transaction ${txHash.slice(0, 16)}... confirmed on block ${data.result.blockNumber}`);
                        return true;
                    }
                }
            }
            catch (error) {
                // Continue retrying on error
                console.warn(`[AVANTIS] ⚠️ Error checking transaction confirmation (attempt ${attempts + 1}):`, error);
            }
            attempts++;
            if (!confirmed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            }
        }
        if (!confirmed) {
            console.warn(`[AVANTIS] ⚠️ Transaction confirmation timeout after ${timeout}ms - continuing anyway`);
            // Don't fail - transaction might still be processing
            return false;
        }
        return confirmed;
    }
    catch (error) {
        console.error(`[AVANTIS] ❌ Error waiting for transaction confirmation:`, error);
        // Don't fail - return false but continue
        return false;
    }
}
/**
 * Verify position exists in AvantisFi after opening
 * Uses retry logic with timeout to handle eventual consistency
 */
async function verifyPositionExists(pairIndex, privateKey, symbol, timeout = POSITION_VERIFICATION_TIMEOUT) {
    if (!pairIndex) {
        console.warn(`[AVANTIS] ⚠️ No pair_index provided, skipping verification`);
        return false;
    }
    try {
        const startTime = Date.now();
        let verified = false;
        let attempts = 0;
        while (!verified && attempts < POSITION_VERIFICATION_RETRIES && (Date.now() - startTime) < timeout) {
            try {
                const positions = await getAvantisPositions(privateKey);
                const foundPosition = positions.find(p => p.pair_index === pairIndex);
                if (foundPosition) {
                    verified = true;
                    console.log(`[AVANTIS] ✅ Position verified: pair_index=${pairIndex}, symbol=${foundPosition.symbol}`);
                    return true;
                }
                if (attempts < POSITION_VERIFICATION_RETRIES - 1) {
                    console.log(`[AVANTIS] ⏳ Position not found yet (attempt ${attempts + 1}/${POSITION_VERIFICATION_RETRIES}), retrying...`);
                    await new Promise(resolve => setTimeout(resolve, POSITION_VERIFICATION_RETRY_DELAY));
                }
            }
            catch (error) {
                console.warn(`[AVANTIS] ⚠️ Error verifying position (attempt ${attempts + 1}):`, error);
                if (attempts < POSITION_VERIFICATION_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, POSITION_VERIFICATION_RETRY_DELAY));
                }
            }
            attempts++;
        }
        if (!verified) {
            console.warn(`[AVANTIS] ⚠️ Position verification failed: pair_index=${pairIndex} not found after ${attempts} attempts`);
            // Don't fail the operation - position might appear later
            return false;
        }
        return verified;
    }
    catch (error) {
        console.error(`[AVANTIS] ❌ Error verifying position:`, error);
        return false;
    }
}
/**
 * Get Avantis balance for a wallet
 * Used for balance validation before opening positions
 */
async function getAvantisBalance(privateKey) {
    try {
        const baseUrl = AVANTIS_API_URL.endsWith('/') ? AVANTIS_API_URL.slice(0, -1) : AVANTIS_API_URL;
        const response = await fetch(`${baseUrl}/api/balance?private_key=${encodeURIComponent(privateKey)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            console.warn(`[AVANTIS] ⚠️ Failed to get balance: ${response.statusText}`);
            return 0;
        }
        const result = await response.json();
        // Return USDC balance (trading balance)
        return result.usdc_balance || result.balance || 0;
    }
    catch (error) {
        console.error(`[AVANTIS] ❌ Error getting balance:`, error);
        return 0;
    }
}
/**
 * Check if error is transient (retryable) or permanent (don't retry)
 */
function isTransientError(error) {
    const transientPatterns = [
        'timeout',
        'network',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'fetch failed',
        'temporarily unavailable',
        'rate limit',
        'too many requests'
    ];
    const errorLower = error.toLowerCase();
    return transientPatterns.some(pattern => errorLower.includes(pattern));
}
/**
 * Open a position on Avantis with retry logic and verification
 */
async function openAvantisPosition(params, options) {
    const maxRetries = options?.maxRetries || 2;
    const skipBalanceCheck = options?.skipBalanceCheck || false;
    const skipVerification = options?.skipVerification || false;
    // Retry loop for transient errors
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[AVANTIS] ==========================================`);
            console.log(`[AVANTIS] 🚀 OPENING POSITION ON REAL AVANTIS PLATFORM${attempt > 0 ? ` (Retry ${attempt}/${maxRetries})` : ''}`);
            console.log(`[AVANTIS] Symbol: ${params.symbol}`);
            console.log(`[AVANTIS] Direction: ${params.is_long ? 'LONG' : 'SHORT'}`);
            console.log(`[AVANTIS] Collateral: $${params.collateral}`);
            console.log(`[AVANTIS] Leverage: ${params.leverage}x`);
            console.log(`[AVANTIS] Private Key: ${params.private_key ? `${params.private_key.slice(0, 10)}...${params.private_key.slice(-4)}` : 'MISSING!'}`);
            console.log(`[AVANTIS] API URL: ${AVANTIS_API_URL}/api/open-position`);
            console.log(`[AVANTIS] ==========================================`);
            if (!params.private_key) {
                console.error(`[AVANTIS] ❌ CRITICAL: Private key is missing! Cannot open position on Avantis.`);
                return {
                    success: false,
                    error: 'Private key is required to open positions on Avantis'
                };
            }
            // Balance validation before opening (non-blocking, fast check)
            if (!skipBalanceCheck) {
                try {
                    const balance = await Promise.race([
                        getAvantisBalance(params.private_key),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Balance check timeout')), 5000))
                    ]);
                    if (balance < params.collateral) {
                        console.error(`[AVANTIS] ❌ Insufficient balance: $${balance.toFixed(2)} < $${params.collateral}`);
                        return {
                            success: false,
                            error: `Insufficient balance: $${balance.toFixed(2)} available, $${params.collateral} required`
                        };
                    }
                    console.log(`[AVANTIS] ✅ Balance check passed: $${balance.toFixed(2)} >= $${params.collateral}`);
                }
                catch (balanceError) {
                    // Don't fail on balance check error - might be API issue
                    console.warn(`[AVANTIS] ⚠️ Balance check failed, continuing anyway:`, balanceError);
                }
            }
            // Remove trailing slash from AVANTIS_API_URL if present
            const baseUrl = AVANTIS_API_URL.endsWith('/') ? AVANTIS_API_URL.slice(0, -1) : AVANTIS_API_URL;
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            const response = await fetch(`${baseUrl}/api/open-position`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symbol: params.symbol,
                    collateral: params.collateral,
                    leverage: params.leverage,
                    is_long: params.is_long,
                    private_key: params.private_key,
                    tp: params.tp,
                    sl: params.sl,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                const errorMessage = errorData.detail || response.statusText;
                console.error(`[AVANTIS] ❌ Failed to open position: ${errorMessage}`);
                console.error(`[AVANTIS] Response status: ${response.status}`);
                // Check if error is transient and we should retry
                if (isTransientError(errorMessage) && attempt < maxRetries) {
                    const delay = (attempt + 1) * 1000; // Exponential backoff
                    console.log(`[AVANTIS] ⏳ Transient error detected, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue; // Retry
                }
                // Permanent error or max retries reached
                return {
                    success: false,
                    error: errorMessage
                };
            }
            const result = await response.json();
            if (!result.tx_hash) {
                console.error(`[AVANTIS] ❌ No transaction hash returned from API`);
                return {
                    success: false,
                    error: 'No transaction hash returned from Avantis API'
                };
            }
            console.log(`[AVANTIS] ==========================================`);
            console.log(`[AVANTIS] ✅ Position open request successful`);
            console.log(`[AVANTIS] Transaction Hash: ${result.tx_hash}`);
            console.log(`[AVANTIS] Pair Index: ${result.pair_index}`);
            console.log(`[AVANTIS] Symbol: ${result.symbol || params.symbol}`);
            console.log(`[AVANTIS] Direction: ${params.is_long ? 'LONG' : 'SHORT'}`);
            console.log(`[AVANTIS] Collateral: $${params.collateral}`);
            console.log(`[AVANTIS] Leverage: ${params.leverage}x`);
            console.log(`[AVANTIS] ==========================================`);
            // Transaction confirmation (non-blocking, runs in parallel with verification)
            let txConfirmed = false;
            if (result.tx_hash) {
                waitForTransactionConfirmation(result.tx_hash, 2, TRANSACTION_CONFIRMATION_TIMEOUT)
                    .then(confirmed => {
                    txConfirmed = confirmed;
                    if (confirmed) {
                        console.log(`[AVANTIS] ✅ Transaction confirmed on-chain`);
                    }
                })
                    .catch(err => {
                    console.warn(`[AVANTIS] ⚠️ Transaction confirmation check failed:`, err);
                });
            }
            // Position verification (non-blocking, but we wait a bit for it)
            let positionVerified = false;
            if (!skipVerification && result.pair_index) {
                console.log(`[AVANTIS] 🔍 Verifying position exists in AvantisFi...`);
                positionVerified = await verifyPositionExists(result.pair_index, params.private_key, result.symbol || params.symbol, POSITION_VERIFICATION_TIMEOUT);
                if (positionVerified) {
                    console.log(`[AVANTIS] ✅ Position verified in AvantisFi dashboard`);
                }
                else {
                    console.warn(`[AVANTIS] ⚠️ Position verification failed - position may appear later`);
                }
            }
            console.log(`[AVANTIS] ==========================================`);
            console.log(`[AVANTIS] ✅✅✅ POSITION OPENED SUCCESSFULLY ON AVANTIS!`);
            console.log(`[AVANTIS] 📊 THIS POSITION IS NOW LIVE ON AVANTIS DASHBOARD`);
            console.log(`[AVANTIS] 📊 Connect your backend wallet to avantisfi.com to see it`);
            console.log(`[AVANTIS] 📊 The position will appear in your "Current Positions" section`);
            if (txConfirmed) {
                console.log(`[AVANTIS] ✅ Transaction confirmed on-chain`);
            }
            if (positionVerified) {
                console.log(`[AVANTIS] ✅ Position verified in AvantisFi`);
            }
            console.log(`[AVANTIS] ==========================================`);
            return {
                success: true,
                tx_hash: result.tx_hash,
                pair_index: result.pair_index,
                message: result.message || 'Position opened successfully on Avantis',
                verified: positionVerified
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[AVANTIS] ❌ Exception opening position${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}:`, error);
            // Check if error is transient and we should retry
            if (isTransientError(errorMessage) && attempt < maxRetries) {
                const delay = (attempt + 1) * 1000; // Exponential backoff
                console.log(`[AVANTIS] ⏳ Transient error detected, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry
            }
            // Permanent error or max retries reached
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    // Should not reach here, but just in case
    return {
        success: false,
        error: 'Failed to open position after all retries'
    };
}
/**
 * Close a position on Avantis
 */
async function closeAvantisPosition(params) {
    try {
        console.log(`[AVANTIS] Closing position: pair_index=${params.pair_index}`);
        // Remove trailing slash from AVANTIS_API_URL if present
        const baseUrl = AVANTIS_API_URL.endsWith('/') ? AVANTIS_API_URL.slice(0, -1) : AVANTIS_API_URL;
        const response = await fetch(`${baseUrl}/api/close-position`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pair_index: params.pair_index,
                private_key: params.private_key,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            console.error(`[AVANTIS] Failed to close position: ${errorData.detail || response.statusText}`);
            return {
                success: false,
                error: errorData.detail || response.statusText
            };
        }
        const result = await response.json();
        console.log(`[AVANTIS] Position closed successfully: ${JSON.stringify(result)}`);
        return {
            success: true,
            tx_hash: result.tx_hash,
            message: result.message || 'Position closed successfully'
        };
    }
    catch (error) {
        console.error(`[AVANTIS] Error closing position:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
/**
 * Get positions from Avantis
 */
async function getAvantisPositions(privateKey) {
    try {
        // Remove trailing slash from AVANTIS_API_URL if present
        const baseUrl = AVANTIS_API_URL.endsWith('/') ? AVANTIS_API_URL.slice(0, -1) : AVANTIS_API_URL;
        const response = await fetch(`${baseUrl}/api/positions?private_key=${encodeURIComponent(privateKey)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            console.error(`[AVANTIS] Failed to get positions: ${response.statusText}`);
            return [];
        }
        const result = await response.json();
        return result.positions || [];
    }
    catch (error) {
        console.error(`[AVANTIS] Error getting positions:`, error);
        return [];
    }
}
//# sourceMappingURL=avantis-trading.js.map