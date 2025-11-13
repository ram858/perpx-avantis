import { UserWallet } from './UserWalletService'

export type WalletType = 'base-account' | 'trading' | 'legacy'

export interface ClientUserWallet extends UserWallet {
  walletType?: WalletType
  updatedAt?: Date
}

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
  wallet?: ClientUserWallet;
  error?: string;
}

export class ClientWalletService {
  private baseUrl: string
  private getAuthToken: () => string | null

  constructor(getAuthToken: () => string | null) {
    this.baseUrl = '/api/wallet'
    this.getAuthToken = getAuthToken
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}, timeout: number = 30000): Promise<any> {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error('No authentication token available')
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - please try again')
      }
      throw error
    }
  }

  async getAllUserWallets(): Promise<ClientUserWallet[]> {
    const response = await this.makeRequest('/user-wallets')
    const wallets = (response.wallets || []) as any[]

    return wallets.map(wallet => ({
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      createdAt: wallet.createdAt ? new Date(wallet.createdAt) : new Date(),
      walletType: wallet.walletType,
      updatedAt: wallet.updatedAt ? new Date(wallet.updatedAt) : undefined
    }))
  }

  async getPrimaryTradingWallet(): Promise<ClientUserWallet | null> {
    const response = await this.makeRequest('/primary')
    const wallet = response.wallet
    if (!wallet) return null
    return {
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      createdAt: wallet.createdAt ? new Date(wallet.createdAt) : new Date(),
      walletType: wallet.walletType
    }
  }

  async getPrimaryTradingWalletWithKey(): Promise<UserWallet | null> {
    const response = await this.makeRequest('/primary-with-key')
    return response.wallet || null
  }

  async createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
    try {
      // Use longer timeout for wallet creation (60 seconds)
      const response = await this.makeRequest('/user-wallets', {
        method: 'POST',
        body: JSON.stringify(request),
      }, 60000)
      
      const wallet = response.wallet
      return {
        success: true,
        wallet: wallet
          ? {
              id: wallet.id,
              address: wallet.address,
              chain: wallet.chain,
              createdAt: wallet.createdAt ? new Date(wallet.createdAt) : new Date(),
              walletType: wallet.walletType
            }
          : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create wallet'
      }
    }
  }

  async getWalletForChain(chain: string): Promise<ClientUserWallet | null> {
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
