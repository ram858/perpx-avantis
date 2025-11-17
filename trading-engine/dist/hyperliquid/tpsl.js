"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDynamicTP_SL = getDynamicTP_SL;
exports.checkAndCloseForTP = checkAndCloseForTP;
// tpsl.ts
const aiStorage_1 = require("./aiStorage");
const hyperliquid_1 = require("./hyperliquid");
// Simple logTrade function to replace the deleted tradeLogger
function logTrade(tradeData) {
    console.log(`📊 Trade Log: ${tradeData.symbol} | ${tradeData.direction} | Entry: $${tradeData.entryPrice} | Exit: $${tradeData.exitPrice} | PnL: ${tradeData.pnlPct.toFixed(2)}% | Result: ${tradeData.result}`);
}
const winRateTracker_1 = require("./winRateTracker");
function getDynamicTP_SL({ symbol, regime, atr, entryPrice, leverage }) {
    const slPct = 60 / leverage / 100;
    const sl = entryPrice * slPct;
    let rrr = 10.0; // Flat default for now (can adjust per regime)
    const tp = sl * rrr;
    if (sl <= 0 || tp <= 0 || !isFinite(sl) || !isFinite(tp)) {
        console.warn(`⚠️ Invalid TP/SL computed for ${symbol} @ ${regime}: TP=${tp}, SL=${sl}`);
        return {
            tp: 0, sl: 0, rrr: 0, halfATRThreshold: 0, trailOffset: 0, finalTP: 0
        };
    }
    return {
        tp,
        sl,
        rrr,
        halfATRThreshold: atr * 0.5,
        trailOffset: atr * 0.4,
        finalTP: atr * 6.0
    };
}
async function checkAndCloseForTP({ client, account, closePosition, profitGoal }) {
    const address = account.address;
    const state = await client.clearinghouseState({ user: address });
    const positions = (state?.assetPositions ?? []).map(p => ({
        ...p,
        coin: p?.position?.coin,
        side: "side" in p?.position ? p.position.side.toLowerCase() : "unknown",
        entryPx: p?.position?.entryPx,
        szi: p?.position?.szi
    }));
    let closedAny = false;
    let closedCount = 0;
    for (const pos of positions) {
        if (!pos.coin || !pos.entryPx || !pos.szi)
            continue;
        const symbol = Object.keys(hyperliquid_1.priceFeeds).find((s) => pos.coin.includes(s));
        if (!symbol)
            continue;
        const stored = (0, aiStorage_1.getAIPOS)(symbol);
        if (!stored)
            continue;
        // Use Hyperliquid SDK position data directly
        // The entryPx from API is already in the correct format, no need to divide by 1e10
        const entryPrice = Number(pos.entryPx);
        const positionSize = Number(pos.szi);
        // Determine if it's a long position based on size (positive = long, negative = short)
        const isLong = positionSize > 0;
        if (!entryPrice || !positionSize) {
            console.error(`❌ Invalid position data for ${symbol}: entry=${entryPrice}, size=${positionSize}`);
            continue;
        }
        const mark = await (0, hyperliquid_1.fetchPrice)(symbol);
        if (!mark)
            continue;
        // Calculate PnL using Hyperliquid SDK formula
        // PnL = Position Size * (Mark Price - Entry Price) * Direction
        const priceChange = mark - entryPrice;
        const pnl = positionSize * priceChange * (isLong ? 1 : -1);
        // Debug logging for PnL calculation
        if (profitGoal) {
            const priceChangePct = (priceChange / entryPrice) * 100;
            const pnlStr = pnl.toFixed(2);
            const priceChangeStr = priceChangePct.toFixed(2);
            console.log(`🔍 ${symbol} PnL Debug: Entry=${entryPrice}, Mark=${mark}, Size=${positionSize}, PriceChange=${priceChangeStr}%, Direction=${isLong ? 'LONG' : 'SHORT'}, PnL=$${pnlStr}, Goal=$${profitGoal}`);
        }
        // Only close if position is liquidated (individual profit goals disabled for total PnL strategy)
        const priceChangePct = ((mark - entryPrice) / entryPrice) * 100;
        const isLiquidated = priceChangePct <= -99.5;
        const shouldClose = isLiquidated;
        if (shouldClose) {
            const result = "liquidated";
            const reason = "liquidated_exit";
            try {
                await closePosition(symbol, pos, reason, mark);
                // Record liquidation in win rate tracker
                winRateTracker_1.winRateTracker.recordTradeLiquidated(symbol, mark, pnl);
            }
            catch (e) {
                console.warn(`❌ Failed to close ${symbol}:`, e);
            }
            logTrade({
                symbol,
                direction: isLong ? "long" : "short",
                entryPrice: stored.entryPrice,
                exitPrice: mark,
                pnlPct: ((mark - entryPrice) / entryPrice) * 100,
                result,
                marketRegime: stored.marketRegime,
                signalScore: stored.signalScore,
                rsi: stored.rsi,
                macdHist: stored.macdHist,
                emaSlope: stored.emaSlope,
                atrPct: stored.atrPct,
                atr: stored.atr,
                adx: stored.adx,
                adxSlope: stored.adxSlope ?? 0,
                volumePct: stored.volumePct ?? 0,
                divergenceScore: stored.divergenceScore ?? 0,
                leverage: stored.leverage,
                tradeType: stored.tradeType ?? "standard",
                closedBy: reason,
                triggeredBy: stored.triggeredBy ?? "",
                note: stored.note ?? "",
                entryReason: stored.entryReason ?? "",
                tp: 0, // No TP/SL used when profit goal is active
                sl: 0,
                rrr: 0,
                breakevenActivated: stored.breakevenActivated ?? false,
                trailingTPPct: stored.trailingTPPct ?? 0,
                phase: stored.phase ?? "init",
                highestFav: stored.highestFav,
                lowestFav: stored.lowestFav,
                perPositionBudget: stored.perPositionBudget ?? 0
            });
            await (0, aiStorage_1.removeAIPOS)(symbol);
            closedAny = true;
            closedCount++;
        }
        else {
            // Update stored position data without closing
            (0, aiStorage_1.recordAIPOS)(symbol, stored.entryPrice, stored.txHash, stored.signalScore, stored.marketRegime, 0, // No TP when profit goal is active
            0, // No SL when profit goal is active
            stored.rsi, stored.macdHist, stored.emaSlope, stored.atrPct, stored.leverage, stored.atr, stored.adx, stored.adxSlope, stored.volumePct, stored.perPositionBudget, stored.breakevenActivated, stored.trailingTPPct, stored.divergenceScore, stored.tradeType, stored.note, stored.phase, stored.highestFav, stored.lowestFav, undefined, // slPrice
            stored.triggeredBy, stored.entryReason);
        }
    }
    return { closedAny, closedCount };
}
//# sourceMappingURL=tpsl.js.map