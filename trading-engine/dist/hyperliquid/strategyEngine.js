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
        const mosThresholdLong = 0.1; // Loosened for testing
        const mosThresholdShort = -0.1; // Loosened for testing
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
        // Skip in neutral regime with very low ADX (loosened from 15 → 10)
        if (marketRegime === 'neutral' && adx < 10) {
            return {
                ...res30m,
                shouldOpen: false,
                passed: false,
                reason: '✖️ Signal rejected: Neutral regime with low ADX',
                confidence: 'low',
                logged: false,
                mos,
            };
        }
        // --- Sniper & Reversal conditions ---
        const sniperConditions = {
            long: {
                signalScore: { value: signalScore, pass: signalScore > 0.1, expected: '> 0.1' }, // Much looser
                rsi: { value: rsi, pass: rsi >= 15 && rsi <= 75, expected: '15–75' }, // Wider range
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > -0.5, expected: '> -0.5' }, // Allow some decline
                atr: { value: atrPct, pass: atrPct > 0.05, expected: '> 0.05%' }, // Much lower volatility requirement
                adx: { value: adx, pass: adx > 8, expected: '> 8' }, // Lower trend strength requirement
                priceSlope: { value: priceSlopePct, pass: priceSlopePct > -0.01, expected: '> -1%' }, // Allow more decline
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h > -0.015, expected: '> -1.5%' }, // Allow more decline
                volumePct: { value: volumePct, pass: volumePct > 0.001, expected: '> 0.1%' }, // Much lower volume requirement
                candlePos5m: {
                    value: candlePos5m,
                    pass: ['bottom', 'anticipation_bottom', 'doji_bottom', 'middle', 'top'].includes(candlePos5m), // Allow more positions
                    expected: 'bottom/anticipation_bottom/doji_bottom/middle/top',
                },
            },
            short: {
                signalScore: { value: signalScore, pass: signalScore > 0.1, expected: '> 0.1' }, // Much looser
                rsi: { value: rsi, pass: rsi >= 25 && rsi <= 85, expected: '25–85' }, // Wider range
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 0.5, expected: '< 0.5' }, // Allow some increase
                atr: { value: atrPct, pass: atrPct > 0.05, expected: '> 0.05%' }, // Much lower volatility requirement
                adx: { value: adx, pass: adx > 8, expected: '> 8' }, // Lower trend strength requirement
                priceSlope: { value: priceSlopePct, pass: priceSlopePct < 0.01, expected: '< 1%' }, // Allow more increase
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h < 0.015, expected: '< 1.5%' }, // Allow more increase
                volumePct: { value: volumePct, pass: volumePct > 0.001, expected: '> 0.1%' }, // Much lower volume requirement
                candlePos5m: {
                    value: candlePos5m,
                    pass: ['top', 'anticipation_top', 'doji_top', 'middle', 'bottom'].includes(candlePos5m), // Allow more positions
                    expected: 'top/anticipation_top/doji_top/middle/bottom',
                },
            },
            longReversal: {
                signalScore: { value: signalScore, pass: signalScore > 0.5, expected: '> 0.5' }, // Slightly loosened
                rsi: { value: rsi, pass: rsi > 85, expected: '> 85' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > 0, expected: '> 0' },
                atr: { value: atrPct, pass: atrPct > 0.2, expected: '> 0.2%' }, // Loosened
                adx: { value: adx, pass: adx > 20, expected: '> 20' },
                adxSlope: { value: adxSlope, pass: adxSlope < 0, expected: '< 0 (weakening)' },
                divergence: { value: divergenceScore, pass: divergenceScore > 0.5, expected: '> 0.5' },
                priceSlope: { value: priceSlopePct, pass: priceSlopePct <= 0, expected: '<= 0%' },
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h <= 0, expected: '<= 0%' },
                volumePct: { value: volumePct, pass: volumePct > 0.002, expected: '> 0.002' }, // Loosened
                candlePos5m: {
                    value: candlePos5m,
                    pass: ['top', 'anticipation_top', 'shooting_star_top'].includes(candlePos5m) && candleColor5m === 'green',
                    expected: 'top/anticipation_top/shooting_star of green candle',
                },
            },
            shortReversal: {
                signalScore: { value: signalScore, pass: signalScore > 0.5, expected: '> 0.5' }, // Slightly loosened
                rsi: { value: rsi, pass: rsi < 15, expected: '< 15' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 0, expected: '< 0' },
                atr: { value: atrPct, pass: atrPct > 0.2, expected: '> 0.2%' }, // Loosened
                adx: { value: adx, pass: adx > 20, expected: '> 20' },
                adxSlope: { value: adxSlope, pass: adxSlope < 0, expected: '< 0 (weakening)' },
                divergence: { value: divergenceScore, pass: divergenceScore > 0.5, expected: '> 0.5' },
                priceSlope: { value: priceSlopePct, pass: priceSlopePct >= 0, expected: '>= 0%' },
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h >= 0, expected: '>= 0%' },
                volumePct: { value: volumePct, pass: volumePct > 0.002, expected: '> 0.002' }, // Loosened
                candlePos5m: {
                    value: candlePos5m,
                    pass: ['bottom', 'anticipation_bottom', 'hammer_bottom'].includes(candlePos5m) && candleColor5m === 'red',
                    expected: 'bottom/anticipation_bottom/hammer of red candle',
                },
            },
            bearishlong: {
                signalScore: { value: signalScore, pass: signalScore > 0.4, expected: '> 0.4' }, // Loosened
                rsi: { value: rsi, pass: rsi >= 20 && rsi <= 50, expected: '20–50' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m > 0, expected: '> 0' },
                atr: { value: atrPct, pass: atrPct > 0.2, expected: '> 0.2%' }, // Loosened
                adx: { value: adx, pass: adx > 15, expected: '> 15' }, // Loosened
                divergence: { value: divergenceScore, pass: divergenceScore > 0.15, expected: '> 0.15' }, // Loosened
                priceSlope: { value: priceSlopePct, pass: priceSlopePct > -0.002, expected: '> -0.2%' }, // Loosened
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h > -0.002, expected: '> -0.2%' }, // Loosened
                volumePct: { value: volumePct, pass: volumePct > 0.002, expected: '> 0.002' }, // Loosened
                candlePos5m: {
                    value: candlePos5m,
                    pass: ['bottom', 'anticipation_bottom', 'doji_bottom'].includes(candlePos5m) && candleColor5m === 'red',
                    expected: 'bottom/anticipation_bottom/doji_bottom of red candle',
                },
            },
            bullishshort: {
                signalScore: { value: signalScore, pass: signalScore > 0.4, expected: '> 0.4' }, // Loosened
                rsi: { value: rsi, pass: rsi >= 50 && rsi <= 80, expected: '50–80' },
                rsiSlope: { value: rsiSlope30m, pass: rsiSlope30m < 0, expected: '< 0' },
                atr: { value: atrPct, pass: atrPct > 0.2, expected: '> 0.2%' }, // Loosened
                adx: { value: adx, pass: adx > 15, expected: '> 15' }, // Loosened
                divergence: { value: divergenceScore, pass: divergenceScore > 0.15, expected: '> 0.15' }, // Loosened
                priceSlope: { value: priceSlopePct, pass: priceSlopePct < 0.002, expected: '< 0.2%' }, // Loosened
                trendSlope1h: { value: trendSlopePct1h, pass: trendSlopePct1h < 0.002, expected: '< 0.2%' }, // Loosened
                volumePct: { value: volumePct, pass: volumePct > 0.002, expected: '> 0.002' }, // Loosened
                candlePos5m: {
                    value: candlePos5m,
                    pass: ['top', 'anticipation_top', 'doji_top'].includes(candlePos5m) && candleColor5m === 'green',
                    expected: 'top/anticipation_top/doji_top of green candle',
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