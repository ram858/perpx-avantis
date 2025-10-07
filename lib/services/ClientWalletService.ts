import { UserWallet } from './UserWalletService'

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price?: number;
}

export interface TokenBalance {
  token: Token;
  balance: string;
  balanceFormatted: string;
  valueUSD: number;
}

export interface CreateWalletRequest {
  chain: string;
  mnemonic?: string;
}

export interface CreateWalletResponse {
  success: boolean;
  wallet?: UserWallet;
  error?: string;
}

export class ClientWalletService {
  private baseUrl: string
  private getAuthToken: () => string | null

  constructor(getAuthToken: () => string | null) {
    this.baseUrl = '/api/wallet'
    this.getAuthToken = getAuthToken
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error('No authentication token available')
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async getAllUserWallets(): Promise<UserWallet[]> {
    const response = await this.makeRequest('/user-wallets')
    return response.wallets || []
  }

  async getPrimaryTradingWallet(): Promise<UserWallet | null> {
    const response = await this.makeRequest('/primary')
    return response.wallet || null
  }

  async getPrimaryTradingWalletWithKey(): Promise<UserWallet | null> {
    const response = await this.makeRequest('/primary-with-key')
    return response.wallet || null
  }

  async createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
    try {
      const response = await this.makeRequest('/user-wallets', {
        method: 'POST',
        body: JSON.stringify(request),
      })
      
      return {
        success: true,
        wallet: response.wallet
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create wallet'
      }
    }
  }

  async getWalletForChain(chain: string): Promise<UserWallet | null> {
    const wallets = await this.getAllUserWallets()
    return wallets.find(wallet => wallet.chain === chain) || null
  }

  async hasWallets(): Promise<boolean> {
    const wallets = await this.getAllUserWallets()
    return wallets.length > 0
  }

  getSupportedChains(): string[] {
    return ['ethereum', 'bitcoin', 'solana', 'aptos']
  }
}
