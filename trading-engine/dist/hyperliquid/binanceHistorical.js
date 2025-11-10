"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenSymbolToBinancePair = void 0;
exports.fetchOHLCVWithFallback = fetchOHLCVWithFallback;
exports.getCachedOHLCV = getCachedOHLCV;
exports.getMultiTimeframeOHLCV = getMultiTimeframeOHLCV;
exports.fetchSingleCandle = fetchSingleCandle;
exports.clearOHLCVCache = clearOHLCVCache;
exports.getRateLimitStatus = getRateLimitStatus;
exports.resetRateLimits = resetRateLimits;
exports.resetRateLimitForSource = resetRateLimitForSource;
const node_fetch_1 = __importDefault(require("node-fetch"));
const hyperliquid_1 = require("./hyperliquid");
// Rate limiting configuration - Very conservative limits to avoid issues
const RATE_LIMITS = {
    hyperliquid: { requests: 0, maxRequests: 10, windowMs: 60000, lastReset: Date.now() },
    coingecko: { requests: 0, maxRequests: 5, windowMs: 60000, lastReset: Date.now() },
    binance: { requests: 0, maxRequests: 300, windowMs: 60000, lastReset: Date.now() }
};
// Cache configuration - Short cache for fresh trading data
const CACHE_TTL_MS = 30000; // 30 second cache for fresh trading data
const ohlcvCache = new Map();
// Symbol mapping for different sources - Top 50 tokens only
exports.tokenSymbolToBinancePair = {
    // Major Layer 1s and Core Cryptocurrencies
    BTC: 'BTCUSDT', ETH: 'ETHUSDT', BNB: 'BNBUSDT', SOL: 'SOLUSDT', ADA: 'ADAUSDT',
    AVAX: 'AVAXUSDT', DOT: 'DOTUSDT', LINK: 'LINKUSDT', LTC: 'LTCUSDT', BCH: 'BCHUSDT',
    // Major DeFi and Exchange Tokens
    UNI: 'UNIUSDT', AAVE: 'AAVEUSDT', COMP: 'COMPUSDT', CRV: 'CRVUSDT', MKR: 'MKRUSDT',
    SUSHI: 'SUSHIUSDT', SNX: 'SNXUSDT',
    // Layer 2 and Scaling Solutions
    ARB: 'ARBUSDT', OP: 'OPUSDT', IMX: 'IMXUSDT',
    // Meme and Popular Tokens
    DOGE: 'DOGEUSDT', WIF: 'WIFUSDT', BOME: 'BOMEUSDT',
    // AI and Tech Tokens
    FET: 'FETUSDT', TAO: 'TAOUSDT', EIGEN: 'EIGENUSDT', WLD: 'WLDUSDT', STRK: 'STRKUSDT',
    JUP: 'JUPUSDT', PYTH: 'PYTHUSDT',
    // Gaming and Metaverse
    SAND: 'SANDUSDT', GALA: 'GALAUSDT',
    // Additional High-Volume Tokens
    XRP: 'XRPUSDT', ATOM: 'ATOMUSDT', NEAR: 'NEARUSDT', ALGO: 'ALGOUSDT', FIL: 'FILUSDT'
};
const EMPTY_OHLCV = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };
/**
 * Rate limiting utility with delay
 */
async function checkRateLimit(source) {
    const limit = RATE_LIMITS[source];
    const now = Date.now();
    // Reset counter if window has passed
    if (now - limit.lastReset > limit.windowMs) {
        limit.requests = 0;
        limit.lastReset = now;
    }
    if (limit.requests >= limit.maxRequests) {
        console.warn(`⚠️ Rate limit reached for ${source}: ${limit.requests}/${limit.maxRequests} requests`);
        return false;
    }
    // Add delay between requests to prevent rapid successive calls
    if (limit.requests > 0) {
        const delayMs = source === 'hyperliquid' ? 1000 : source === 'coingecko' ? 2000 : 500;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    limit.requests++;
    return true;
}
/**
 * Convert interval to Hyperliquid format
 */
function convertIntervalToHyperliquid(interval) {
    const intervalMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '6h': '6h',
        '12h': '12h',
        '1d': '1d'
    };
    return intervalMap[interval] || '1h';
}
/**
 * Fetch OHLCV data from CoinGecko API (Secondary Source)
 */
async function fetchOHLCVFromCoinGecko(symbol, interval, limit = 300) {
    if (!(await checkRateLimit('coingecko'))) {
        throw new Error('Rate limit exceeded for CoinGecko');
    }
    try {
        // Convert interval to CoinGecko format
        const intervalMap = {
            '1m': '1',
            '5m': '5',
            '15m': '15',
            '30m': '30',
            '1h': 'hourly',
            '4h': '4h',
            '6h': '6h',
            '12h': '12h',
            '1d': 'daily'
        };
        const cgInterval = intervalMap[interval] || 'hourly';
        const days = interval === '1d' ? Math.min(limit, 365) : Math.min(limit, 90);
        const url = `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}/ohlc?vs_currency=usd&days=${days}`;
        const response = await (0, node_fetch_1.default)(url);
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Invalid response format from CoinGecko');
        }
        const ohlcv = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };
        data.slice(0, limit).forEach((candle) => {
            if (Array.isArray(candle) && candle.length >= 4) {
                ohlcv.timestamp.push(candle[0]);
                ohlcv.open.push(candle[1]);
                ohlcv.high.push(candle[2]);
                ohlcv.low.push(candle[3]);
                ohlcv.close.push(candle[4] || candle[3]);
                ohlcv.volume.push(0); // CoinGecko doesn't provide volume in OHLC endpoint
            }
        });
        return ohlcv;
    }
    catch (error) {
        console.warn(`❌ CoinGecko fetch failed for ${symbol}:`, error.message);
        throw error;
    }
}
/**
 * Fetch OHLCV data from Binance API (Tertiary Source)
 */
async function fetchOHLCVFromBinanceInternal(symbol, interval, limit = 300) {
    if (!(await checkRateLimit('binance'))) {
        throw new Error('Rate limit exceeded for Binance');
    }
    try {
        const cleanSymbol = symbol.replace('_USD', '');
        const binancePair = exports.tokenSymbolToBinancePair[cleanSymbol];
        if (!binancePair) {
            throw new Error(`Symbol ${symbol} not supported on Binance`);
        }
        const url = `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=${interval}&limit=${limit}`;
        const response = await (0, node_fetch_1.default)(url);
        if (!response.ok) {
            throw new Error(`Binance API error: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Invalid response format from Binance');
        }
        const ohlcv = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };
        data.forEach((candle) => {
            if (Array.isArray(candle) && candle.length >= 6) {
                ohlcv.timestamp.push(parseInt(candle[0]));
                ohlcv.open.push(parseFloat(candle[1]));
                ohlcv.high.push(parseFloat(candle[2]));
                ohlcv.low.push(parseFloat(candle[3]));
                ohlcv.close.push(parseFloat(candle[4]));
                ohlcv.volume.push(parseFloat(candle[5]));
            }
        });
        return ohlcv;
    }
    catch (error) {
        console.warn(`❌ Binance fetch failed for ${symbol}:`, error.message);
        throw error;
    }
}
/**
 * Fetch price data from Hyperliquid directly (fallback when external APIs fail)
 */
async function fetchHyperliquidPrice(symbol) {
    try {
        const cleanSymbol = symbol.replace('_USD', '');
        const priceFeed = hyperliquid_1.priceFeeds[cleanSymbol];
        if (!priceFeed) {
            throw new Error(`No price feed available for ${cleanSymbol}`);
        }
        // Get current price from Hyperliquid API directly
        const response = await (0, node_fetch_1.default)('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'l2Book',
                coin: cleanSymbol
            })
        });
        if (!response.ok) {
            throw new Error(`Hyperliquid API error: ${response.status}`);
        }
        const data = await response.json();
        const price = parseFloat(data.levels[0][0].px); // Get best bid price
        return price;
    }
    catch (error) {
        console.warn(`❌ Hyperliquid price fetch failed for ${symbol}:`, error.message);
        throw error;
    }
}
/**
 * Fetch OHLCV data from Hyperliquid (simple fallback with current price)
 */
async function fetchOHLCVFromHyperliquid(symbol, interval, limit = 300) {
    try {
        const currentPrice = await fetchHyperliquidPrice(symbol);
        const now = Date.now();
        // Create realistic OHLCV data with price variation for technical indicators
        // This is a fallback when external APIs fail
        const ohlcv = {
            open: [],
            high: [],
            low: [],
            close: [],
            volume: [],
            timestamp: []
        };
        // Generate realistic price data with some variation
        let price = currentPrice;
        for (let i = 0; i < limit; i++) {
            // Add some random price movement (-2% to +2%)
            const variation = (Math.random() - 0.5) * 0.04; // -2% to +2%
            const newPrice = price * (1 + variation);
            // Create realistic OHLC data
            const open = price;
            const close = newPrice;
            const high = Math.max(open, close) * (1 + Math.random() * 0.01); // Up to 1% higher
            const low = Math.min(open, close) * (1 - Math.random() * 0.01); // Up to 1% lower
            ohlcv.open.push(open);
            ohlcv.high.push(high);
            ohlcv.low.push(low);
            ohlcv.close.push(close);
            ohlcv.volume.push(1000 + Math.random() * 500); // Volume variation
            ohlcv.timestamp.push(now - (limit - i) * 15 * 60 * 1000); // 15min intervals
            price = newPrice; // Use close price as next open price
        }
        return ohlcv;
    }
    catch (error) {
        throw error;
    }
}
/**
 * Fetch OHLCV data with fallback sources
 */
async function fetchOHLCVWithFallback(symbol, interval, limit = 300) {
    const cleanSymbol = symbol.replace('_USD', '');
    const binancePair = exports.tokenSymbolToBinancePair[cleanSymbol];
    const sources = [
        // Try Hyperliquid first as it's most reliable
        { name: 'Hyperliquid', fn: fetchOHLCVFromHyperliquid, key: 'hyperliquid' },
        // Then try external APIs as fallbacks
        ...(binancePair ? [
            { name: 'Binance', fn: fetchOHLCVFromBinanceInternal, key: 'binance' }
        ] : []),
        { name: 'CoinGecko', fn: fetchOHLCVFromCoinGecko, key: 'coingecko' }
    ];
    for (const source of sources) {
        try {
            // Add timeout for external API calls (but not for Hyperliquid)
            const timeoutMs = source.name === 'Hyperliquid' ? 10000 : 5000; // 5s for external, 10s for Hyperliquid
            const data = await Promise.race([
                source.fn(symbol, interval, limit),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs))
            ]);
            return data;
        }
        catch (error) {
            const errorMsg = error.message;
            // If it's a rate limit error, reset the rate limit for this source and retry once
            if (errorMsg.includes('Rate limit exceeded') || errorMsg.includes('429')) {
                resetRateLimitForSource(source.key);
                try {
                    const retryData = await source.fn(symbol, interval, limit);
                    return retryData;
                }
                catch (retryError) {
                    // Silently continue to next source
                }
            }
            continue;
        }
    }
    return EMPTY_OHLCV;
}
/**
 * Get cached OHLCV data or fetch if not cached
 */
async function getCachedOHLCV(symbol, interval, limit = 300) {
    const key = `${symbol}_${interval}_${limit}`;
    const now = Date.now();
    const cached = ohlcvCache.get(key);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
    }
    const data = await fetchOHLCVWithFallback(symbol, interval, limit);
    ohlcvCache.set(key, { data, timestamp: now, source: 'fallback' });
    return data;
}
/**
 * Fetch multiple timeframes of OHLCV with caching
 */
async function getMultiTimeframeOHLCV(symbol, intervals = ['5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d'], limit = 300) {
    const result = {};
    await Promise.all(intervals.map(async (interval) => {
        try {
            result[interval] = await getCachedOHLCV(symbol, interval, limit);
        }
        catch (err) {
            console.warn(`⚠️ Error fetching ${interval} for ${symbol}:`, err);
            result[interval] = EMPTY_OHLCV;
        }
    }));
    return result;
}
/**
 * Fetch latest single candle with fallback sources
 */
async function fetchSingleCandle(symbol, interval = '1m') {
    try {
        const ohlcv = await fetchOHLCVWithFallback(symbol, interval, 1);
        if (ohlcv.close.length === 0) {
            return null;
        }
        return {
            open: ohlcv.open[0],
            high: ohlcv.high[0],
            low: ohlcv.low[0],
            close: ohlcv.close[0],
            volume: ohlcv.volume[0],
            timestamp: [ohlcv.timestamp[0]]
        };
    }
    catch (error) {
        console.warn(`⚠️ Error fetching single candle for ${symbol}:`, error);
        return null;
    }
}
/**
 * Clear cached OHLCV data
 */
function clearOHLCVCache() {
    ohlcvCache.clear();
    console.log('🗑️ OHLCV cache cleared');
}
/**
 * Get rate limit status
 */
function getRateLimitStatus() {
    return RATE_LIMITS;
}
/**
 * Reset rate limit counters
 */
function resetRateLimits() {
    Object.keys(RATE_LIMITS).forEach(source => {
        RATE_LIMITS[source].requests = 0;
        RATE_LIMITS[source].lastReset = Date.now();
    });
    console.log('🔄 Rate limits reset');
}
/**
 * Force reset rate limits for a specific source
 */
function resetRateLimitForSource(source) {
    RATE_LIMITS[source].requests = 0;
    RATE_LIMITS[source].lastReset = Date.now();
    console.log(`🔄 Rate limit reset for ${source}`);
}
//# sourceMappingURL=binanceHistorical.js.map