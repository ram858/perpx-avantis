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
  private tradingEngineUrl: string;

  constructor() {
    this.encryptionService = new EncryptionService();
    this.userWalletService = new UserWalletService();
    this.activeSessions = new Map();
    this.tradingEngineUrl = process.env.TRADING_ENGINE_URL || 'http://localhost:3001';
  }

  async startTradingSession(phoneNumber: string, config: TradingConfig): Promise<TradingResult> {
    
    try {
      // Get user's Ethereum wallet with private key for trading
      // We need to get this from the API since we need the private key
      const userWallet = await this.getUserWalletFromAPI(phoneNumber);
      
      if (!userWallet || !userWallet.privateKey) {
        console.error(`[HyperliquidTradingService] No Ethereum wallet found for user ${phoneNumber}`);
        return {
          success: false,
          message: 'No Ethereum wallet found for user'
        };
      }


      // Decrypt private key if needed
      const privateKey = await this.decryptPrivateKey(userWallet.privateKey);

      // Convert Next.js config to trading engine format
      const tradingEngineConfig = {
        maxBudget: config.totalBudget,
        profitGoal: config.profitGoal,
        maxPerSession: config.maxPositions,
        hyperliquidApiWallet: privateKey
      };

      // Start trading session via trading engine API
      const response = await fetch(`${this.tradingEngineUrl}/api/start-trading`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tradingEngineConfig),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HyperliquidTradingService] Trading engine API error: ${errorText}`);
        
        // Check for specific Hyperliquid wallet errors
        if (errorText.includes('does not exist')) {
          const isTestnet = process.env.HYPERLIQUID_TESTNET !== 'false';
          const hyperliquidUrl = isTestnet ? 'https://app.hyperliquid-testnet.xyz' : 'https://app.hyperliquid.xyz';
          return {
            success: false,
            message: `Wallet not activated on Hyperliquid ${isTestnet ? 'TESTNET' : 'MAINNET'}. Please visit ${hyperliquidUrl} and connect your wallet (${userWallet.address}) to activate it for trading.`
          };
        }
        
        return {
          success: false,
          message: `Trading engine error: ${errorText}`
        };
      }

      const result = await response.json();

      if (!result.sessionId) {
        return {
          success: false,
          message: 'Trading engine did not return session ID'
        };
      }

      // Create local session record
      const session: TradingSession = {
        id: result.sessionId,
        userId: `user_${Date.now()}_${phoneNumber.replace('+', '')}`,
        phoneNumber,
        config,
        status: 'running',
        startTime: new Date(),
        totalPnL: 0,
        positions: []
      };

      this.activeSessions.set(result.sessionId, session);

      return {
        success: true,
        message: 'Trading session started successfully',
        sessionId: result.sessionId
      };

    } catch (error) {
      console.error(`[HyperliquidTradingService] Error starting trading session:`, error);
      return {
        success: false,
        message: `Failed to start trading session: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async stopTradingSession(sessionId: string): Promise<TradingResult> {
    
    try {
      // Stop session via trading engine API
      const response = await fetch(`${this.tradingEngineUrl}/api/stop-trading`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HyperliquidTradingService] Trading engine stop error: ${errorText}`);
        return {
          success: false,
          message: `Trading engine error: ${errorText}`
        };
      }

      const result = await response.json();

      // Update local session
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.status = 'stopped';
        session.endTime = new Date();
      }

      return {
        success: true,
        message: 'Trading session stopped successfully'
      };

    } catch (error) {
      console.error(`[HyperliquidTradingService] Error stopping trading session:`, error);
      return {
        success: false,
        message: `Failed to stop trading session: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getTradingSessions(phoneNumber?: string): Promise<TradingSession[]> {
    try {
      // Get sessions from trading engine
      const response = await fetch(`${this.tradingEngineUrl}/api/status`);
      
      if (!response.ok) {
        console.error(`[HyperliquidTradingService] Failed to get trading sessions: ${response.statusText}`);
        return Array.from(this.activeSessions.values());
      }

      const result = await response.json();

      // Return local sessions (in a real implementation, you'd merge with trading engine data)
      const sessions = Array.from(this.activeSessions.values());
      
      if (phoneNumber) {
        return sessions.filter(session => session.phoneNumber === phoneNumber);
      }
      
      return sessions;

    } catch (error) {
      console.error(`[HyperliquidTradingService] Error getting trading sessions:`, error);
      return Array.from(this.activeSessions.values());
    }
  }

  async getTradingSession(sessionId: string): Promise<TradingSession | null> {
    try {
      // Get session details from trading engine
      const response = await fetch(`${this.tradingEngineUrl}/api/session/${sessionId}`);
      
      if (!response.ok) {
        console.error(`[HyperliquidTradingService] Failed to get session ${sessionId}: ${response.statusText}`);
        return this.activeSessions.get(sessionId) || null;
      }

      const result = await response.json();

      // Update local session with trading engine data
      const localSession = this.activeSessions.get(sessionId);
      if (localSession && result.status) {
        localSession.status = result.status;
        localSession.totalPnL = result.pnl || 0;
        localSession.positions = result.positions || [];
      }

      return localSession || null;

    } catch (error) {
      console.error(`[HyperliquidTradingService] Error getting trading session:`, error);
      return this.activeSessions.get(sessionId) || null;
    }
  }

  async getPositions(): Promise<TradingPosition[]> {
    try {
      const response = await fetch(`${this.tradingEngineUrl}/api/positions`);
      
      if (!response.ok) {
        console.error(`[HyperliquidTradingService] Failed to get positions: ${response.statusText}`);
        return [];
      }

      const result = await response.json();

      return result.positions || [];

    } catch (error) {
      console.error(`[HyperliquidTradingService] Error getting positions:`, error);
      return [];
    }
  }

  async closePosition(symbol: string): Promise<TradingResult> {
    try {
      const response = await fetch(`${this.tradingEngineUrl}/api/close-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HyperliquidTradingService] Failed to close position: ${errorText}`);
        return {
          success: false,
          message: `Failed to close position: ${errorText}`
        };
      }

      const result = await response.json();

      return {
        success: true,
        message: 'Position closed successfully'
      };

    } catch (error) {
      console.error(`[HyperliquidTradingService] Error closing position:`, error);
      return {
        success: false,
        message: `Failed to close position: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.tradingEngineUrl}/api/status`, {
        method: 'GET',
        timeout: 5000
      } as any);

      if (response.ok) {
        const result = await response.json();
        return true;
      } else {
        console.error(`[HyperliquidTradingService] Connection test failed: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error(`[HyperliquidTradingService] Connection test error:`, error);
      return false;
    }
  }

  private async decryptPrivateKey(encryptedKey: string): Promise<string> {
    try {
      // Check if the key looks encrypted (contains special characters or is longer than 66 chars)
      if (encryptedKey.length > 66 || encryptedKey.includes(' ') || !encryptedKey.startsWith('0x')) {
        return await this.encryptionService.decrypt(encryptedKey);
      } else {
        return encryptedKey;
      }
    } catch (error) {
      console.error(`[HyperliquidTradingService] Failed to decrypt private key:`, error);
      // If decryption fails, try using the key as-is
      return encryptedKey;
    }
  }

  private async getUserWalletFromAPI(phoneNumber: string): Promise<UserWallet | null> {
    try {
      // This method would need to be called from the frontend with proper authentication
      // For now, we'll use the existing userWalletService method
      return await this.userWalletService.getPrimaryTradingWalletWithKey(phoneNumber);
    } catch (error) {
      console.error(`[HyperliquidTradingService] Error getting user wallet from API:`, error);
      return null;
    }
  }

  private async getUserWallet(phoneNumber: string): Promise<UserWallet | null> {
    try {
      return await this.userWalletService.getPrimaryTradingWalletWithKey(phoneNumber);
    } catch (error) {
      console.error(`[HyperliquidTradingService] Error getting user wallet:`, error);
      return null;
    }
  }
}