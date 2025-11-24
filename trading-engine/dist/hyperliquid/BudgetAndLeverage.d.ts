import { Regime } from './regime';
export declare function getBudgetAndLeverage(regime: Regime, symbol?: string, userBudget?: number): {
    budget: number;
    leverage: number;
};
export declare function getSymbolLeverageLimit(symbol: string, positionSize?: number): number;
export declare function validateLeverage(symbol: string, leverage: number, positionSize?: number): {
    isValid: boolean;
    maxAllowed: number;
    reason?: string;
};
export declare function getMaxLeverageForSymbol(symbol: string): number;
export declare function getLeverageTiersForSymbol(symbol: string): Array<{
    lowerBound: number;
    maxLeverage: number;
}>;
export declare function calculateBudgetLimits(totalBudget: number, maxPositions: number): {
    minBudgetPerPosition: number;
    maxBudgetPerPosition: number;
    recommendedBudgetPerPosition: number;
    isValid: boolean;
    reason?: string;
};
export declare function validateAndCapBudget(totalBudget: number, maxPositions: number, symbol?: string, platform?: 'hyperliquid' | 'avantis'): {
    budgetPerPosition: number;
    isValid: boolean;
    reason?: string;
    warnings?: string[];
};
//# sourceMappingURL=BudgetAndLeverage.d.ts.map