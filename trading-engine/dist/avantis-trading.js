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
/**
 * Open a position on Avantis
 */
async function openAvantisPosition(params) {
    try {
        console.log(`[AVANTIS] ==========================================`);
        console.log(`[AVANTIS] 🚀 OPENING POSITION ON REAL AVANTIS PLATFORM`);
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
        // Remove trailing slash from AVANTIS_API_URL if present
        const baseUrl = AVANTIS_API_URL.endsWith('/') ? AVANTIS_API_URL.slice(0, -1) : AVANTIS_API_URL;
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
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            console.error(`[AVANTIS] ❌ Failed to open position: ${errorData.detail || response.statusText}`);
            console.error(`[AVANTIS] Response status: ${response.status}`);
            return {
                success: false,
                error: errorData.detail || response.statusText
            };
        }
        const result = await response.json();
        console.log(`[AVANTIS] ==========================================`);
        console.log(`[AVANTIS] ✅✅✅ POSITION OPENED SUCCESSFULLY ON AVANTIS!`);
        console.log(`[AVANTIS] Transaction Hash: ${result.tx_hash}`);
        console.log(`[AVANTIS] Pair Index: ${result.pair_index}`);
        console.log(`[AVANTIS] Symbol: ${result.symbol || params.symbol}`);
        console.log(`[AVANTIS] Direction: ${params.is_long ? 'LONG' : 'SHORT'}`);
        console.log(`[AVANTIS] Collateral: $${params.collateral}`);
        console.log(`[AVANTIS] Leverage: ${params.leverage}x`);
        console.log(`[AVANTIS] ==========================================`);
        console.log(`[AVANTIS] 📊 THIS POSITION IS NOW LIVE ON AVANTIS DASHBOARD`);
        console.log(`[AVANTIS] 📊 Connect your backend wallet to avantisfi.com to see it`);
        console.log(`[AVANTIS] 📊 The position will appear in your "Current Positions" section`);
        console.log(`[AVANTIS] ==========================================`);
        return {
            success: true,
            tx_hash: result.tx_hash,
            pair_index: result.pair_index,
            message: result.message || 'Position opened successfully on Avantis'
        };
    }
    catch (error) {
        console.error(`[AVANTIS] ❌ Exception opening position:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
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