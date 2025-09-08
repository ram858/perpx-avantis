import * as hl from "@nktkas/hyperliquid";

// Create Hyperliquid testnet client
const transport = new hl.HttpTransport({ isTestnet: true });
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
    console.log('[HyperliquidBalance] Fetching balance for:', address);
    
    // Get user state from Hyperliquid using clearinghouseState
    const userState = await publicClient.clearinghouseState({ user: address });
    
    if (!userState) {
      console.log('[HyperliquidBalance] No user state found for address:', address);
      return {
        totalValue: 0,
        availableBalance: 0,
        marginUsed: 0,
        positions: []
      };
    }

    // Extract balance information from marginSummary
    const marginSummary = userState.marginSummary;
    const totalValue = parseFloat(marginSummary?.accountValue || '0');
    const availableBalance = parseFloat(marginSummary?.totalMarginUsed || '0');
    const marginUsed = parseFloat(marginSummary?.totalNtlPos || '0');

    // Extract positions
    const positions = (userState.assetPositions || []).map((pos: any) => ({
      symbol: pos.position?.coin || 'Unknown',
      size: parseFloat(pos.position?.szi || '0'),
      entryPrice: parseFloat(pos.position?.entryPx || '0'),
      markPrice: parseFloat(pos.position?.positionValue || '0'),
      pnl: parseFloat(pos.position?.unrealizedPnl || '0')
    }));

    console.log('[HyperliquidBalance] Balance fetched:', {
      totalValue,
      availableBalance,
      marginUsed,
      positionsCount: positions.length
    });

    return {
      totalValue,
      availableBalance,
      marginUsed,
      positions
    };
  } catch (error) {
    console.error('[HyperliquidBalance] Error fetching balance:', error);
    return {
      totalValue: 0,
      availableBalance: 0,
      marginUsed: 0,
      positions: []
    };
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
