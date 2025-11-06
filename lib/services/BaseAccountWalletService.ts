/**
 * Wallet service for Base Account users
 * Uses FID (Farcaster ID) instead of phone numbers
 * Stores wallets in minimal storage (Vercel KV or localStorage)
 */

import { WalletStorageService } from './WalletStorageService';
import { EncryptionService } from './EncryptionService';

export interface BaseAccountWallet {
  id: string;
  address: string;
  chain: string;
  privateKey?: string;
  createdAt: Date;
}

export class BaseAccountWalletService {
  private walletStorage: WalletStorageService;
  private encryptionService: EncryptionService;

  constructor() {
    this.walletStorage = new WalletStorageService();
    this.encryptionService = new EncryptionService();
  }

  /**
   * Store Base Account address for a user (no private key - Base Accounts are smart wallets)
   */
  async storeBaseAccountAddress(fid: number, address: string, chain: string = 'ethereum'): Promise<void> {
    try {
      // Store only the address (no private key for Base Accounts)
      // We'll store it as a wallet record but without a private key
      await this.walletStorage.storeWallet(fid, {
        address: address,
        privateKey: '', // Empty - Base Accounts don't have private keys
        chain: chain.toLowerCase(),
      });

      console.log(`✅ Stored Base Account address for FID ${fid}: ${address}`);
    } catch (error) {
      console.error('Error storing Base Account address:', error);
      throw error;
    }
  }

  /**
   * Get or create wallet for a Base Account user (FID)
   * For Base Accounts, this should store the Base Account address
   * For traditional wallets, this creates a new wallet with private key
   */
  async getOrCreateWallet(fid: number, chain: string = 'ethereum'): Promise<BaseAccountWallet | null> {
    try {
      // Check if wallet exists in storage
      const stored = await this.walletStorage.getWallet(fid, chain);
      
      if (stored) {
        // Wallet exists, return it
        const privateKey = await this.walletStorage.getPrivateKey(fid, chain);
        return {
          id: `fid_${fid}_${chain}`,
          address: stored.address,
          chain: stored.chain,
          privateKey: privateKey && privateKey.length > 0 ? privateKey : undefined, // Only return if not empty
          createdAt: new Date(stored.createdAt),
        };
      }

      // If no wallet exists, return null
      // Base Account addresses should be stored via storeBaseAccountAddress()
      // Traditional wallets can be created here if needed
      console.log(`⚠️ No wallet found for FID ${fid}. Use storeBaseAccountAddress() for Base Accounts.`);
      return null;
    } catch (error) {
      console.error('Error getting/creating wallet:', error);
      return null;
    }
  }

  /**
   * Create a traditional trading wallet (with private key) for automated trading
   * This is a fallback for when Base Account can't be used for automated trading
   */
  async createTradingWallet(fid: number, chain: string = 'ethereum'): Promise<BaseAccountWallet | null> {
    try {
      // Create new wallet using the chain-specific wallet service
      const { EthereumWalletService } = await import('./wallets/EthereumWalletService');
      const ethereumService = new EthereumWalletService();
      
      // Generate new wallet
      const walletInfo = await ethereumService.generateWallet();
      
      // Store encrypted wallet
      await this.walletStorage.storeWallet(fid, {
        address: walletInfo.address,
        privateKey: walletInfo.privateKey,
        chain: chain.toLowerCase(),
      });

      console.log(`✅ Created trading wallet for FID ${fid}: ${walletInfo.address}`);

      return {
        id: `fid_${fid}_${chain}`,
        address: walletInfo.address,
        chain: chain.toLowerCase(),
        privateKey: walletInfo.privateKey,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Error creating trading wallet:', error);
      return null;
    }
  }

  /**
   * Get wallet with private key for trading
   */
  async getWalletWithKey(fid: number, chain: string = 'ethereum'): Promise<BaseAccountWallet | null> {
    try {
      const stored = await this.walletStorage.getWallet(fid, chain);
      
      if (!stored) {
        return null;
      }

      const privateKey = await this.walletStorage.getPrivateKey(fid, chain);
      
      return {
        id: `fid_${fid}_${chain}`,
        address: stored.address,
        chain: stored.chain,
        privateKey: privateKey || undefined,
        createdAt: new Date(stored.createdAt),
      };
    } catch (error) {
      console.error('Error getting wallet with key:', error);
      return null;
    }
  }

  /**
   * Get wallet address only (no private key)
   */
  async getWalletAddress(fid: number, chain: string = 'ethereum'): Promise<string | null> {
    return await this.walletStorage.getWalletAddress(fid, chain);
  }

  /**
   * Check if user has a wallet
   */
  async hasWallet(fid: number, chain: string = 'ethereum'): Promise<boolean> {
    return await this.walletStorage.hasWallet(fid, chain);
  }
}

