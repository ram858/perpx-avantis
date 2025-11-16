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
          createdAt: stored.createdAt ? new Date(stored.createdAt) : new Date(),
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
      
      // Validate generated wallet has private key
      if (!walletInfo.privateKey || walletInfo.privateKey.length !== 66 || !walletInfo.privateKey.startsWith('0x')) {
        throw new Error(`Invalid private key generated: length=${walletInfo.privateKey?.length || 0}, startsWith0x=${walletInfo.privateKey?.startsWith('0x') || false}`);
      }
      
      // Store encrypted wallet
      await this.walletStorage.storeWallet(fid, {
        address: walletInfo.address,
        privateKey: walletInfo.privateKey,
        chain: resolvedChain,
      });

      // Verify the wallet was stored correctly by retrieving it
      const storedWallet = await this.walletStorage.getWallet(fid, resolvedChain);
      if (!storedWallet) {
        throw new Error('Wallet storage failed: wallet not found after storing');
      }
      
      // Verify private key can be retrieved
      const retrievedKey = await this.walletStorage.getPrivateKey(fid, resolvedChain);
      if (!retrievedKey || retrievedKey.length !== 66 || !retrievedKey.startsWith('0x')) {
        throw new Error(`Private key retrieval failed: wallet stored but key not retrievable or invalid`);
      }

      console.log(`✅ Created and verified trading wallet for FID ${fid}: ${walletInfo.address}`);

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
        createdAt: stored.createdAt ? new Date(stored.createdAt) : new Date(),
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
   * If wallet exists but has no private key, deletes it and creates a new one
   * Includes safeguards to prevent infinite loops and race conditions
   */
  async ensureTradingWallet(fid: number): Promise<BaseAccountWallet | null> {
    try {
      const existing = await this.getWalletWithKey(fid, 'ethereum');
      
      // If wallet exists and has valid private key, return it
      if (existing && existing.privateKey && existing.privateKey.length === 66 && existing.privateKey.startsWith('0x')) {
        console.log(`✅ Trading wallet exists with valid private key for FID ${fid}: ${existing.address}`);
        return existing;
      }
      
      // If wallet exists but has no private key or invalid key, delete it
      if (existing && (!existing.privateKey || existing.privateKey.length !== 66 || !existing.privateKey.startsWith('0x'))) {
        console.warn(`⚠️ Trading wallet exists but has invalid/missing private key for FID ${fid}. Deleting and recreating...`);
        try {
          await this.walletStorage.deleteWallet(fid, 'ethereum');
          console.log(`🗑️ Deleted invalid wallet for FID ${fid}`);
          
          // Small delay to ensure DB consistency
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (deleteError) {
          console.error(`❌ Failed to delete invalid wallet:`, deleteError);
          // Continue anyway - will try to create new one (upsert will handle it)
        }
      }
      
      // Create new trading wallet (with retry logic)
      let newWallet: BaseAccountWallet | null = null;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (!newWallet && attempts < maxAttempts) {
        attempts++;
        try {
          newWallet = await this.createTradingWallet(fid, 'ethereum');
          
          if (!newWallet || !newWallet.privateKey) {
            console.warn(`⚠️ Wallet creation attempt ${attempts} failed for FID ${fid}`);
            newWallet = null;
            if (attempts < maxAttempts) {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } catch (error) {
          console.error(`❌ Wallet creation attempt ${attempts} error:`, error);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      if (!newWallet || !newWallet.privateKey) {
        console.error(`❌ Failed to create trading wallet with private key for FID ${fid} after ${attempts} attempts`);
        return null;
      }
      
      // Verify the wallet was stored correctly (with timeout)
      const verifyPromise = this.getWalletWithKey(fid, 'ethereum');
      const timeoutPromise = new Promise<BaseAccountWallet | null>((resolve) => 
        setTimeout(() => resolve(null), 3000)
      );
      
      const verifyWallet = await Promise.race([verifyPromise, timeoutPromise]);
      
      if (!verifyWallet || !verifyWallet.privateKey) {
        console.error(`❌ Wallet created but private key not retrievable for FID ${fid}`);
        // Still return the wallet we created (it might work, just verification failed)
        return newWallet;
      }
      
      console.log(`✅ Trading wallet created and verified for FID ${fid}: ${newWallet.address}`);
      return newWallet;
    } catch (error) {
      console.error(`❌ Unexpected error in ensureTradingWallet for FID ${fid}:`, error);
      return null;
    }
  }

  /**
   * Check if user has a wallet
   */
  async hasWallet(fid: number, chain: string = 'ethereum'): Promise<boolean> {
    const resolvedChain = this.normalizeChain(chain);
    return await this.walletStorage.hasWallet(fid, resolvedChain);
  }
}

