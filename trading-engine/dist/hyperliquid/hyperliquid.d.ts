import * as hl from "@nktkas/hyperliquid";
export declare const account: {
    readonly address: any;
    signMessage: (message: any) => any;
    signTypedData: (typedData: any) => any;
};
export declare const transport: hl.HttpTransport;
export declare const publicClient: hl.PublicClient<hl.HttpTransport>;
export declare function getWalletClient(): hl.WalletClient;
export declare function fetchPrice(symbol: string): Promise<number>;
export declare function getPositions(): Promise<any[]>;
export declare function closePosition(symbol: string, pos: any, reason: string, price: number | undefined): Promise<void>;
export declare function closeAllPositions(): Promise<{
    success: boolean;
    message: string;
    closedCount: number;
    errorCount?: undefined;
    totalPositions?: undefined;
    error?: undefined;
} | {
    success: boolean;
    message: string;
    closedCount: number;
    errorCount: number;
    totalPositions: number;
    error?: undefined;
} | {
    success: boolean;
    error: string;
    closedCount: number;
    errorCount: number;
    totalPositions: number;
    message?: undefined;
}>;
export declare function getTotalPnL(): Promise<number>;
export declare function recordLiquidatedTrades(): Promise<void>;
export declare function recordExistingPositionsAsTrades(): Promise<void>;
export declare function runSignalCheckAndOpen({ symbol, perPositionBudget, regimeOverride, leverage }: {
    symbol: string;
    perPositionBudget: number;
    regimeOverride?: string;
    leverage: number;
}): Promise<{
    signalScore: number;
    positionOpened: boolean;
    marketRegime: string;
    reason: string;
}>;
export declare function initBlockchain(): Promise<void>;
export declare const client: hl.PublicClient<hl.HttpTransport>;
export declare const priceFeeds: {
    BTC: string;
    ETH: string;
    BNB: string;
    SOL: string;
    DOGE: string;
    ADA: string;
    AVAX: string;
    ATOM: string;
    FIL: string;
    NEAR: string;
    OP: string;
    MKR: string;
    IMX: string;
    ARB: string;
    ALGO: string;
    AAVE: string;
    SAND: string;
    GALA: string;
    COMP: string;
    SNX: string;
    SUSHI: string;
    FET: string;
    SUI: string;
    PYTH: string;
    JUP: string;
    WIF: string;
    WLD: string;
    TAO: string;
    EIGEN: string;
};
//# sourceMappingURL=hyperliquid.d.ts.map