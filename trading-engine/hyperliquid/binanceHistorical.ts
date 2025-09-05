import fetch from 'node-fetch';
import { publicClient } from './hyperliquid';

export interface OHLCV {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  timestamp: number[];
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number[];
}

// Rate limiting configuration - Very conservative limits to avoid issues
const RATE_LIMITS = {
  hyperliquid: { requests: 0, maxRequests: 10, windowMs: 60000, lastReset: Date.now() },
  coingecko: { requests: 0, maxRequests: 5, windowMs: 60000, lastReset: Date.now() },
  binance: { requests: 0, maxRequests: 300, windowMs: 60000, lastReset: Date.now() }
};

// Cache configuration - Longer cache to reduce API calls
const CACHE_TTL_MS = 600_000; // 10 minute cache to reduce API calls
const ohlcvCache: Map<string, { data: OHLCV; timestamp: number; source: string }> = new Map();

// Symbol mapping for different sources - Top 50 tokens only
export const tokenSymbolToBinancePair: Record<string, string> = {
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

const EMPTY_OHLCV: OHLCV = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };

/**
 * Rate limiting utility with delay
 */
async function checkRateLimit(source: keyof typeof RATE_LIMITS): Promise<boolean> {
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
function convertIntervalToHyperliquid(interval: string): string {
  const intervalMap: Record<string, string> = {
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
 * Fetch OHLCV data from Hyperliquid SDK (Primary Source)
 */
async function fetchOHLCVFromHyperliquid(
  symbol: string,
  interval: string,
  limit = 300
): Promise<OHLCV> {
  if (!(await checkRateLimit('hyperliquid'))) {
    throw new Error('Rate limit exceeded for Hyperliquid');
  }

  try {
    const hlInterval = convertIntervalToHyperliquid(interval);
    const response = await fetch(`https://api.hyperliquid.xyz/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candlesV2',
        coin: symbol,
        interval: hlInterval,
        limit: limit
      })
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid response format from Hyperliquid');
    }

    const ohlcv: OHLCV = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };
    
    data.forEach((candle: any) => {
      if (candle && typeof candle.open === 'number') {
        ohlcv.open.push(candle.open);
        ohlcv.high.push(candle.high);
        ohlcv.low.push(candle.low);
        ohlcv.close.push(candle.close);
        ohlcv.volume.push(candle.volume || 0);
        ohlcv.timestamp.push(candle.time || Date.now());
      }
    });

    return ohlcv;
  } catch (error) {
    console.warn(`❌ Hyperliquid fetch failed for ${symbol}:`, (error as Error).message);
    throw error;
  }
}

/**
 * Fetch OHLCV data from CoinGecko API (Secondary Source)
 */
async function fetchOHLCVFromCoinGecko(
  symbol: string,
  interval: string,
  limit = 300
): Promise<OHLCV> {
  if (!(await checkRateLimit('coingecko'))) {
    throw new Error('Rate limit exceeded for CoinGecko');
  }

  try {
    // Convert interval to CoinGecko format
    const intervalMap: Record<string, string> = {
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
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format from CoinGecko');
    }

    const ohlcv: OHLCV = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };
    
    data.slice(0, limit).forEach((candle: number[]) => {
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
  } catch (error) {
    console.warn(`❌ CoinGecko fetch failed for ${symbol}:`, (error as Error).message);
    throw error;
  }
}

/**
 * Fetch OHLCV data from Binance API (Tertiary Source)
 */
async function fetchOHLCVFromBinanceInternal(
  symbol: string,
  interval: string,
  limit = 300
): Promise<OHLCV> {
  if (!(await checkRateLimit('binance'))) {
    throw new Error('Rate limit exceeded for Binance');
  }

  try {
    const cleanSymbol = symbol.replace('_USD', '');
    const binancePair = tokenSymbolToBinancePair[cleanSymbol];
    
    if (!binancePair) {
      throw new Error(`Symbol ${symbol} not supported on Binance`);
    }

    const url = `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=${interval}&limit=${limit}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format from Binance');
    }

    const ohlcv: OHLCV = { open: [], high: [], low: [], close: [], volume: [], timestamp: [] };
    
    data.forEach((candle: any) => {
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
  } catch (error) {
    console.warn(`❌ Binance fetch failed for ${symbol}:`, (error as Error).message);
    throw error;
  }
}

/**
 * Fetch OHLCV data with fallback sources
 */
export async function fetchOHLCVWithFallback(
  symbol: string,
  interval: string,
  limit = 300
): Promise<OHLCV> {
  const cleanSymbol = symbol.replace('_USD', '');
  const binancePair = tokenSymbolToBinancePair[cleanSymbol];
  
  const sources = [
    // Use Binance as primary for supported tokens, otherwise try Hyperliquid first
    ...(binancePair ? [
      { name: 'Binance', fn: fetchOHLCVFromBinanceInternal, key: 'binance' as keyof typeof RATE_LIMITS }
    ] : [
      { name: 'Hyperliquid', fn: fetchOHLCVFromHyperliquid, key: 'hyperliquid' as keyof typeof RATE_LIMITS }
    ]),
    { name: 'CoinGecko', fn: fetchOHLCVFromCoinGecko, key: 'coingecko' as keyof typeof RATE_LIMITS },
    // Add Binance as fallback if not already primary
    ...(binancePair ? [] : [
      { name: 'Binance', fn: fetchOHLCVFromBinanceInternal, key: 'binance' as keyof typeof RATE_LIMITS }
    ])
  ];

  for (const source of sources) {
    try {
      console.log(`🔄 Trying ${source.name} for ${symbol}...`);
      const data = await source.fn(symbol, interval, limit);
      console.log(`✅ Successfully fetched data from ${source.name}`);
      return data;
    } catch (error) {
      const errorMsg = (error as Error).message;
      console.warn(`❌ ${source.name} failed:`, errorMsg);
      
      // If it's a rate limit error, reset the rate limit for this source and retry once
      if (errorMsg.includes('Rate limit exceeded') || errorMsg.includes('429')) {
        resetRateLimitForSource(source.key);
        console.log(`🔄 Retrying ${source.name} after rate limit reset...`);
        try {
          const retryData = await source.fn(symbol, interval, limit);
          console.log(`✅ Successfully fetched data from ${source.name} on retry`);
          return retryData;
        } catch (retryError) {
          console.warn(`❌ ${source.name} retry failed:`, (retryError as Error).message);
        }
      }
      continue;
    }
  }
  
  console.error(`❌ All data sources failed for ${symbol}`);
  return EMPTY_OHLCV;
}

/**
 * Get cached OHLCV data or fetch if not cached
 */
export async function getCachedOHLCV(
  symbol: string,
  interval: string,
  limit = 300
): Promise<OHLCV> {
  const key = `${symbol}_${interval}_${limit}`;
  const now = Date.now();
  const cached = ohlcvCache.get(key);
  
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`📦 Using cached data for ${symbol} (${cached.source})`);
    return cached.data;
  }
  
  const data = await fetchOHLCVWithFallback(symbol, interval, limit);
  ohlcvCache.set(key, { data, timestamp: now, source: 'fallback' });
  
  return data;
}

/**
 * Fetch multiple timeframes of OHLCV with caching
 */
export async function getMultiTimeframeOHLCV(
  symbol: string,
  intervals: string[] = ['5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d'],
  limit = 300
): Promise<Record<string, OHLCV>> {
  const result: Record<string, OHLCV> = {};
  
  await Promise.all(
    intervals.map(async interval => {
      try {
        result[interval] = await getCachedOHLCV(symbol, interval, limit);
      } catch (err) {
        console.warn(`⚠️ Error fetching ${interval} for ${symbol}:`, err);
        result[interval] = EMPTY_OHLCV;
      }
    })
  );
  
  return result;
}

/**
 * Fetch latest single candle with fallback sources
 */
export async function fetchSingleCandle(
  symbol: string,
  interval = '1m'
): Promise<Candle | null> {
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
  } catch (error) {
    console.warn(`⚠️ Error fetching single candle for ${symbol}:`, error);
    return null;
  }
}

/**
 * Clear cached OHLCV data
 */
export function clearOHLCVCache(): void {
  ohlcvCache.clear();
  console.log('🗑️ OHLCV cache cleared');
}

/**
 * Get rate limit status
 */
export function getRateLimitStatus(): Record<string, any> {
  return RATE_LIMITS;
}

/**
 * Reset rate limit counters
 */
export function resetRateLimits(): void {
  Object.keys(RATE_LIMITS).forEach(source => {
    RATE_LIMITS[source as keyof typeof RATE_LIMITS].requests = 0;
    RATE_LIMITS[source as keyof typeof RATE_LIMITS].lastReset = Date.now();
  });
  console.log('🔄 Rate limits reset');
}

/**
 * Force reset rate limits for a specific source
 */
export function resetRateLimitForSource(source: keyof typeof RATE_LIMITS): void {
  RATE_LIMITS[source].requests = 0;
  RATE_LIMITS[source].lastReset = Date.now();
  console.log(`🔄 Rate limit reset for ${source}`);
}

 