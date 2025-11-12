import { EncryptionService } from './EncryptionService'
import { IGenericWalletService, WalletInfo } from './wallets/IGenericWalletService'

export interface CreateWalletRequest {
  phoneNumber?: string // Optional for Base Account users
  userId?: string // For Base Account users (FID-based)
  fid?: number // Farcaster ID for Base Account users
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
  private databaseService: any = null // Optional - only if database is used
  private authService: any = null // Optional
  private walletServices: Map<string, IGenericWalletService>

  constructor() {
    this.encryptionService = new EncryptionService()
    // Database is optional for Base mini-apps
    if (process.env.USE_DATABASE === 'true') {
      try {
        // @ts-ignore - Optional dependency
        const { DatabaseService } = require('./DatabaseService')
        this.databaseService = new DatabaseService()
      } catch (e) {
        // Database not available - that's fine
      }
    }
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
          // Temporarily disabled due to import issues
          console.log('Aptos wallet service temporarily disabled')
          return null
          // const { AptosWalletService } = await import('./wallets/AptosWalletService')
          // service = new AptosWalletService()
          // break
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
      const { phoneNumber, userId, fid, chain, mnemonic } = request

      // For Base Account users (FID), use minimal storage instead of database
      if (fid || userId) {
        // This will be handled by BaseAccountWalletService
        // This method is kept for backward compatibility
        console.warn('createOrGetWallet called with FID/userId - use BaseAccountWalletService instead')
        return {
          success: false,
          error: 'Use BaseAccountWalletService for Base Account users'
        }
      }

      // Legacy phone-based wallet creation (deprecated)
      if (!phoneNumber) {
        return {
          success: false,
          error: 'Phone number or FID required'
        }
      }

      // Check if database service is available
      if (!this.databaseService) {
        console.warn('Database service not available, cannot check for existing wallets')
        return {
          success: false,
          error: 'Database service not available'
        }
      }

      // First, check if wallet already exists in database
      const existingWallet = await this.databaseService.findWalletByPhoneAndChain(phoneNumber, chain.toLowerCase())
      
      if (existingWallet) {
        console.log(`Found existing ${chain} wallet for ${phoneNumber}:`, {
          id: existingWallet.id,
          address: existingWallet.address,
          chain: existingWallet.chain,
          createdAt: existingWallet.createdAt
        })

        // Decrypt the private key for return
        const decryptedPrivateKey = await this.encryptionService.decrypt(existingWallet.privateKey, existingWallet.iv)
        
        return {
          success: true,
          wallet: {
            id: existingWallet.id,
            address: existingWallet.address,
            chain: existingWallet.chain,
            createdAt: existingWallet.createdAt,
            privateKey: decryptedPrivateKey // Include private key for trading
          }
        }
      }

      // Get the appropriate wallet service for the chain
      const walletService = await this.getWalletService(chain)
      if (!walletService) {
        return {
          success: false,
          error: `Unsupported chain: ${chain}`
        }
      }

      // Generate new wallet using the chain-specific service
      const walletInfo = await walletService.generateWallet(mnemonic)
      
      // Encrypt the private key for storage
      const encryptionResult = this.encryptionService.encrypt(walletInfo.privateKey)
      const encryptedPrivateKey = encryptionResult.encrypted
      const iv = encryptionResult.iv
      
      // Store wallet in database (if phone number provided)
      // Note: For Base Account users, wallets are stored via WalletStorageService
      const storedWallet = await this.databaseService.createWallet({
        userId: phoneNumber, // Temporary - will be updated to use userId
        phoneNumber: phoneNumber, // Legacy support
        chain: chain.toLowerCase(),
        address: walletInfo.address,
        privateKey: encryptedPrivateKey,
        iv: iv
      })

      console.log(`Created new ${chain} wallet for ${phoneNumber}:`, {
        id: storedWallet.id,
        address: storedWallet.address,
        chain: storedWallet.chain,
        createdAt: storedWallet.createdAt
      })
      
      return {
        success: true,
        wallet: {
          id: storedWallet.id,
          address: storedWallet.address,
          chain: storedWallet.chain,
          createdAt: storedWallet.createdAt,
          privateKey: walletInfo.privateKey // Include private key for trading
        }
      }
    } catch (error) {
      console.error('Error creating/getting wallet:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create/get wallet'
      }
    }
  }

  async getWalletsByPhone(phoneNumber: string): Promise<any[]> {
    try {
      console.log(`Getting wallets for ${phoneNumber}`)
      
      // Check if database service is available
      if (!this.databaseService) {
        console.warn('Database service not available, returning empty wallets array')
        return []
      }
      
      const wallets = await this.databaseService.findWalletsByPhone(phoneNumber)
      
      // Return wallets without private keys for security
      return wallets.map((wallet: any) => ({
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      }))
    } catch (error) {
      console.error('Error fetching wallets:', error)
      return []
    }
  }

  async getWalletByPhoneAndChain(phoneNumber: string, chain: string): Promise<any | null> {
    try {
      console.log(`Getting ${chain} wallet for ${phoneNumber}`)
      
      // Check if database service is available
      if (!this.databaseService) {
        console.warn('Database service not available, cannot get wallet')
        return null
      }
      
      // Get wallet from database
      const wallet = await this.databaseService.findWalletByPhoneAndChain(phoneNumber, chain.toLowerCase())
      
      if (!wallet) {
        console.log(`No ${chain} wallet found for ${phoneNumber}`)
        return null
      }

      // Decrypt the private key for return
      const decryptedPrivateKey = await this.encryptionService.decrypt(wallet.privateKey, wallet.iv)
      
      return {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        privateKey: decryptedPrivateKey,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      }
    } catch (error) {
      console.error('Error fetching wallet:', error)
      return null
    }
  }

  async getWalletPrivateKey(walletId: string, phoneNumber: string): Promise<string | null> {
    try {
      // This method is deprecated - use BaseAccountWalletService instead
      // Legacy method kept for backward compatibility
      console.warn(`[WalletService] getWalletPrivateKey is deprecated. Use BaseAccountWalletService instead.`)
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
