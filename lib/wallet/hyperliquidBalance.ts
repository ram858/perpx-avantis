import * as hl from "@nktkas/hyperliquid";

// Create Hyperliquid testnet client with proper configuration
const transport = new hl.HttpTransport({ 
  isTestnet: true
});
const publicClient = new hl.PublicClient({ transport });


export interface HyperliquidBalance {
  totalValue: number;
  availableBalance: number;
  marginUsed: number;
  positions: Array<{
    symbol: string;
    size: number;
    entryPrice: number;
    markPrice: number;
    pnl: number;
  }>;
}

export async function getHyperliquidBalance(address: string): Promise<HyperliquidBalance> {
  try {
    // Normalize address format (ensure lowercase)
    const normalizedAddress = address.toLowerCase();
    
    // Get user state from Hyperliquid using clearinghouseState
    const userState = await publicClient.clearinghouseState({ user: normalizedAddress });
    
    
    if (!userState) {
      return {
        totalValue: 0,
        availableBalance: 0,
        marginUsed: 0,
        positions: []
      };
    }

    // Extract balance information from marginSummary
    const marginSummary = userState.marginSummary;
    
    // Try different possible field names for account value
    const accountValue = marginSummary?.accountValue || marginSummary?.accountValue || marginSummary?.totalValue || '0';
    const totalValue = parseFloat(accountValue);
    
    // Try different possible field names for available balance
    const availableBalanceValue = marginSummary?.totalMarginUsed || marginSummary?.availableBalance || marginSummary?.freeCollateral || '0';
    const availableBalance = parseFloat(availableBalanceValue);
    
    // Try different possible field names for margin used
    const marginUsedValue = marginSummary?.totalNtlPos || marginSummary?.marginUsed || marginSummary?.usedMargin || '0';
    const marginUsed = parseFloat(marginUsedValue);
    

    // Extract positions
    const positions = (userState.assetPositions || []).map((pos: any) => ({
      symbol: pos.position?.coin || 'Unknown',
      size: parseFloat(pos.position?.szi || '0'),
      entryPrice: parseFloat(pos.position?.entryPx || '0'),
      markPrice: parseFloat(pos.position?.positionValue || '0'),
      pnl: parseFloat(pos.position?.unrealizedPnl || '0')
    }));

    return {
      totalValue,
      availableBalance,
      marginUsed,
      positions
    };
  } catch (error) {
    console.error('[HyperliquidBalance] Error fetching balance:', error);
    // If we get an error, it likely means the wallet is not connected to Hyperliquid
    throw new Error(`Wallet not connected to Hyperliquid: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getHyperliquidBalanceUSD(address: string): Promise<number> {
  try {
    const balance = await getHyperliquidBalance(address);
    return balance.totalValue;
  } catch (error) {
    console.error('[HyperliquidBalance] Error fetching USD balance:', error);
    return 0;
  }
}

export async function hasRealHyperliquidBalance(address: string): Promise<{ hasBalance: boolean; balance: number; isConnected: boolean }> {
  try {
    const balance = await getHyperliquidBalance(address);
    const hasBalance = balance.totalValue > 0;
    const isConnected = true; // If we can fetch data, wallet is connected
    
    
    return {
      hasBalance,
      balance: balance.totalValue,
      isConnected
    };
  } catch (error) {
    console.error('[HyperliquidBalance] Error checking real balance:', error);
    // If we can't fetch data, wallet is not connected to Hyperliquid
    return {
      hasBalance: false,
      balance: 0,
      isConnected: false
    };
  }
}
