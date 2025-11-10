import { OHLCV } from './binanceHistorical';
export type Regime = 'bullish' | 'bearish' | 'neutral' | 'flat_or_choppy' | 'volatile_uncertain';
export interface RegimeResult {
    regime: Regime;
    confidence: number;
    timeframe: string;
}
/**
 * Detect regime purely using thresholds from dynamically generated configs
 */
export declare function detectRegime(symbol: string, ohlcv: OHLCV, timeframe: string): Promise<RegimeResult>;
/**
 * Compare 15m & 30m regimes, require alignment or fallback to 30m if mismatch.
 */
export declare function guessMarketRegime(symbol: string, ohlcv4h: OHLCV, ohlcv6h: OHLCV): Promise<RegimeResult>;
//# sourceMappingURL=regime.d.ts.map