"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateSignalOnly = evaluateSignalOnly;
const signals_1 = require("./signals");
const binanceHistorical_1 = require("./binanceHistorical");
function candlePosition({ open, close, high, low }) {
    const body = Math.abs(close - open);
    const range = high - low || 1;
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    const bodyPct = body / range;
    const closePos = (close - low) / range;
    const isDoji = bodyPct < 0.1 && upperShadow / range > 0.3 && lowerShadow / range > 0.3;
    const isHammer = lowerShadow > 2 * body && upperShadow < body;
    const isShootingStar = upperShadow > 2 * body && lowerShadow < body;
    let pos = 'middle';
    if (closePos >= 0.8)
        pos = 'top';
    else if (closePos >= 0.67)
        pos = 'anticipation_top';
    else if (closePos <= 0.2)
        pos = 'bottom';
    else if (closePos <= 0.33)
        pos = 'anticipation_bottom';
    if (isDoji) {
        if (pos === 'top' || pos === 'anticipation_top')
            return 'doji_top';
        if (pos === 'bottom' || pos === 'anticipation_bottom')
            return 'doji_bottom';
    }
    if (isHammer && (pos === 'bottom' || pos === 'anticipation_bottom')) {
        return 'hammer_bottom';
    }
    if (isShootingStar && (pos === 'top' || pos === 'anticipation_top')) {
        return 'shooting_star_top';
    }
    return pos;
}
async function evaluateSignalOnly(symbol, _ohlcv, p0) {
    try {
        // --- Load multi-timeframe data ---
        const mtf = await (0, binanceHistorical_1.getMultiTimeframeOHLCV)(symbol, ['5m', '30m', '1h'], 300);
        const ohlcv5m = mtf['5m'];
        const ohlcv30m = mtf['30m'];
        const ohlcv1h = mtf['1h'];
        // --- Check signals for 30m timeframe ---
        const res30m = (0, signals_1.checkSignals)(symbol, ohlcv30m, p0.configOverride, p0.regimeOverride);
        const { signalScore = 0, rsiValue: rsi = 50, rsiTrend = [], adxValue: adx = 0, adxPrev = 0, atrValue = 0, divergenceScore = 0, priceSlope: rawPriceSlope30m, volumePct = 0, marketRegime = 'neutral', } = res30m;
        // --- Calculations ---
        const rsiSlope30m = (0, signals_1.linearSlope)(rsiTrend);
        const priceSlope30m = typeof rawPriceSlope30m === 'number' && !isNaN(rawPriceSlope30m) ? rawPriceSlope30m : 0;
        const lastPrice = ohlcv30m.close.at(-1);
        const atrPct = (atrValue / lastPrice) * 100;
        const priceSlopePct = priceSlope30m / lastPrice;
        const adxSlope = adx - adxPrev;
        const slope5m = (0, signals_1.linearSlope)(ohlcv5m.close.slice(-20));
        const slope30m = (0, signals_1.linearSlope)(ohlcv30m.close.slice(-20));
        const slope1h = (0, signals_1.linearSlope)(ohlcv1h.close.slice(-20));
        const trendSlope1h = ohlcv1h.close.length >= 20 ? (0, signals_1.linearSlope)(ohlcv1h.close.slice(-20)) : 0;
        const trendSlopePct1h = trendSlope1h / lastPrice;
        const i5 = ohlcv5m.close.length - 2;
        const open5 = ohlcv5m.open[i5];
        const close5 = ohlcv5m.close[i5];
        const candleColor5m = close5 > open5 ? 'green' : 'red';
        const candlePos5m = candlePosition({
            open: open5,
            high: ohlcv5m.high[i5],
            low: ohlcv5m.low[i5],
            close: close5,
        });
        // --- Market Outlook Score ---
        const mos = (0, signals_1.calculateMOS)({ ohlcv: ohlcv5m, mtfSlopes: [slope5m, slope30m, slope1h] });
        // NOTE: Signal criteria have been loosened for easier position opening
        // TODO: Review and tighten criteria for production if needed
        const mosThresholdLong = -0.5; // VERY loose for testing - almost always triggers long
        const mosThresholdShort = 0.5; // VERY loose for testing - almost always triggers short
        const mosThresholdExtreme = 0.3;
        const mosThresholdReversalBlockShort = 0.3; // Block short reversal in strong bull
        const mosThresholdReversalBlockLong = -0.3; // Block long reversal in strong bear
        let mosDecision = 'neutral';
        let mosReason = `MOS=${mos.toFixed(4)} within neutral range`;
        if (mos > mosThresholdLong) {
            mosDecision = 'long';
            mosReason = `🧠 MOS=${mos.toFixed(4)} → Strong Long Bias`;
        }
        else if (mos < mosThresholdShort) {
            mosDecision = 'short';
            mosReason = `🧠 MOS=${mos.toFixed(4)} → Strong Short Bias`;
        }
        // Skip in neutral regime with very low ADX (TEMPORARILY DISABLED FOR TESTING)
        // if (marketRegime === 'neutral' && adx < 10) {
        //   return {
        //     ...res30m,
        //     shouldOpen: false,
        //     passed: false,
        //     reason: '✖️ Signal rejected: Neutral regime with low ADX',
        //     confidence: 'low',
        //     logged: false,
        //     mos,
        //   };
        // }
        // --- Sniper & Reversal conditions ---
        // NOTE: Signal criteria have been loosened for easier position opening
        // TODO: Review and tighten criteria for production if needed
        const sniperConditions = {
            long: {
                signalScore: { value: signalScore, pass: signalScore > 0.01, expected: '> 0.01' }, // VERY loose - almost any signal
                rsi: { value: rsi, pass: rsi >= 10 && rsi <= 90, expected: '10–90' }, // Very wide range
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > -10, expected: '> -10' }, // Very permissive
                atr: { value: atrPct, pass: atrPct > 0.01, expected: '> 0.01%' }, // Very low volatility requirement
                adx: { value: adx, pass: adx > 5, expected: '> 5' }, // Very low trend strength requirement
                priceSlope: { value: priceSlopePct, pass: priceSlopePct > -0.05, expected: '> -5%' }, // Allow significant decline
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h > -0.05, expected: '> -5%' }, // Allow significant decline
                volumePct: { value: volumePct, pass: volumePct > 0.0001, expected: '> 0.01%' }, // Very low volume requirement
                candlePos5m: {
                    value: candlePos5m,
                    pass: true, // Accept ANY candle position
                    expected: 'any',
                },
            },
            short: {
                signalScore: { value: signalScore, pass: signalScore > 0.01, expected: '> 0.01' }, // VERY loose - almost any signal
                rsi: { value: rsi, pass: rsi >= 10 && rsi <= 90, expected: '10–90' }, // Very wide range
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 10, expected: '< 10' }, // Very permissive
                atr: { value: atrPct, pass: atrPct > 0.01, expected: '> 0.01%' }, // Very low volatility requirement
                adx: { value: adx, pass: adx > 5, expected: '> 5' }, // Very low trend strength requirement
                priceSlope: { value: priceSlopePct, pass: priceSlopePct < 0.05, expected: '< 5%' }, // Allow significant increase
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h < 0.05, expected: '< 5%' }, // Allow significant increase
                volumePct: { value: volumePct, pass: volumePct > 0.0001, expected: '> 0.01%' }, // Very low volume requirement
                candlePos5m: {
                    value: candlePos5m,
                    pass: true, // Accept ANY candle position
                    expected: 'any',
                },
            },
            longReversal: {
                signalScore: { value: signalScore, pass: signalScore > 0.01, expected: '> 0.01' }, // VERY loose
                rsi: { value: rsi, pass: rsi > 70, expected: '> 70' }, // Loosened from 85
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > -5, expected: '> -5' }, // Very permissive
                atr: { value: atrPct, pass: atrPct > 0.01, expected: '> 0.01%' }, // Very loose
                adx: { value: adx, pass: adx > 5, expected: '> 5' }, // Very loose
                adxSlope: { value: adxSlope, pass: adxSlope < 5, expected: '< 5' }, // Very permissive
                divergence: { value: divergenceScore, pass: divergenceScore > 0.01, expected: '> 0.01' }, // Very loose
                priceSlope: { value: priceSlopePct, pass: priceSlopePct < 0.05, expected: '< 5%' }, // Very permissive
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h < 0.05, expected: '< 5%' }, // Very permissive
                volumePct: { value: volumePct, pass: volumePct > 0.0001, expected: '> 0.01%' }, // Very loose
                candlePos5m: {
                    value: candlePos5m,
                    pass: true, // Accept ANY candle position
                    expected: 'any',
                },
            },
            shortReversal: {
                signalScore: { value: signalScore, pass: signalScore > 0.01, expected: '> 0.01' }, // VERY loose
                rsi: { value: rsi, pass: rsi < 30, expected: '< 30' }, // Loosened from 15
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 5, expected: '< 5' }, // Very permissive
                atr: { value: atrPct, pass: atrPct > 0.01, expected: '> 0.01%' }, // Very loose
                adx: { value: adx, pass: adx > 5, expected: '> 5' }, // Very loose
                adxSlope: { value: adxSlope, pass: adxSlope < 5, expected: '< 5' }, // Very permissive
                divergence: { value: divergenceScore, pass: divergenceScore > 0.01, expected: '> 0.01' }, // Very loose
                priceSlope: { value: priceSlopePct, pass: priceSlopePct > -0.05, expected: '> -5%' }, // Very permissive
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h > -0.05, expected: '> -5%' }, // Very permissive
                volumePct: { value: volumePct, pass: volumePct > 0.0001, expected: '> 0.01%' }, // Very loose
                candlePos5m: {
                    value: candlePos5m,
                    pass: true, // Accept ANY candle position
                    expected: 'any',
                },
            },
            bearishlong: {
                signalScore: { value: signalScore, pass: signalScore > 0.01, expected: '> 0.01' }, // VERY loose
                rsi: { value: rsi, pass: rsi >= 10 && rsi <= 60, expected: '10–60' }, // Very wide range
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > -5, expected: '> -5' }, // Very permissive
                atr: { value: atrPct, pass: atrPct > 0.01, expected: '> 0.01%' }, // Very loose
                adx: { value: adx, pass: adx > 5, expected: '> 5' }, // Very loose
                divergence: { value: divergenceScore, pass: divergenceScore > 0.01, expected: '> 0.01' }, // Very loose
                priceSlope: { value: priceSlopePct, pass: priceSlopePct > -0.05, expected: '> -5%' }, // Very permissive
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h > -0.05, expected: '> -5%' }, // Very permissive
                volumePct: { value: volumePct, pass: volumePct > 0.0001, expected: '> 0.01%' }, // Very loose
                candlePos5m: {
                    value: candlePos5m,
                    pass: true, // Accept ANY candle position
                    expected: 'any',
                },
            },
            bullishshort: {
                signalScore: { value: signalScore, pass: signalScore > 0.01, expected: '> 0.01' }, // VERY loose
                rsi: { value: rsi, pass: rsi >= 40 && rsi <= 90, expected: '40–90' }, // Very wide range
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 5, expected: '< 5' }, // Very permissive
                atr: { value: atrPct, pass: atrPct > 0.01, expected: '> 0.01%' }, // Very loose
                adx: { value: adx, pass: adx > 5, expected: '> 5' }, // Very loose
                divergence: { value: divergenceScore, pass: divergenceScore > 0.01, expected: '> 0.01' }, // Very loose
                priceSlope: { value: priceSlopePct, pass: priceSlopePct < 0.05, expected: '< 5%' }, // Very permissive
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h < 0.05, expected: '< 5%' }, // Very permissive
                volumePct: { value: volumePct, pass: volumePct > 0.0001, expected: '> 0.01%' }, // Very loose
                candlePos5m: {
                    value: candlePos5m,
                    pass: true, // Accept ANY candle position
                    expected: 'any',
                },
            },
        };
        // --- Track failed conditions ---
        const failed = {
            long: [], short: [], longReversal: [], shortReversal: [], bearishlong: [], bullishshort: []
        };
        for (const side of Object.keys(sniperConditions)) {
            for (const [k, { value, pass, expected }] of Object.entries(sniperConditions[side])) {
                if (!pass)
                    failed[side].push(`${k}=${value} ❌ [expected ${expected}]`);
            }
        }
        // --- Decision Logic ---
        let direction;
        let reason = '';
        // Sniper entries (MOS-biased)
        if (mosDecision === 'long' && failed.long.length === 0) {
            direction = 'long';
            reason = mosReason + ' + sniper long ✅';
        }
        if (mosDecision === 'short' && failed.short.length === 0) {
            direction = 'short';
            reason = mosReason + ' + sniper short ✅';
        }
        // Reversals (with MOS filters to avoid strong trends)
        if (failed.shortReversal.length === 0 && mos > mosThresholdReversalBlockLong) {
            direction = 'long';
            reason = (reason ? reason + ' | ' : '') + 'reversal long ✅';
        }
        if (failed.longReversal.length === 0 && mos < mosThresholdReversalBlockShort) {
            direction = 'short';
            reason = (reason ? reason + ' | ' : '') + 'reversal short ✅';
        }
        // Bearish long and bullish short (MOS-biased, for semi-counter in weaker conditions)
        if (mosDecision === 'long' && failed.bearishlong.length === 0) {
            direction = 'long';
            reason = (reason ? reason + ' | ' : '') + 'bearish long ✅';
        }
        if (mosDecision === 'short' && failed.bullishshort.length === 0) {
            direction = 'short';
            reason = (reason ? reason + ' | ' : '') + 'bullish short ✅';
        }
        if (!direction) {
            return {
                ...res30m,
                shouldOpen: false,
                passed: false,
                reason: `✖️ Signal rejected:\n(${mosDecision}) ${mosReason}\n` +
                    Object.entries(failed).map(([k, v]) => `(${k}): ${v.join('; ')}`).join('\n'),
                confidence: 'low',
                logged: false,
                mos,
            };
        }
        // Dynamic TP/SL based on ATR
        const slMultiplier = 1;
        const tpMultiplier = 2;
        const slDistance = atrValue * slMultiplier;
        const tpDistance = atrValue * tpMultiplier;
        const rrrCalc = tpMultiplier / slMultiplier;
        return {
            ...res30m,
            shouldOpen: true,
            passed: true,
            reason,
            direction,
            entryType: direction,
            confidence: 'high',
            triggeredBy: 'evaluateSignalOnly',
            logged: false,
            leverage: p0.leverage,
            sl: slDistance,
            tp: tpDistance,
            rrr: rrrCalc,
            mos
        };
    }
    catch (err) {
        console.error(`❌ Error evaluating sniper signal for ${symbol}`, err);
        return {
            shouldOpen: false,
            reason: 'error',
            confidence: 'low',
            logged: false,
            signalScore: 0, emaFast: 0, emaSlow: 0,
            atrValue: 0, adxValue: 0, adxPrev: 0,
            macdValue: 0, macdHist: 0, macdHistPrev: 0,
            rsiValue: 0, rsiTrend: [], marketRegime: 'neutral',
            volumePct: 0, priceTrend: () => null, priceSlope: 0,
            mos: 0
        };
    }
}
//# sourceMappingURL=strategyEngine.js.map