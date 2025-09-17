/**
 * SuperApp-aware Hyperliquid integration
 * 
 * This module provides Hyperliquid trading functionality using
 * the SuperApp's existing wallet infrastructure instead of
 * requiring manual wallet input from users.
 */

import * as hl from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { SuperAppUser } from './types';

export interface SuperAppHyperliquidConfig {
  user: SuperAppUser;
  isTestnet?: boolean;
}

export class SuperAppHyperliquidClient {
  private walletClient: hl.WalletClient | null = null;
  private publicClient: hl.PublicClient;
  private account: any;
  private transport: hl.HttpTransport;
  private isTestnet: boolean;

  constructor(config: SuperAppHyperliquidConfig) {
    this.isTestnet = config.isTestnet ?? true; // Default to testnet for safety
    
    // Use SuperApp's Ethereum private key for Hyperliquid
    const privateKey = config.user.privateKeys.ethereum;
    
    if (!privateKey) {
      throw new Error('Ethereum private key not available from SuperApp');
    }

    if (!privateKey.startsWith("0x")) {
      throw new Error('Invalid private key format. Private key must start with 0x');
    }

    // Initialize account with SuperApp's private key
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
    
    // Initialize transport
    this.transport = new hl.HttpTransport({ isTestnet: this.isTestnet });
    this.publicClient = new hl.PublicClient({ transport: this.transport });

    console.log(`🔐 SuperApp Hyperliquid initialized with wallet: ${this.account.address} (${this.isTestnet ? 'TESTNET' : 'MAINNET'})`);
  }

  /**
   * Get or create the wallet client
   */
  getWalletClient(): hl.WalletClient {
    if (!this.walletClient) {
      this.walletClient = new hl.WalletClient({
        wallet: this.account,
        transport: this.transport,
        isTestnet: this.isTestnet,
        signatureChainId: this.isTestnet ? "0xa4b1" : "0xa", // Testnet: 0xa4b1, Mainnet: 0xa
      });
      console.log(`🔐 SuperApp WalletClient instantiated: ${this.account.address} (${this.isTestnet ? 'TESTNET' : 'MAINNET'})`);
    }
    return this.walletClient;
  }

  /**
   * Get the public client for read operations
   */
  getPublicClient(): hl.PublicClient {
    return this.publicClient;
  }

  /**
   * Get the wallet address
   */
  getWalletAddress(): string {
    return this.account.address;
  }

  /**
   * Check if we're using testnet
   */
  isUsingTestnet(): boolean {
    return this.isTestnet;
  }

  /**
   * Fetch current price for a symbol
   */
  async fetchPrice(symbol: string): Promise<number> {
    try {
      const book = await this.publicClient.l2Book({ coin: symbol });
      const bestBid = parseFloat(book.levels?.[0]?.[0]?.px ?? "0");
      const bestAsk = parseFloat(book.levels?.[1]?.[0]?.px ?? "0");
      
      if (bestBid === 0 || bestAsk === 0) {
        console.warn(`⚠️ Invalid price data for ${symbol}: bid=${bestBid}, ask=${bestAsk}`);
        return 0;
      }
      
      return (bestBid + bestAsk) / 2;
    } catch (err: any) {
      console.error(`❌ Failed to fetch l2Book for ${symbol}:`, err?.responseBody || err);
      return 0;
    }
  }

  /**
   * Get current positions
   */
  async getPositions(): Promise<any[]> {
    try {
      const state = await this.publicClient.clearinghouseState({ user: this.account.address });
      return (state?.assetPositions ?? []).map(p => {
        const size = parseFloat(p?.position?.szi ?? "0");
        const side = size > 0 ? "long" : size < 0 ? "short" : "unknown";
        
        return {
          ...p,
          coin: p?.position?.coin,
          side: side,
          entryPx: p?.position?.entryPx,
          szi: p?.position?.szi
        };
      });
    } catch (err: any) {
      console.error("❌ Failed to fetch positions:", err?.responseBody || err);
      return [];
    }
  }

  /**
   * Get total PnL across all positions
   */
  async getTotalPnL(): Promise<number> {
    try {
      const positions = await this.getPositions();
      let total = 0;

      for (const pos of positions) {
        const entry = Number(pos.entryPx ?? 0);
        const size = Number(pos.szi ?? 0);
        if (!entry || !size) continue;
        
        const mark = await this.fetchPrice(pos.coin);
        if (mark === 0 || mark === null || mark === undefined || isNaN(mark)) {
          console.warn(`⚠️ Skipping PnL calculation for ${pos.coin} - invalid price: ${mark}`);
          continue;
        }
        
        const dir = size > 0 ? 1 : -1;
        const value = Math.abs(size) * entry;
        const pnl = value * ((mark - entry) / entry) * dir;

        console.log(`📈 ${pos.coin} | ${pos.side} | Entry=$${entry} | Mark=$${mark} | PnL=$${pnl.toFixed(2)}`);
        total += pnl;
      }

      return total;
    } catch (err: any) {
      console.error("❌ Failed to calculate PnL:", err?.responseBody || err);
      return 0;
    }
  }

  /**
   * Place a market order
   */
  async placeMarketOrder(params: {
    symbol: string;
    side: 'long' | 'short';
    size: string;
    price?: number;
  }): Promise<any> {
    try {
      const meta = await this.publicClient.meta();
      const assetIndex = meta.universe.findIndex((a) => a.name === params.symbol);
      
      if (assetIndex === -1) {
        throw new Error(`Unknown asset ${params.symbol}`);
      }

      const isLong = params.side === 'long';
      const currentPrice = params.price || await this.fetchPrice(params.symbol);
      
      if (!currentPrice) {
        throw new Error(`Could not fetch price for ${params.symbol}`);
      }

      // Use aggressive pricing for market orders
      const aggressivePrice = isLong ? 
        (currentPrice * 1.05).toFixed(4) : // 5% above for buy
        (currentPrice * 0.95).toFixed(4);  // 5% below for sell

      const order = {
        orders: [{
          a: assetIndex,
          b: isLong,
          p: aggressivePrice,
          s: params.size,
          r: false,
          t: { limit: { tif: "Ioc" as const } }
        }],
        grouping: "na" as const,
      };

      const result = await this.getWalletClient().order(order);
      console.log(`📈 Market order placed for ${params.symbol}:`, result);
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to place market order for ${params.symbol}:`, error);
      throw error;
    }
  }

  /**
   * Close a position
   */
  async closePosition(symbol: string, position: any, reason: string): Promise<any> {
    try {
      const meta = await this.publicClient.meta();
      const assetIndex = meta.universe.findIndex((a) => a.name === symbol);
      
      if (assetIndex === -1) {
        throw new Error(`Unknown asset ${symbol}`);
      }

      const size = parseFloat(position.position?.szi ?? position.szi ?? "0");
      const isLong = size > 0;
      const sizeAbs = Math.abs(size).toFixed(6);
      
      if (!sizeAbs || parseFloat(sizeAbs) <= 0) {
        throw new Error(`Invalid position size for ${symbol}: ${size}`);
      }

      const currentPrice = await this.fetchPrice(symbol);
      if (!currentPrice) {
        throw new Error(`Could not fetch price for ${symbol}`);
      }

      // Use aggressive pricing for closing
      const closePrice = isLong ? 
        (currentPrice * 0.98).toFixed(4) : // 2% below for closing long
        (currentPrice * 1.02).toFixed(4);  // 2% above for closing short

      const closeOrder = {
        orders: [{
          a: assetIndex,
          b: !isLong, // Opposite of position direction
          p: closePrice,
          s: sizeAbs,
          r: true, // Reduce-only
          t: { limit: { tif: "Ioc" as const } }
        }],
        grouping: "na" as const,
      };

      const result = await this.getWalletClient().order(closeOrder);
      console.log(`📉 Position closed for ${symbol} (${reason}):`, result);
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to close position for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Close all positions
   */
  async closeAllPositions(): Promise<void> {
    const positions = await this.getPositions();
    console.log(`🔧 Closing ${positions.length} positions`);
    
    for (const pos of positions) {
      try {
        await this.closePosition(pos.position.coin, pos, "close_all");
      } catch (error) {
        console.error(`Failed to close position ${pos.position.coin}:`, error);
      }
    }
  }

  /**
   * Test network connectivity
   */
  async testConnectivity(): Promise<boolean> {
    try {
      const testUrl = this.isTestnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';
      const response = await fetch(testUrl, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      console.log(`✅ SuperApp Hyperliquid connectivity test passed (Status: ${response.status})`);
      return true;
    } catch (error: any) {
      console.error(`❌ SuperApp Hyperliquid connectivity test failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * Factory function to create a SuperApp Hyperliquid client
 */
export function createSuperAppHyperliquidClient(config: SuperAppHyperliquidConfig): SuperAppHyperliquidClient {
  return new SuperAppHyperliquidClient(config);
}
