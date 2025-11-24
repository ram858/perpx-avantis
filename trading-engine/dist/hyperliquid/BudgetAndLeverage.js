"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBudgetAndLeverage = getBudgetAndLeverage;
exports.getSymbolLeverageLimit = getSymbolLeverageLimit;
exports.validateLeverage = validateLeverage;
exports.getMaxLeverageForSymbol = getMaxLeverageForSymbol;
exports.getLeverageTiersForSymbol = getLeverageTiersForSymbol;
exports.calculateBudgetLimits = calculateBudgetLimits;
exports.validateAndCapBudget = validateAndCapBudget;
const adaptiveConfig_json_1 = __importDefault(require("./adaptiveConfig.json"));
// Hyperliquid SDK budget limits
const HYPERLIQUID_BUDGET_LIMITS = {
    MIN_BUDGET_PER_POSITION: 1, // $1 minimum per position
    MAX_BUDGET_PER_POSITION: 1000000, // $1M maximum per position (conservative)
    MIN_TOTAL_BUDGET: 10, // $10 minimum total budget
    MAX_TOTAL_BUDGET: 10000000 // $10M maximum total budget (conservative)
};
function getBudgetAndLeverage(regime, symbol, userBudget) {
    // Use user's budget - no fallback to regime-based budget
    const budget = userBudget ?? 200; // Default to $200 if no user budget provided
    // Get symbol-specific leverage limit if available - use MAX leverage
    let leverage = 50; // Default high leverage
    if (symbol && adaptiveConfig_json_1.default.hyperliquidLeverageLimits && symbol in adaptiveConfig_json_1.default.hyperliquidLeverageLimits) {
        const symbolConfig = adaptiveConfig_json_1.default.hyperliquidLeverageLimits[symbol];
        const symbolMaxLeverage = symbolConfig.maxLeverage;
        // Use MAXIMUM leverage for all symbols - no regime-based reduction
        leverage = symbolMaxLeverage;
        console.log(`🎯 ${symbol} max leverage: ${leverage}x`);
    }
    // Apply only minimum safety limit, allow maximum leverage
    const minLeverage = adaptiveConfig_json_1.default.leverageSafetySettings?.minLeverage ?? 1;
    leverage = Math.max(minLeverage, leverage);
    return { budget, leverage };
}
function getSymbolLeverageLimit(symbol, positionSize) {
    if (!adaptiveConfig_json_1.default.hyperliquidLeverageLimits || !(symbol in adaptiveConfig_json_1.default.hyperliquidLeverageLimits)) {
        return 50; // Default high leverage
    }
    const symbolConfig = adaptiveConfig_json_1.default.hyperliquidLeverageLimits[symbol];
    // Handle tiered leverage - use the highest tier available
    if (symbolConfig.tiered && symbolConfig.tiers && positionSize) {
        // Find the highest leverage tier for the position size
        let maxLeverage = 0;
        for (const tier of symbolConfig.tiers) {
            if (positionSize >= tier.lowerBound && tier.maxLeverage > maxLeverage) {
                maxLeverage = tier.maxLeverage;
            }
        }
        return maxLeverage > 0 ? maxLeverage : symbolConfig.maxLeverage;
    }
    return symbolConfig.maxLeverage;
}
function validateLeverage(symbol, leverage, positionSize) {
    const symbolLimit = getSymbolLeverageLimit(symbol, positionSize);
    const globalMin = adaptiveConfig_json_1.default.leverageSafetySettings?.minLeverage ?? 1;
    // Allow maximum leverage up to symbol limit
    const maxAllowed = symbolLimit;
    if (leverage < globalMin) {
        return {
            isValid: false,
            maxAllowed,
            reason: `Leverage ${leverage} is below minimum allowed ${globalMin}`
        };
    }
    if (leverage > maxAllowed) {
        return {
            isValid: false,
            maxAllowed,
            reason: `Leverage ${leverage} exceeds maximum allowed ${maxAllowed} for ${symbol}`
        };
    }
    return { isValid: true, maxAllowed };
}
// New function to get maximum leverage for a symbol
function getMaxLeverageForSymbol(symbol) {
    if (!adaptiveConfig_json_1.default.hyperliquidLeverageLimits || !(symbol in adaptiveConfig_json_1.default.hyperliquidLeverageLimits)) {
        return 50; // Default high leverage
    }
    const symbolConfig = adaptiveConfig_json_1.default.hyperliquidLeverageLimits[symbol];
    return symbolConfig.maxLeverage;
}
// New function to get all available leverage tiers for a symbol
function getLeverageTiersForSymbol(symbol) {
    if (!adaptiveConfig_json_1.default.hyperliquidLeverageLimits || !(symbol in adaptiveConfig_json_1.default.hyperliquidLeverageLimits)) {
        return [{ lowerBound: 0, maxLeverage: 50 }];
    }
    const symbolConfig = adaptiveConfig_json_1.default.hyperliquidLeverageLimits[symbol];
    if (symbolConfig.tiered && symbolConfig.tiers) {
        return symbolConfig.tiers;
    }
    return [{ lowerBound: 0, maxLeverage: symbolConfig.maxLeverage }];
}
// New function to calculate budget limits based on Hyperliquid SDK
function calculateBudgetLimits(totalBudget, maxPositions) {
    // Validate total budget
    if (totalBudget < HYPERLIQUID_BUDGET_LIMITS.MIN_TOTAL_BUDGET) {
        return {
            minBudgetPerPosition: HYPERLIQUID_BUDGET_LIMITS.MIN_BUDGET_PER_POSITION,
            maxBudgetPerPosition: HYPERLIQUID_BUDGET_LIMITS.MAX_BUDGET_PER_POSITION,
            recommendedBudgetPerPosition: HYPERLIQUID_BUDGET_LIMITS.MIN_BUDGET_PER_POSITION,
            isValid: false,
            reason: `Total budget $${totalBudget} is below minimum $${HYPERLIQUID_BUDGET_LIMITS.MIN_TOTAL_BUDGET}`
        };
    }
    if (totalBudget > HYPERLIQUID_BUDGET_LIMITS.MAX_TOTAL_BUDGET) {
        return {
            minBudgetPerPosition: HYPERLIQUID_BUDGET_LIMITS.MIN_BUDGET_PER_POSITION,
            maxBudgetPerPosition: HYPERLIQUID_BUDGET_LIMITS.MAX_BUDGET_PER_POSITION,
            recommendedBudgetPerPosition: HYPERLIQUID_BUDGET_LIMITS.MAX_BUDGET_PER_POSITION,
            isValid: false,
            reason: `Total budget $${totalBudget} exceeds maximum $${HYPERLIQUID_BUDGET_LIMITS.MAX_TOTAL_BUDGET}`
        };
    }
    // Calculate per-position budget
    const rawBudgetPerPosition = totalBudget / maxPositions;
    // Apply Hyperliquid SDK limits
    const minBudgetPerPosition = HYPERLIQUID_BUDGET_LIMITS.MIN_BUDGET_PER_POSITION;
    const maxBudgetPerPosition = Math.min(HYPERLIQUID_BUDGET_LIMITS.MAX_BUDGET_PER_POSITION, totalBudget // Can't exceed total budget
    );
    // Cap the recommended budget within limits
    const recommendedBudgetPerPosition = Math.max(minBudgetPerPosition, Math.min(maxBudgetPerPosition, rawBudgetPerPosition));
    const isValid = recommendedBudgetPerPosition >= minBudgetPerPosition &&
        recommendedBudgetPerPosition <= maxBudgetPerPosition;
    return {
        minBudgetPerPosition,
        maxBudgetPerPosition,
        recommendedBudgetPerPosition,
        isValid,
        reason: isValid ? undefined : `Budget per position $${recommendedBudgetPerPosition} is outside valid range`
    };
}
// Avantis minimum collateral requirement
const AVANTIS_MIN_COLLATERAL = 11.5; // USDC
// New function to validate and cap budget per position
function validateAndCapBudget(totalBudget, maxPositions, symbol, platform = 'avantis' // Default to Avantis for web trading
) {
    const budgetLimits = calculateBudgetLimits(totalBudget, maxPositions);
    const warnings = [];
    // Use platform-specific minimum
    const minRequired = platform === 'avantis' ? AVANTIS_MIN_COLLATERAL : HYPERLIQUID_BUDGET_LIMITS.MIN_BUDGET_PER_POSITION;
    if (!budgetLimits.isValid) {
        return {
            budgetPerPosition: budgetLimits.recommendedBudgetPerPosition,
            isValid: false,
            reason: budgetLimits.reason,
            warnings
        };
    }
    // Check if budget per position meets platform minimum
    if (budgetLimits.recommendedBudgetPerPosition < minRequired) {
        return {
            budgetPerPosition: budgetLimits.recommendedBudgetPerPosition,
            isValid: false,
            reason: `Budget per position $${budgetLimits.recommendedBudgetPerPosition.toFixed(2)} is below ${platform === 'avantis' ? 'Avantis' : 'Hyperliquid'} minimum $${minRequired}. Total budget $${totalBudget} with ${maxPositions} positions = $${(totalBudget / maxPositions).toFixed(2)} per position. Increase budget to at least $${(minRequired * maxPositions).toFixed(2)} or reduce max positions to ${Math.floor(totalBudget / minRequired)}.`,
            warnings
        };
    }
    // Check if budget is too small for effective trading (below recommended)
    if (budgetLimits.recommendedBudgetPerPosition < minRequired * 1.5) {
        warnings.push(`Budget per position $${budgetLimits.recommendedBudgetPerPosition.toFixed(2)} is close to ${platform === 'avantis' ? 'Avantis' : 'Hyperliquid'} minimum $${minRequired}. Consider increasing total budget for better position sizing.`);
    }
    // Check if budget is very large (risk warning)
    if (budgetLimits.recommendedBudgetPerPosition > 10000) {
        warnings.push(`High budget per position: $${budgetLimits.recommendedBudgetPerPosition.toFixed(2)}. Ensure proper risk management.`);
    }
    const result = {
        budgetPerPosition: budgetLimits.recommendedBudgetPerPosition,
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
    };
    return result;
}
//# sourceMappingURL=BudgetAndLeverage.js.map