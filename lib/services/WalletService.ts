import { EncryptionService } from './EncryptionService'
import { AuthService } from './AuthService'
import { IGenericWalletService, WalletInfo } from './wallets/IGenericWalletService'

export interface CreateWalletRequest {
  phoneNumber: string
  chain: string
  mnemonic?: string
}

export interface CreateWalletResponse {
  success: boolean
  wallet?: {
    id: string
    address: string
    chain: string
    createdAt: Date
    privateKey?: string // Include private key for trading purposes
  }
  error?: string
}

export class WalletService {
  private encryptionService: EncryptionService
  private authService: AuthService
  private walletServices: Map<string, IGenericWalletService>

  constructor() {
    this.encryptionService = new EncryptionService()
    this.authService = new AuthService()
    this.walletServices = new Map()
  }

  // Lazy load wallet services to improve startup time
  private async getWalletService(chain: string): Promise<IGenericWalletService | null> {
    if (this.walletServices.has(chain)) {
      return this.walletServices.get(chain)!
    }

    try {
      let service: IGenericWalletService | null = null

      switch (chain.toLowerCase()) {
        case 'ethereum':
          const { EthereumWalletService } = await import('./wallets/EthereumWalletService')
          service = new EthereumWalletService()
          break
        case 'bitcoin':
          const { BitcoinWalletService } = await import('./wallets/BitcoinWalletService')
          service = new BitcoinWalletService()
          break
        case 'solana':
          const { SolanaWalletService } = await import('./wallets/SolanaWalletService')
          service = new SolanaWalletService()
          break
        case 'aptos':
          const { AptosWalletService } = await import('./wallets/AptosWalletService')
          service = new AptosWalletService()
          break
        default:
          return null
      }

      if (service) {
        this.walletServices.set(chain.toLowerCase(), service)
        return service
      }
    } catch (error) {
      console.error(`Error loading wallet service for ${chain}:`, error)
    }

    return null
  }

  async createOrGetWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> {
    try {
      const { phoneNumber, chain, mnemonic } = request

      // Get the appropriate wallet service for the chain
      const walletService = await this.getWalletService(chain)
      if (!walletService) {
        return {
          success: false,
          error: `Unsupported chain: ${chain}`
        }
      }

      // Generate wallet using the chain-specific service
      const walletInfo = await walletService.generateWallet(mnemonic)
      
      // Encrypt the private key for storage
      const encryptionResult = this.encryptionService.encrypt(walletInfo.privateKey)
      const encryptedPrivateKey = encryptionResult.encrypted
      
      // Generate wallet ID
      const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // TODO: Store in database with proper encryption
      // For now, we'll return the wallet info without storing it
      console.log(`Generated ${chain} wallet for ${phoneNumber}:`, {
        id: walletId,
        address: walletInfo.address,
        chain: chain.toLowerCase(),
        encryptedPrivateKey: encryptedPrivateKey.substring(0, 20) + '...' // Log only first 20 chars for security
      })
      
      return {
        success: true,
        wallet: {
          id: walletId,
          address: walletInfo.address,
          chain: chain.toLowerCase(),
          createdAt: new Date(),
          privateKey: walletInfo.privateKey // Include private key for trading
        }
      }
    } catch (error) {
      console.error('Error creating wallet:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create wallet'
      }
    }
  }

  async getWalletsByPhone(phoneNumber: string): Promise<any[]> {
    try {
      // TODO: Implement database query to get wallets for user
      // For now, return empty array as we're not storing wallets yet
      console.log(`Getting wallets for ${phoneNumber} (not implemented yet)`)
      return []
    } catch (error) {
      console.error('Error fetching wallets:', error)
      return []
    }
  }

  async getWalletByPhoneAndChain(phoneNumber: string, chain: string): Promise<any | null> {
    try {
      // TODO: Implement database query to get specific wallet
      console.log(`Getting ${chain} wallet for ${phoneNumber} (not implemented yet)`)
      return null
    } catch (error) {
      console.error('Error fetching wallet:', error)
      return null
    }
  }

  async getWalletPrivateKey(walletId: string, phoneNumber: string): Promise<string | null> {
    try {
      // TODO: Implement database query and decryption
      console.log(`Getting private key for wallet ${walletId} (not implemented yet)`)
      return null
    } catch (error) {
      console.error('Error getting wallet private key:', error)
      return null
    }
  }

  getSupportedChains(): string[] {
    return ['ethereum', 'bitcoin', 'solana', 'aptos']
  }

  async validateWalletAddress(chain: string, address: string): Promise<boolean> {
    const walletService = await this.getWalletService(chain)
    if (!walletService) {
      return false
    }

    return walletService.validateAddress(address)
  }
}
