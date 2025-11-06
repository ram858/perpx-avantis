import { WalletService } from './WalletService'
import { AuthService } from './AuthService'

export interface UserWallet {
  id: string
  address: string
  chain: string
  privateKey?: string
  createdAt: Date
}

export class UserWalletService {
  private walletService: WalletService
  private authService: AuthService

  constructor() {
    this.walletService = new WalletService()
    this.authService = new AuthService()
  }

  /**
   * Get user's primary Ethereum wallet for trading
   */
  async getPrimaryTradingWallet(phoneNumber: string): Promise<UserWallet | null> {
    try {
      // Get all user wallets
      const wallets = await this.walletService.getWalletsByPhone(phoneNumber)
      
      // Find Ethereum wallet (primary for trading)
      const ethereumWallet = wallets.find(wallet => wallet.chain === 'ethereum')
      
      if (ethereumWallet) {
        return {
          id: ethereumWallet.id,
          address: ethereumWallet.address,
          chain: ethereumWallet.chain,
          createdAt: ethereumWallet.createdAt
        }
      }

      // If no Ethereum wallet exists, create one
      const createResult = await this.walletService.createOrGetWallet({
        phoneNumber,
        chain: 'ethereum'
      })

      if (createResult.success && createResult.wallet) {
        return {
          id: createResult.wallet.id,
          address: createResult.wallet.address,
          chain: createResult.wallet.chain,
          createdAt: createResult.wallet.createdAt,
          privateKey: createResult.wallet.privateKey // Include private key
        }
      }

      return null
    } catch (error) {
      console.error('Error getting primary trading wallet:', error)
      return null
    }
  }

  /**
   * Get user's primary Ethereum wallet with private key for trading (by userId)
   */
  async getPrimaryTradingWalletWithKeyByUserId(userId: string): Promise<UserWallet | null> {
    try {
      console.log(`[UserWalletService] Getting wallet with key for userId: ${userId}`)
      
      // Note: This method is deprecated for Base Account users - use BaseAccountWalletService instead
      console.log(`[UserWalletService] getPrimaryTradingWalletWithKeyByUserId is deprecated - use BaseAccountWalletService for Base Account`)
      return null
      
    } catch (error) {
      console.error('Error getting primary trading wallet with key:', error)
      return null
    }
  }

  /**
   * Get user's primary Ethereum wallet with private key for trading (legacy - by phoneNumber)
   * @deprecated Use getPrimaryTradingWalletWithKeyByUserId instead
   */
  async getPrimaryTradingWalletWithKey(phoneNumber: string): Promise<UserWallet | null> {
    try {
      console.log(`[UserWalletService] Getting wallet with key for: ${phoneNumber}`)
      
      // Get the real user's Ethereum wallet (this creates one if it doesn't exist)
      console.log(`[UserWalletService] Calling getWalletByPhoneAndChain for ${phoneNumber}`)
      const userWallet = await this.walletService.getWalletByPhoneAndChain(phoneNumber, 'ethereum')
      console.log(`[UserWalletService] getWalletByPhoneAndChain result:`, userWallet ? 'found' : 'not found')
      
      if (!userWallet) {
        console.error(`[UserWalletService] No Ethereum wallet found for ${phoneNumber}`)
        return null
      }

      // Return the real user wallet with private key
      const realWallet: UserWallet = {
        id: userWallet.id,
        address: userWallet.address,
        chain: userWallet.chain,
        privateKey: userWallet.privateKey, // This should be the real private key
        createdAt: userWallet.createdAt
      }
      
      console.log(`[UserWalletService] Returning real wallet: ${realWallet.address}`)
      return realWallet
      
    } catch (error) {
      console.error('Error getting primary trading wallet with key:', error)
      return null
    }
  }

  /**
   * Get user's wallet for a specific chain
   */
  async getWalletForChain(phoneNumber: string, chain: string): Promise<UserWallet | null> {
    try {
      const wallet = await this.walletService.getWalletByPhoneAndChain(phoneNumber, chain)
      
      if (wallet) {
        return {
          id: wallet.id,
          address: wallet.address,
          chain: wallet.chain,
          createdAt: wallet.createdAt
        }
      }

      return null
    } catch (error) {
      console.error(`Error getting ${chain} wallet:`, error)
      return null
    }
  }

  /**
   * Get all user wallets
   */
  async getAllUserWallets(phoneNumber: string): Promise<UserWallet[]> {
    try {
      const wallets = await this.walletService.getWalletsByPhone(phoneNumber)
      
      return wallets.map(wallet => ({
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        createdAt: wallet.createdAt
      }))
    } catch (error) {
      console.error('Error getting all user wallets:', error)
      return []
    }
  }

  /**
   * Create a new wallet for the user
   */
  async createWallet(phoneNumber: string, chain: string, mnemonic?: string): Promise<UserWallet | null> {
    try {
      const result = await this.walletService.createOrGetWallet({
        phoneNumber,
        chain,
        mnemonic
      })

      if (result.success && result.wallet) {
        return {
          id: result.wallet.id,
          address: result.wallet.address,
          chain: result.wallet.chain,
          createdAt: result.wallet.createdAt
        }
      }

      return null
    } catch (error) {
      console.error('Error creating wallet:', error)
      return null
    }
  }

  /**
   * Get wallet private key (for trading operations)
   * Note: This should only be used for trading operations and not stored in frontend
   */
  async getWalletPrivateKey(walletId: string, phoneNumber: string): Promise<string | null> {
    try {
      return await this.walletService.getWalletPrivateKey(walletId, phoneNumber)
    } catch (error) {
      console.error('Error getting wallet private key:', error)
      return null
    }
  }

  /**
   * Check if user has any wallets
   */
  async hasWallets(phoneNumber: string): Promise<boolean> {
    try {
      const wallets = await this.walletService.getWalletsByPhone(phoneNumber)
      return wallets.length > 0
    } catch (error) {
      console.error('Error checking if user has wallets:', error)
      return false
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): string[] {
    return this.walletService.getSupportedChains()
  }
}

