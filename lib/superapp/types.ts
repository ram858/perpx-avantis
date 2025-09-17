/**
 * TypeScript types for SuperApp integration
 */

export interface SuperAppLaunchParams {
  superapp_token?: string;
  app_id?: string;
  session_id?: string;
  platform?: 'web' | 'mobile';
}

export interface SuperAppWalletData {
  address: string;
  privateKey: string;
  chain: 'Ethereum' | 'Bitcoin' | 'Solana';
  phoneNumber: string;
  success: boolean;
  message: string;
}

export interface SuperAppAuthResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
  };
  keyPairs: SuperAppWalletData[];
}

export interface SuperAppUser {
  id: string;
  email: string;
  phoneNumber: string;
  wallet_addresses: {
    ethereum: string;
    bitcoin?: string;
    solana?: string;
  };
  privateKeys: {
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
  baseUrl?: string;
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

export interface SuperAppContextType {
  isSuperApp: boolean;
  user: SuperAppUser | null;
  balances: SuperAppWalletBalances | null;
  isLoading: boolean;
  error: string | null;
  initializeSuperApp: () => Promise<void>;
  refreshBalances: () => Promise<void>;
}

// Environment detection
export interface SuperAppEnvironment {
  isSuperApp: boolean;
  launchParams: SuperAppLaunchParams;
  baseUrl: string;
}
