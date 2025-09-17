/**
 * SuperApp SDK Integration for Perp-x Mini-App
 * 
 * This SDK provides integration with the SuperApp's wallet system,
 * allowing the Perp-x mini-app to access user's existing wallet
 * without requiring manual wallet connection.
 */

export interface SuperAppUser {
  id: string;
  email: string;
  wallet_addresses: {
    ethereum: string;
    bitcoin?: string;
    solana?: string;
  };
}

export interface SuperAppWalletBalances {
  ethereum: {
    ETH: string;
    USDC: string;
    [key: string]: string;
  };
  polygon?: {
    MATIC: string;
    USDC: string;
    [key: string]: string;
  };
}

export interface SuperAppConfig {
  deploymentToken: string;
  appId?: string;
  sessionId?: string;
  superappToken?: string;
}

export interface SuperAppSDK {
  init(config: SuperAppConfig): Promise<SuperAppConfig>;
  getUser(): Promise<SuperAppUser>;
  getWalletBalances(): Promise<SuperAppWalletBalances>;
  signMessage(message: string): Promise<string>;
  reportError(error: Error): void;
  showMainButton?(text: string, callback: () => void): void;
  hideMainButton?(): void;
  expand?(): void;
  close?(): void;
}

declare global {
  interface Window {
    SuperApp: SuperAppSDK;
  }
}

class SuperAppSDKImpl implements SuperAppSDK {
  private config: SuperAppConfig | null = null;
  private baseUrl: string;

  constructor() {
    // Detect if we're in SuperApp environment
    this.baseUrl = this.detectSuperAppBaseUrl();
  }

  private detectSuperAppBaseUrl(): string {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      // Server-side rendering fallback
      return 'http://localhost:3000';
    }
    
    // Check URL parameters for SuperApp context
    const urlParams = new URLSearchParams(window.location.search);
    const superappToken = urlParams.get('superapp_token');
    const appId = urlParams.get('app_id');
    
    if (superappToken && appId) {
      // We're launched from SuperApp
      return 'https://wallet.wapal.io'; // SuperApp base URL
    }
    
    // Fallback for development
    return 'http://localhost:3000';
  }

  private getAuthHeaders(): HeadersInit {
    if (!this.config) {
      throw new Error('SDK not initialized');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Use deployment token for SDK API calls
    if (this.config.deploymentToken) {
      headers['X-Deployment-Token'] = this.config.deploymentToken;
    }

    // Use SuperApp token for user-specific calls
    if (this.config.superappToken) {
      headers['Authorization'] = `Bearer ${this.config.superappToken}`;
    }

    return headers;
  }

  async init(config: SuperAppConfig): Promise<SuperAppConfig> {
    try {
      // Extract launch parameters from URL if available (browser only)
      let superappToken = config.superappToken;
      let appId = config.appId;
      let sessionId = config.sessionId;
      
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        superappToken = urlParams.get('superapp_token') || config.superappToken;
        appId = urlParams.get('app_id') || config.appId;
        sessionId = urlParams.get('session_id') || config.sessionId;
      }

      this.config = {
        ...config,
        superappToken,
        appId,
        sessionId,
      };

      console.log('SuperApp SDK initialized:', {
        appId: this.config.appId,
        sessionId: this.config.sessionId,
        hasToken: !!this.config.superappToken,
        hasDeploymentToken: !!this.config.deploymentToken,
      });

      return this.config;
    } catch (error) {
      console.error('Failed to initialize SuperApp SDK:', error);
      throw error;
    }
  }

  async getUser(): Promise<SuperAppUser> {
    if (!this.config) {
      throw new Error('SDK not initialized');
    }

    try {
      // For now, we'll use the SuperApp's wallet API directly
      // In a real implementation, this would call the SuperApp's SDK API
      const response = await fetch(`${this.baseUrl}/wallet/verify-otp`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          // This would normally be handled by the SuperApp's authentication
          // For now, we'll simulate the response structure
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get user data: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract user data from SuperApp response
      if (data.success && data.keyPairs) {
        const ethereumWallet = data.keyPairs.find((kp: any) => kp.chain === 'Ethereum');
        
        if (!ethereumWallet) {
          throw new Error('Ethereum wallet not found in SuperApp response');
        }

        return {
          id: ethereumWallet.phoneNumber, // Using phone number as user ID
          email: `${ethereumWallet.phoneNumber}@wapal.io`, // Generate email from phone
          phoneNumber: ethereumWallet.phoneNumber,
          wallet_addresses: {
            ethereum: ethereumWallet.address,
            bitcoin: data.keyPairs.find((kp: any) => kp.chain === 'Bitcoin')?.address,
            solana: data.keyPairs.find((kp: any) => kp.chain === 'Solana')?.address,
          },
          privateKeys: {
            ethereum: ethereumWallet.privateKey,
            bitcoin: data.keyPairs.find((kp: any) => kp.chain === 'Bitcoin')?.privateKey,
            solana: data.keyPairs.find((kp: any) => kp.chain === 'Solana')?.privateKey,
          },
        };
      }

      throw new Error('Invalid SuperApp response format');
    } catch (error) {
      console.error('Failed to get user data:', error);
      throw error;
    }
  }

  async getWalletBalances(): Promise<SuperAppWalletBalances> {
    if (!this.config) {
      throw new Error('SDK not initialized');
    }

    try {
      // For now, return mock balances
      // In a real implementation, this would call the SuperApp's balance API
      return {
        ethereum: {
          ETH: '1.234',
          USDC: '1000.00',
        },
        polygon: {
          MATIC: '500.00',
          USDC: '500.00',
        },
      };
    } catch (error) {
      console.error('Failed to get wallet balances:', error);
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.config) {
      throw new Error('SDK not initialized');
    }

    try {
      // For now, return a mock signature
      // In a real implementation, this would use the SuperApp's signing mechanism
      return `0x${Buffer.from(message).toString('hex')}mock_signature`;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }

  reportError(error: Error): void {
    console.error('SuperApp SDK Error:', error);
    // In a real implementation, this would send error reports to SuperApp
  }

  // Mobile-specific methods (optional)
  showMainButton?(text: string, callback: () => void): void {
    console.log('Show main button:', text);
    // In a real implementation, this would show a button in the SuperApp UI
  }

  hideMainButton?(): void {
    console.log('Hide main button');
    // In a real implementation, this would hide the button in the SuperApp UI
  }

  expand?(): void {
    console.log('Expand to full screen');
    // In a real implementation, this would expand the mini-app to full screen
  }

  close?(): void {
    console.log('Close mini-app');
    // In a real implementation, this would close the mini-app
  }
}

// Create and expose the SDK
const superAppSDK = new SuperAppSDKImpl();

// Make it available globally
if (typeof window !== 'undefined') {
  window.SuperApp = superAppSDK;
}

export default superAppSDK;
