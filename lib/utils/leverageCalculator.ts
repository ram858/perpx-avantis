/**
 * Calculate appropriate leverage based on balance/budget
 * 
 * Rules:
 * - $10-20: 2x-3x leverage (conservative for low balances)
 * - $20-50: 5x leverage (default)
 * - $50+: 5x-50x (can use higher leverage with more capital)
 */

export function calculateLeverageFromBalance(balance: number, userSpecifiedLeverage?: number): number {
  // If user specified leverage, use it (within valid range)
  if (userSpecifiedLeverage && userSpecifiedLeverage >= 2 && userSpecifiedLeverage <= 50) {
    return userSpecifiedLeverage;
  }

  // Balance-based leverage calculation
  if (balance >= 10 && balance <= 20) {
    // Low balance: use conservative 2x-3x leverage
    // Use 2x for $10-15, 3x for $15-20
    return balance <= 15 ? 2 : 3;
  } else if (balance > 20 && balance < 50) {
    // Medium balance: use default 5x
    return 5;
  } else if (balance >= 50) {
    // Higher balance: can use up to 5x as default (user can increase if needed)
    return 5;
  } else {
    // Very low balance (< $10): use minimum 2x
    return 2;
  }
}

/**
 * Get default leverage (5x) when no balance is available
 */
export function getDefaultLeverage(): number {
  return 5;
}

