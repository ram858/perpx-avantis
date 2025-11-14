/**
 * Wallet service for Base Account users
 * Uses FID (Farcaster ID) instead of phone numbers
 * Stores wallets in PostgreSQL via Supabase (scalable, production-ready)
 */

import { DatabaseWalletStorageService } from './DatabaseWalletStorageService';
import { EncryptionService } from './EncryptionService';

export interface BaseAccountWallet {
  id: string;
  address: string;
  chain: string;
  privateKey?: string;
  createdAt: Date;
}

export class BaseAccountWalletService {
  private walletStorage: DatabaseWalletStorageService;
  private encryptionService: EncryptionService;
  private readonly BASE_ACCOUNT_CHAIN = 'base-account';

  constructor() {
    this.walletStorage = new DatabaseWalletStorageService();
    this.encryptionService = new EncryptionService();
  }

  private normalizeChain(chain: string): string {
    const normalized = (chain || 'ethereum').toLowerCase();
    if (normalized === 'base' || normalized === 'base-account' || normalized === 'ethereum-base') {
      return this.BASE_ACCOUNT_CHAIN;
    }
    return normalized;
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
        chain: this.BASE_ACCOUNT_CHAIN,
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
      const resolvedChain = this.normalizeChain(chain);

      // Check if wallet exists in storage
      const stored = await this.walletStorage.getWallet(fid, resolvedChain);
      
      if (stored) {
        // Wallet exists, return it
        const privateKey = await this.walletStorage.getPrivateKey(fid, resolvedChain);
        return {
          id: `fid_${fid}_${resolvedChain}`,
          address: stored.address,
          chain: stored.chain,
          privateKey: privateKey && privateKey.length > 0 ? privateKey : undefined, // Only return if not empty
          createdAt: new Date(stored.createdAt),
        };
      }

      if (resolvedChain === this.BASE_ACCOUNT_CHAIN) {
        console.log(`⚠️ No Base Account wallet stored for FID ${fid}.`);
        return null;
      }

      // If no wallet exists, return null
      // Base Account addresses should be stored via storeBaseAccountAddress()
      // Traditional wallets can be created here if needed
      console.log(`⚠️ No wallet found for FID ${fid} on chain ${resolvedChain}.`);
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
      const resolvedChain = this.normalizeChain(chain);
      if (resolvedChain !== 'ethereum') {
        throw new Error(`Trading wallets are only supported on Ethereum chain. Requested: ${resolvedChain}`);
      }

      // Create new wallet using the chain-specific wallet service
      const { EthereumWalletService } = await import('./wallets/EthereumWalletService');
      const ethereumService = new EthereumWalletService();
      
      // Generate new wallet
      const walletInfo = await ethereumService.generateWallet();
      
      // Store encrypted wallet
      await this.walletStorage.storeWallet(fid, {
        address: walletInfo.address,
        privateKey: walletInfo.privateKey,
        chain: resolvedChain,
      });

      console.log(`✅ Created trading wallet for FID ${fid}: ${walletInfo.address}`);

      return {
        id: `fid_${fid}_${resolvedChain}`,
        address: walletInfo.address,
        chain: resolvedChain,
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
      const resolvedChain = this.normalizeChain(chain);
      const stored = await this.walletStorage.getWallet(fid, resolvedChain);
      
      if (!stored) {
        return null;
      }

      const privateKey = await this.walletStorage.getPrivateKey(fid, resolvedChain);
      
      return {
        id: `fid_${fid}_${resolvedChain}`,
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
    const resolvedChain = this.normalizeChain(chain);
    return await this.walletStorage.getWalletAddress(fid, resolvedChain);
  }

  /**
   * Get Base Account address if stored (supports legacy location)
   */
  async getBaseAccountAddress(fid: number): Promise<string | null> {
    // Preferred location
    const baseAddress = await this.walletStorage.getWalletAddress(fid, this.BASE_ACCOUNT_CHAIN);
    if (baseAddress) {
      return baseAddress;
    }

    // Legacy storage (before migration) - stored under 'ethereum' without private key
    const legacyWallet = await this.walletStorage.getWallet(fid, 'ethereum');
    if (legacyWallet) {
      const privateKey = await this.walletStorage.getPrivateKey(fid, 'ethereum');
      if (!privateKey || privateKey.length === 0) {
        return legacyWallet.address;
      }
    }

    return null;
  }

  /**
   * Ensure a trading wallet exists (creates one if missing)
   */
  async ensureTradingWallet(fid: number): Promise<BaseAccountWallet | null> {
    const existing = await this.getWalletWithKey(fid, 'ethereum');
    if (existing && existing.privateKey) {
      return existing;
    }
    return await this.createTradingWallet(fid, 'ethereum');
  }

  /**
   * Check if user has a wallet
   */
  async hasWallet(fid: number, chain: string = 'ethereum'): Promise<boolean> {
    const resolvedChain = this.normalizeChain(chain);
    return await this.walletStorage.hasWallet(fid, resolvedChain);
  }
}

