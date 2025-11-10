import { Regime } from './regime';
interface OptimizedEntry {
    rsiOversold?: number;
    rsiOverbought?: number;
    atrMin?: number;
    adxMin?: number;
    signalScoreMin?: number;
    emaBullThreshold?: number;
    emaBearThreshold?: number;
    RSI?: number;
    MACD_Histogram?: number;
    EMA_Slope?: number;
    ATRPercent?: number;
    VolumePercent?: number;
    regime?: string;
    tpMultLong?: number;
    slMultLong?: number;
    tpMultShort?: number;
    slMultShort?: number;
    leverage?: number;
    winRate?: number;
    trades?: number;
    enabled?: boolean;
}
export interface OHLCV {
    timestamp: any;
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
}
export interface SignalResult {
    priceSlope: number;
    emaFast: number;
    emaSlow: number;
    atrValue: number;
    adxValue: number;
    adxPrev: number;
    macdValue: number;
    macdHist: number;
    macdHistPrev: number;
    rsiValue: number;
    rsiTrend: number[];
    volumePct: number;
    marketRegime: Regime;
    regimeConfidence?: number;
    signalScore: number;
    direction?: 'long' | 'short';
    tp?: number;
    sl?: number;
    rrr?: number;
    confidence?: 'high' | 'medium' | 'low';
    regime?: string;
    shouldOpen?: boolean;
    reason?: string;
    priceTrend?: (rsiTrend: number[], priceTrend: any) => unknown;
    passed?: boolean;
    entryType?: 'long' | 'short';
    rsi?: number;
    emaSlope?: number;
    atrPct?: number;
    atr?: number;
    adx?: number;
    adxSlope?: number;
    divergenceScore?: number;
    leverage?: number;
}
export interface IndicatorValues {
    rsi: number;
    macdHist: number;
    macdHistPrev: number;
    emaSlope: number;
    adx: number;
    atrPct: number;
    atr: number;
    thresholds: Thresholds;
    rsiTrend: number[];
    volumePercent: number;
    divergenceScore: number;
    signalScore: number;
    volumePct: number;
}
export interface Thresholds {
    rsiOversold: number;
    rsiOverbought: number;
    atrMin: number;
    adxMin: number;
    signalScoreMin: number;
    emaBullThreshold: number;
    emaBearThreshold: number;
    RSI: number;
    MACD_Histogram: number;
    EMA_Slope: number;
    ATRPercent: number;
    VolumePercent: number;
    regime?: string;
    tpMultLong?: number;
    slMultLong?: number;
    tpMultShort?: number;
    slMultShort?: number;
    leverage?: number;
    winRate?: number;
    trades?: number;
    enabled?: boolean;
}
export declare class TradeMemory {
    private cooldownCounter;
    private lastResult;
    constructor();
    recordTradeResult(outcome: 'win' | 'loss'): void;
    tick(): void;
    canTrade(signalStrength: number, overrideThreshold?: number): boolean;
}
export declare function isUncertainRegime(regime: string): boolean;
export declare function calculateSignalScoreWeighted({ rsi, macdHist, emaSlope, atrPct, adx, divergenceScore }: {
    rsi: number;
    macdHist: number;
    emaSlope: number;
    atrPct: number;
    adx: number;
    divergenceScore?: number;
}, lastPrice: number): number;
export declare const calculateSignalScore: typeof calculateSignalScoreWeighted;
export declare function linearSlope(arr: number[]): number;
export declare function divergenceScore(rsiTrend: number[], priceTrend: number[]): number;
export declare function buildIndicatorInputs(signalResult: SignalResult, close: number[], // ⬅️ full close array instead of single price
volumeArr: number[]): IndicatorValues;
export declare function calculateADX(high: number[], low: number[], close: number[], period?: number): number | null;
export declare function detectMarketRegime({ emaShort, emaLong, rsi, macd, atrPct }: {
    emaShort: number;
    emaLong: number;
    rsi: number;
    macd: number;
    atrPct: number;
}): Regime;
export declare function checkSignals(symbol: string, ohlcv: OHLCV, configOverride?: Partial<OptimizedEntry>, forcedRegime?: Regime): SignalResult;
export declare function getMinutesSinceHour(): number;
export declare function isEMACompressed(emaFast: number, emaSlow: number, price: number): boolean;
export declare function isRSIDiverging(rsiTrend: number[], priceTrend: number[]): boolean;
export declare function calculateMOS({ ohlcv, mtfSlopes }: {
    ohlcv: OHLCV;
    mtfSlopes: number[];
}): number;
export {};
//# sourceMappingURL=signals.d.ts.map