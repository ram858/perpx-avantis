import * as hl from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import Decimal from "decimal.js";
import { UserWallet, UserWalletService } from './UserWalletService';
import { EncryptionService } from './EncryptionService';

export interface TradingConfig {
  totalBudget: number;
  profitGoal: number;
  maxPositions: number;
  leverage?: number;
}

export interface TradingSession {
  id: string;
  userId: string;
  phoneNumber: string;
  config: TradingConfig;
  status: 'running' | 'completed' | 'stopped' | 'error';
  startTime: Date;
  endTime?: Date;
  totalPnL: number;
  positions: TradingPosition[];
  error?: string;
}

export interface TradingPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  leverage: number;
  timestamp: Date;
}

export interface TradingResult {
  success: boolean;
  message: string;
  sessionId?: string;
  error?: string;
}

export class HyperliquidTradingService {
  private encryptionService: EncryptionService;
  private userWalletService: UserWalletService;
  private activeSessions: Map<string, TradingSession>;
  private isTestnet: boolean;

  constructor() {
    this.encryptionService = new EncryptionService();
    this.userWalletService = new UserWalletService();
    this.activeSessions = new Map();
    this.isTestnet = process.env.HYPERLIQUID_TESTNET === 'true';
  }

  /**
   * Create a new trading session using user's wallet
   */
  async startTradingSession(
    phoneNumber: string, 
    config: TradingConfig
  ): Promise<TradingResult> {
    try {
      console.log(`[HyperliquidTrading] Starting trading session for ${phoneNumber}`);
      
      // Get user's Ethereum wallet
      const userWallet = await this.getUserWallet(phoneNumber);
      if (!userWallet) {
        return {
          success: false,
          message: 'No Ethereum wallet found for user'
        };
      }

      // Get private key (may be encrypted or unencrypted)
      let privateKey = userWallet.privateKey!;
      
      // Try to decrypt if it looks encrypted (contains special characters)
      if (privateKey.includes('=') || privateKey.length > 66) {
        const decryptedKey = await this.decryptPrivateKey(privateKey);
        if (!decryptedKey) {
          return {
            success: false,
            message: 'Failed to decrypt wallet private key'
          };
        }
        privateKey = decryptedKey;
      }
      
      // Validate private key format
      if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
        return {
          success: false,
          message: 'Invalid private key format'
        };
      }

      // Create Hyperliquid wallet client
      const walletClient = this.createHyperliquidClient(privateKey);
      
      // Test connection
      const connectionTest = await this.testConnection(walletClient);
      if (!connectionTest.success) {
        return {
          success: false,
          message: `Hyperliquid connection failed: ${connectionTest.error}`
        };
      }

      // Create trading session
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const session: TradingSession = {
        id: sessionId,
        userId: phoneNumber,
        phoneNumber,
        config,
        status: 'running',
        startTime: new Date(),
        totalPnL: 0,
        positions: []
      };

      // Store session
      this.activeSessions.set(sessionId, session);
      
      // Start trading bot in background
      this.runTradingBot(sessionId, walletClient, config).catch(error => {
        console.error(`[HyperliquidTrading] Trading bot error for session ${sessionId}:`, error);
        const session = this.activeSessions.get(sessionId);
        if (session) {
          session.status = 'error';
          session.error = error.message;
        }
      });

      return {
        success: true,
        message: 'Trading session started successfully',
        sessionId
      };

    } catch (error) {
      console.error('[HyperliquidTrading] Error starting trading session:', error);
      return {
        success: false,
        message: 'Failed to start trading session',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stop a trading session
   */
  async stopTradingSession(sessionId: string): Promise<TradingResult> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          message: 'Trading session not found'
        };
      }

      if (session.status !== 'running') {
        return {
          success: false,
          message: 'Trading session is not running'
        };
      }

      // Close all positions
      await this.closeAllPositions(session);

      // Update session status
      session.status = 'completed';
      session.endTime = new Date();

      return {
        success: true,
        message: 'Trading session stopped successfully'
      };

    } catch (error) {
      console.error('[HyperliquidTrading] Error stopping trading session:', error);
      return {
        success: false,
        message: 'Failed to stop trading session',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get trading session status
   */
  async getTradingSession(sessionId: string): Promise<TradingSession | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active trading sessions for a user
   */
  async getUserTradingSessions(phoneNumber: string): Promise<TradingSession[]> {
    const userSessions: TradingSession[] = [];
    for (const session of this.activeSessions.values()) {
      if (session.phoneNumber === phoneNumber) {
        userSessions.push(session);
      }
    }
    return userSessions;
  }

  /**
   * Get user's Ethereum wallet
   */
  private async getUserWallet(phoneNumber: string): Promise<UserWallet | null> {
    try {
      // Get user's primary trading wallet with private key (Ethereum)
      const primaryWallet = await this.userWalletService.getPrimaryTradingWalletWithKey(phoneNumber);
      
      if (!primaryWallet) {
        console.log(`[HyperliquidTrading] No Ethereum wallet found for ${phoneNumber}`);
        return null;
      }

      if (!primaryWallet.privateKey) {
        console.log(`[HyperliquidTrading] Wallet found but no private key for ${phoneNumber}`);
        return null;
      }

      console.log(`[HyperliquidTrading] Found wallet for ${phoneNumber}: ${primaryWallet.address}`);
      return primaryWallet;
    } catch (error) {
      console.error('[HyperliquidTrading] Error getting user wallet:', error);
      return null;
    }
  }

  /**
   * Decrypt private key
   */
  private async decryptPrivateKey(encryptedPrivateKey: string): Promise<string | null> {
    try {
      const decrypted = this.encryptionService.decrypt(encryptedPrivateKey);
      return decrypted.decrypted;
    } catch (error) {
      console.error('[HyperliquidTrading] Error decrypting private key:', error);
      return null;
    }
  }

  /**
   * Create Hyperliquid wallet client
   */
  private createHyperliquidClient(privateKey: string): hl.WalletClient {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    const transport = this.isTestnet 
      ? hl.createTransport({ url: "https://api.hyperliquid-testnet.xyz" })
      : hl.createTransport({ url: "https://api.hyperliquid.xyz" });

    return new hl.WalletClient({
      wallet: account,
      transport,
      isTestnet: this.isTestnet,
      signatureChainId: this.isTestnet ? "0xa4b1" : "0xa"
    });
  }

  /**
   * Test Hyperliquid connection
   */
  private async testConnection(walletClient: hl.WalletClient): Promise<{ success: boolean; error?: string }> {
    try {
      // Get user state to test connection
      const userState = await walletClient.getUserState();
      console.log(`[HyperliquidTrading] Connection test successful. User address: ${userState.meta?.address}`);
      return { success: true };
    } catch (error) {
      console.error('[HyperliquidTrading] Connection test failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Run the trading bot
   */
  private async runTradingBot(
    sessionId: string, 
    walletClient: hl.WalletClient, 
    config: TradingConfig
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    console.log(`[HyperliquidTrading] Starting trading bot for session ${sessionId}`);
    
    try {
      // Get initial positions
      await this.updatePositions(session, walletClient);
      
      // Main trading loop
      while (session.status === 'running') {
        try {
          // Check if profit goal reached
          if (session.totalPnL >= config.profitGoal) {
            console.log(`[HyperliquidTrading] Profit goal reached: $${session.totalPnL.toFixed(2)}`);
            session.status = 'completed';
            session.endTime = new Date();
            break;
          }

          // Update positions
          await this.updatePositions(session, walletClient);
          
          // Check for new trading opportunities
          await this.checkTradingOpportunities(session, walletClient, config);
          
          // Wait before next iteration
          await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
          
        } catch (error) {
          console.error(`[HyperliquidTrading] Error in trading loop:`, error);
          // Continue trading loop even if there's an error
        }
      }
      
      console.log(`[HyperliquidTrading] Trading bot stopped for session ${sessionId}`);
      
    } catch (error) {
      console.error(`[HyperliquidTrading] Trading bot error:`, error);
      session.status = 'error';
      session.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  /**
   * Update current positions
   */
  private async updatePositions(session: TradingSession, walletClient: hl.WalletClient): Promise<void> {
    try {
      const userState = await walletClient.getUserState();
      const positions = userState.assetPositions || [];
      
      // Update session positions
      session.positions = positions.map((pos: any) => ({
        symbol: pos.position.coin,
        side: parseFloat(pos.position.szi) > 0 ? 'LONG' : 'SHORT',
        size: Math.abs(parseFloat(pos.position.szi)),
        entryPrice: parseFloat(pos.position.entryPx),
        currentPrice: parseFloat(pos.position.positionValue) / Math.abs(parseFloat(pos.position.szi)),
        pnl: parseFloat(pos.position.unrealizedPnl),
        leverage: parseFloat(pos.position.leverage) || 1,
        timestamp: new Date()
      }));
      
      // Calculate total PnL
      session.totalPnL = session.positions.reduce((sum, pos) => sum + pos.pnl, 0);
      
      console.log(`[HyperliquidTrading] Updated positions for session ${session.id}: ${session.positions.length} positions, PnL: $${session.totalPnL.toFixed(2)}`);
      
    } catch (error) {
      console.error(`[HyperliquidTrading] Error updating positions:`, error);
    }
  }

  /**
   * Check for trading opportunities (simplified version)
   */
  private async checkTradingOpportunities(
    session: TradingSession, 
    walletClient: hl.WalletClient, 
    config: TradingConfig
  ): Promise<void> {
    try {
      // For now, this is a placeholder
      // In a real implementation, you would integrate with your trading strategy
      console.log(`[HyperliquidTrading] Checking trading opportunities for session ${session.id}`);
      
      // Example: Simple buy/sell logic based on current positions
      if (session.positions.length < config.maxPositions) {
        // Could open new positions here
        console.log(`[HyperliquidTrading] Room for new positions (${session.positions.length}/${config.maxPositions})`);
      }
      
    } catch (error) {
      console.error(`[HyperliquidTrading] Error checking trading opportunities:`, error);
    }
  }

  /**
   * Close all positions for a session
   */
  private async closeAllPositions(session: TradingSession): Promise<void> {
    try {
      console.log(`[HyperliquidTrading] Closing all positions for session ${session.id}`);
      
      // Get user wallet and create client
      const userWallet = await this.getUserWallet(session.phoneNumber);
      if (!userWallet?.privateKey) return;
      
      const privateKey = await this.decryptPrivateKey(userWallet.privateKey);
      if (!privateKey) return;
      
      const walletClient = this.createHyperliquidClient(privateKey);
      
      // Close each position
      for (const position of session.positions) {
        try {
          await walletClient.closePosition({
            coin: position.symbol,
            is_buy: position.side === 'SHORT' // If we're long, we need to sell to close
          });
          console.log(`[HyperliquidTrading] Closed position: ${position.symbol} ${position.side}`);
        } catch (error) {
          console.error(`[HyperliquidTrading] Error closing position ${position.symbol}:`, error);
        }
      }
      
    } catch (error) {
      console.error(`[HyperliquidTrading] Error closing all positions:`, error);
    }
  }
}
