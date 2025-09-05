import adaptiveConfig from './adaptiveConfig.json';
import { Regime } from './regime';

// Hyperliquid SDK budget limits
const HYPERLIQUID_BUDGET_LIMITS = {
  MIN_BUDGET_PER_POSITION: 1, // $1 minimum per position
  MAX_BUDGET_PER_POSITION: 1000000, // $1M maximum per position (conservative)
  MIN_TOTAL_BUDGET: 10, // $10 minimum total budget
  MAX_TOTAL_BUDGET: 10000000 // $10M maximum total budget (conservative)
};

export function getBudgetAndLeverage(regime: Regime, symbol?: string, userBudget?: number): {
  budget: number;
  leverage: number;
} {
  // Use user's budget - no fallback to regime-based budget
  const budget = userBudget ?? 200; // Default to $200 if no user budget provided
  

  
  // Get symbol-specific leverage limit if available - use MAX leverage
  let leverage = 50; // Default high leverage
  
  if (symbol && adaptiveConfig.hyperliquidLeverageLimits && symbol in adaptiveConfig.hyperliquidLeverageLimits) {
    const symbolConfig = (adaptiveConfig.hyperliquidLeverageLimits as any)[symbol];
    const symbolMaxLeverage = symbolConfig.maxLeverage;
    
    // Use MAXIMUM leverage for all symbols - no regime-based reduction
    leverage = symbolMaxLeverage;
    
    console.log(`🎯 ${symbol} max leverage: ${leverage}x`);
  }
  
  // Apply only minimum safety limit, allow maximum leverage
  const minLeverage = adaptiveConfig.leverageSafetySettings?.minLeverage ?? 1;
  leverage = Math.max(minLeverage, leverage);

  return { budget, leverage };
}

export function getSymbolLeverageLimit(symbol: string, positionSize?: number): number {
  if (!adaptiveConfig.hyperliquidLeverageLimits || !(symbol in adaptiveConfig.hyperliquidLeverageLimits)) {
    return 50; // Default high leverage
  }

  const symbolConfig = (adaptiveConfig.hyperliquidLeverageLimits as any)[symbol];

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



export function validateLeverage(symbol: string, leverage: number, positionSize?: number): {
  isValid: boolean;
  maxAllowed: number;
  reason?: string;
} {
  const symbolLimit = getSymbolLeverageLimit(symbol, positionSize);
  const globalMin = adaptiveConfig.leverageSafetySettings?.minLeverage ?? 1;
  
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
export function getMaxLeverageForSymbol(symbol: string): number {
  if (!adaptiveConfig.hyperliquidLeverageLimits || !(symbol in adaptiveConfig.hyperliquidLeverageLimits)) {
    return 50; // Default high leverage
  }

  const symbolConfig = (adaptiveConfig.hyperliquidLeverageLimits as any)[symbol];
  return symbolConfig.maxLeverage;
}

// New function to get all available leverage tiers for a symbol
export function getLeverageTiersForSymbol(symbol: string): Array<{lowerBound: number, maxLeverage: number}> {
  if (!adaptiveConfig.hyperliquidLeverageLimits || !(symbol in adaptiveConfig.hyperliquidLeverageLimits)) {
    return [{ lowerBound: 0, maxLeverage: 50 }];
  }

  const symbolConfig = (adaptiveConfig.hyperliquidLeverageLimits as any)[symbol];
  if (symbolConfig.tiered && symbolConfig.tiers) {
    return symbolConfig.tiers;
  }

  return [{ lowerBound: 0, maxLeverage: symbolConfig.maxLeverage }];
}

// New function to calculate budget limits based on Hyperliquid SDK
export function calculateBudgetLimits(
  totalBudget: number, 
  maxPositions: number
): {
  minBudgetPerPosition: number;
  maxBudgetPerPosition: number;
  recommendedBudgetPerPosition: number;
  isValid: boolean;
  reason?: string;
} {
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
  const maxBudgetPerPosition = Math.min(
    HYPERLIQUID_BUDGET_LIMITS.MAX_BUDGET_PER_POSITION,
    totalBudget // Can't exceed total budget
  );

  // Cap the recommended budget within limits
  const recommendedBudgetPerPosition = Math.max(
    minBudgetPerPosition,
    Math.min(maxBudgetPerPosition, rawBudgetPerPosition)
  );

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

// New function to validate and cap budget per position
export function validateAndCapBudget(
  totalBudget: number,
  maxPositions: number,
  symbol?: string
): {
  budgetPerPosition: number;
  isValid: boolean;
  reason?: string;
  warnings?: string[];
} {
  const budgetLimits = calculateBudgetLimits(totalBudget, maxPositions);
  const warnings: string[] = [];



  if (!budgetLimits.isValid) {
    return {
      budgetPerPosition: budgetLimits.recommendedBudgetPerPosition,
      isValid: false,
      reason: budgetLimits.reason,
      warnings
    };
  }

  // Check if budget is too small for effective trading
  if (budgetLimits.recommendedBudgetPerPosition < 10) {
    warnings.push(`Low budget per position: $${budgetLimits.recommendedBudgetPerPosition}. Consider increasing total budget or reducing max positions.`);
  }

  // Check if budget is very large (risk warning)
  if (budgetLimits.recommendedBudgetPerPosition > 10000) {
    warnings.push(`High budget per position: $${budgetLimits.recommendedBudgetPerPosition}. Ensure proper risk management.`);
  }

  const result = {
    budgetPerPosition: budgetLimits.recommendedBudgetPerPosition,
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };

  return result;
}
