import type { Regime } from "./regime";
import { client } from "./hyperliquid";
type HyperliquidClient = typeof client;
export interface TP_SL {
    tp: number;
    sl: number;
    rrr: number;
    halfATRThreshold: number;
    trailOffset: number;
    finalTP: number;
}
export declare function getDynamicTP_SL({ symbol, regime, atr, entryPrice, leverage }: {
    symbol: string;
    regime: Regime;
    atr: number;
    entryPrice: number;
    leverage: number;
}): TP_SL;
export declare function checkAndCloseForTP({ client, account, closePosition, profitGoal }: {
    client: HyperliquidClient;
    account: any;
    profitGoal?: number;
    closePosition: (symbol: string, pos: any, reason: string, price: number) => Promise<void>;
}): Promise<{
    closedAny: boolean;
    closedCount: number;
}>;
export {};
//# sourceMappingURL=tpsl.d.ts.map