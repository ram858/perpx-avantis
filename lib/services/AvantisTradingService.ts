import { BaseAccountWallet, BaseAccountWalletService } from './BaseAccountWalletService';
import { EncryptionService } from './EncryptionService';
import { AvantisClient, OpenPositionParams } from './AvantisClient';

export interface TradingConfig {
  totalBudget: number;
  profitGoal: number;
  maxPositions: number;
  leverage?: number;
}

export interface TradingSession {
  id: string;
  userId: string;
  fid: number; // Farcaster ID for user identification
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

export class AvantisTradingService {
  private encryptionService: EncryptionService;
  private walletService: BaseAccountWalletService;
  private activeSessions: Map<string, TradingSession>;
  private tradingEngineUrl: string;

  constructor(tradingEngineUrl?: string) {
    this.encryptionService = new EncryptionService();
    this.walletService = new BaseAccountWalletService();
    this.activeSessions = new Map();
    // Use provided URL, or try environment variable (server-side only), or fallback
    // In Base mini apps, this service should only be used server-side via API routes
    this.tradingEngineUrl = tradingEngineUrl || 
      (typeof process !== 'undefined' && process.env?.TRADING_ENGINE_URL) || 
      'http://localhost:3001';
  }

  async startTradingSession(fid: number, config: TradingConfig): Promise<TradingResult> {
    
    try {
      // Get trading wallet with private key (required for automated trading)
      const userWallet = await this.walletService.getWalletWithKey(fid, 'ethereum');
      
      if (!userWallet || !userWallet.privateKey) {
        console.error(`[AvantisTradingService] No trading wallet found for FID ${fid}`);
        return {
          success: false,
          message: 'No trading wallet found. Please ensure your trading wallet is properly set up.'
        };
      }

      // Private key is already decrypted from storage
      const privateKey = userWallet.privateKey;

      // Convert Next.js config to trading engine format
      const tradingEngineConfig: any = {
        maxBudget: config.totalBudget,
        profitGoal: config.profitGoal,
        maxPerSession: config.maxPositions,
        userFid: fid,
        walletAddress: userWallet.address,
        avantisApiWallet: privateKey, // Private key for Avantis trading
      };

      // Start trading session via trading engine API with timeout and retry logic
      let lastError: Error | null = null;
      const maxRetries = 2;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
          
          const response = await fetch(`${this.tradingEngineUrl}/api/trading/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(tradingEngineConfig),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            let errorText: string;
            try {
              errorText = await response.text();
            } catch {
              errorText = `HTTP ${response.status}: ${response.statusText}`;
            }
            
            console.error(`[AvantisTradingService] Trading engine API error (attempt ${attempt + 1}/${maxRetries + 1}): ${errorText}`);
            
            // Don't retry on client errors (4xx)
            if (response.status >= 400 && response.status < 500) {
              // Check for specific Avantis wallet errors
              if (errorText.includes('does not exist') || errorText.includes('not activated')) {
                const network = typeof process !== 'undefined' && process.env?.AVANTIS_NETWORK;
                const isTestnet = network === 'base-testnet';
                const avantisUrl = isTestnet ? 'https://avantis-testnet.com' : 'https://avantis.com';
                return {
                  success: false,
                  message: `Wallet not activated on Avantis ${isTestnet ? 'TESTNET' : 'MAINNET'}. Please visit ${avantisUrl} and connect your wallet (${userWallet.address}) to activate it for trading.`
                };
              }
              
              return {
                success: false,
                message: `Trading engine error: ${errorText}`
              };
            }
            
            // Retry on server errors (5xx) or network errors
            if (attempt < maxRetries) {
              console.warn(`[AvantisTradingService] Retrying trading engine request (${attempt + 1}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
              continue;
            }
            
            return {
              success: false,
              message: `Trading engine error: ${errorText}`
            };
          }

          // Success - break out of retry loop
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
            userId: `fid_${fid}`,
            fid,
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
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Handle network errors
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              if (attempt < maxRetries) {
                console.warn(`[AvantisTradingService] Request timeout, retrying (${attempt + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
              }
              return {
                success: false,
                message: 'Request timeout. The trading engine may be slow. Please try again.'
              };
            }
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
              if (attempt < maxRetries) {
                console.warn(`[AvantisTradingService] Network error, retrying (${attempt + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
              }
              return {
                success: false,
                message: 'Network error. Please check your internet connection and try again.'
              };
            }
          }
          
          // If we've exhausted retries, return error
          if (attempt === maxRetries) {
            return {
              success: false,
              message: `Failed to start trading session: ${lastError.message}`
            };
          }
        }
      }
      
      // Should not reach here, but just in case
      return {
        success: false,
        message: `Failed to start trading session: ${lastError?.message || 'Unknown error'}`
      };

    } catch (error) {
      console.error(`[AvantisTradingService] Error starting trading session:`, error);
      return {
        success: false,
        message: `Failed to start trading session: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async stopTradingSession(sessionId: string): Promise<TradingResult> {
    
    try {
      // Stop session via trading engine API
      const response = await fetch(`${this.tradingEngineUrl}/api/trading/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AvantisTradingService] Trading engine stop error: ${errorText}`);
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
      console.error(`[AvantisTradingService] Error stopping trading session:`, error);
      return {
        success: false,
        message: `Failed to stop trading session: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getTradingSessions(fid?: number): Promise<TradingSession[]> {
    try {
      // Get sessions from trading engine
      const response = await fetch(`${this.tradingEngineUrl}/api/trading/sessions`);
      
      if (!response.ok) {
        console.error(`[AvantisTradingService] Failed to get trading sessions: ${response.statusText}`);
        return Array.from(this.activeSessions.values());
      }

      const result = await response.json();

      // Return local sessions (in a real implementation, you'd merge with trading engine data)
      const sessions = Array.from(this.activeSessions.values());
      
      if (fid) {
        return sessions.filter(session => session.fid === fid);
      }
      
      return sessions;

    } catch (error) {
      console.error(`[AvantisTradingService] Error getting trading sessions:`, error);
      return Array.from(this.activeSessions.values());
    }
  }

  async getTradingSession(sessionId: string): Promise<TradingSession | null> {
    try {
      // Get session details from trading engine
      const response = await fetch(`${this.tradingEngineUrl}/api/trading/session/${sessionId}`);
      
      if (!response.ok) {
        console.error(`[AvantisTradingService] Failed to get session ${sessionId}: ${response.statusText}`);
        return this.activeSessions.get(sessionId) || null;
      }

      const result = await response.json();

      // Update local session with trading engine data
      const localSession = this.activeSessions.get(sessionId);
      if (localSession && result.status) {
        localSession.status = result.status;
        localSession.totalPnL = result.totalPnL || result.pnl || 0;
        localSession.positions = result.positions || [];
      }

      return localSession || null;

    } catch (error) {
      console.error(`[AvantisTradingService] Error getting trading session:`, error);
      return this.activeSessions.get(sessionId) || null;
    }
  }

  async getPositions(): Promise<TradingPosition[]> {
    try {
      const response = await fetch(`${this.tradingEngineUrl}/api/positions`);
      
      if (!response.ok) {
        console.error(`[AvantisTradingService] Failed to get positions: ${response.statusText}`);
        return [];
      }

      const result = await response.json();

      return result.positions || [];

    } catch (error) {
      console.error(`[AvantisTradingService] Error getting positions:`, error);
      return [];
    }
  }

  async closePosition(pairIndex: number, privateKey?: string, fid?: number): Promise<TradingResult> {
    try {
      // If private key provided, use it; otherwise try to get from wallet service
      let walletPrivateKey = privateKey;
      
      if (!walletPrivateKey && fid) {
        const wallet = await this.walletService.getWalletWithKey(fid, 'ethereum');
        walletPrivateKey = wallet?.privateKey;
      }
      
      if (!walletPrivateKey) {
        return {
          success: false,
          message: 'Private key required to close position. Please ensure your trading wallet is set up.'
        };
      }
      
      console.log(`[AvantisTradingService] Closing position ${pairIndex} with wallet: ${walletPrivateKey.slice(0, 10)}...`);
      
      const response = await fetch(`${this.tradingEngineUrl}/api/close-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pairIndex,
          privateKey: walletPrivateKey,
          userFid: fid
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AvantisTradingService] Failed to close position: ${errorText}`);
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
      console.error(`[AvantisTradingService] Error closing position:`, error);
      return {
        success: false,
        message: `Failed to close position: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async closeAllPositions(fid: number): Promise<TradingResult> {
    try {
      console.log(`[AvantisTradingService] Closing all positions for FID ${fid}`);

      // Get user's wallet with private key
      const userWallet = await this.walletService.getWalletWithKey(fid, 'ethereum');
      
      if (!userWallet || !userWallet.privateKey) {
        console.error(`[AvantisTradingService] No wallet with private key found for FID ${fid}`);
        return {
          success: false,
          message: 'No wallet with private key found'
        };
      }

      // Private key is already decrypted from storage
      const privateKey = userWallet.privateKey;

      // Call the trading engine's close all positions endpoint
      const response = await fetch(`${this.tradingEngineUrl}/api/close-all-positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          privateKey: privateKey,
          userFid: fid // Changed from phoneNumber
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AvantisTradingService] Failed to close all positions: ${errorText}`);
        return {
          success: false,
          message: `Failed to close all positions: ${errorText}`
        };
      }

      const result = await response.json();

      return {
        success: true,
        message: result.message || 'All positions closed successfully'
      };

    } catch (error) {
      console.error(`[AvantisTradingService] Error closing all positions:`, error);
      return {
        success: false,
        message: `Failed to close all positions: ${error instanceof Error ? error.message : 'Unknown error'}`
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
        console.error(`[AvantisTradingService] Connection test failed: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error(`[AvantisTradingService] Connection test error:`, error);
      return false;
    }
  }

}
