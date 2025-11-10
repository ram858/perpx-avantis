/**
 * Minimal wallet storage service for Base mini-apps
 * Stores encrypted wallet keys using FID (Farcaster ID) as key
 * 
 * Uses Vercel KV (Redis) or localStorage as backend
 */

import { EncryptionService } from './EncryptionService';

export interface StoredWallet {
  address: string;
  encryptedPrivateKey: string;
  iv: string;
  chain: string;
  createdAt: string;
}

export class WalletStorageService {
  private encryptionService: EncryptionService;
  private useKV: boolean;

  constructor() {
    this.encryptionService = new EncryptionService();
    // Use Vercel KV if KV_URL is set and we're on server-side, otherwise use localStorage
    // Check for server-side environment safely
    this.useKV = typeof process !== 'undefined' && 
                 typeof process.env !== 'undefined' && 
                 !!process.env.KV_URL;
  }

  /**
   * Store encrypted wallet for a FID
   */
  async storeWallet(fid: number, wallet: {
    address: string;
    privateKey: string;
    chain: string;
  }): Promise<void> {
    try {
      // Encrypt the private key
      const encryptionResult = this.encryptionService.encrypt(wallet.privateKey);
      
      const storedWallet: StoredWallet = {
        address: wallet.address,
        encryptedPrivateKey: encryptionResult.encrypted,
        iv: encryptionResult.iv,
        chain: wallet.chain,
        createdAt: new Date().toISOString(),
      };

      const key = `wallet:${fid}:${wallet.chain}`;

      if (this.useKV && typeof process !== 'undefined' && process.env.KV_URL) {
        try {
          // Use Vercel KV (server-side only) - dynamic import to avoid build errors
          // @ts-ignore - Optional dependency, may not be installed
          const kvModule = await import(
            /* webpackIgnore: true */
            '@vercel/kv'
          ).catch(() => null);
          if (kvModule) {
            const { kv } = kvModule;
            await kv.set(key, JSON.stringify(storedWallet));
            return;
          }
        } catch (kvError) {
          // KV not available, fall through to localStorage
        }
      }
      
      // Use localStorage (client-side or fallback)
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(storedWallet));
      } else {
        throw new Error('No storage backend available');
      }

      console.log(`✅ Stored wallet for FID ${fid}, chain: ${wallet.chain}`);
    } catch (error) {
      console.error('Error storing wallet:', error);
      throw new Error('Failed to store wallet');
    }
  }

  /**
   * Get encrypted wallet for a FID
   */
  async getWallet(fid: number, chain: string = 'ethereum'): Promise<StoredWallet | null> {
    try {
      const key = `wallet:${fid}:${chain}`;

      let stored: string | null = null;

      if (this.useKV && typeof process !== 'undefined' && process.env.KV_URL) {
        try {
          // Use Vercel KV (server-side only) - dynamic import to avoid build errors
          // @ts-ignore - Optional dependency, may not be installed
          const kvModule = await import(
            /* webpackIgnore: true */
            '@vercel/kv'
          ).catch(() => null);
          if (kvModule) {
            const { kv } = kvModule;
            // @ts-ignore - Type may not be available
            stored = await kv.get(key) as string | null;
            if (stored) return JSON.parse(stored) as StoredWallet;
          }
        } catch (kvError) {
          // KV not available, fall through to localStorage
        }
      }
      
      // Use localStorage (client-side or fallback)
      if (typeof window !== 'undefined') {
        stored = localStorage.getItem(key);
      }

      if (!stored) {
        return null;
      }

      return JSON.parse(stored) as StoredWallet;
    } catch (error) {
      console.error('Error getting wallet:', error);
      return null;
    }
  }

  /**
   * Get decrypted private key for a FID
   */
  async getPrivateKey(fid: number, chain: string = 'ethereum'): Promise<string | null> {
    try {
      const stored = await this.getWallet(fid, chain);
      
      if (!stored) {
        return null;
      }

      // Decrypt the private key
      const decrypted = this.encryptionService.decrypt(
        stored.encryptedPrivateKey,
        stored.iv
      );

      return decrypted;
    } catch (error) {
      console.error('Error getting private key:', error);
      return null;
    }
  }

  /**
   * Get wallet address for a FID
   */
  async getWalletAddress(fid: number, chain: string = 'ethereum'): Promise<string | null> {
    try {
      const stored = await this.getWallet(fid, chain);
      return stored?.address || null;
    } catch (error) {
      console.error('Error getting wallet address:', error);
      return null;
    }
  }

  /**
   * Delete wallet for a FID
   */
  async deleteWallet(fid: number, chain: string = 'ethereum'): Promise<void> {
    try {
      const key = `wallet:${fid}:${chain}`;

      if (this.useKV && typeof process !== 'undefined' && process.env.KV_URL) {
        try {
          // Use Vercel KV (server-side only) - dynamic import to avoid build errors
          // @ts-ignore - Optional dependency, may not be installed
          const kvModule = await import(
            /* webpackIgnore: true */
            '@vercel/kv'
          ).catch(() => null);
          if (kvModule) {
            const { kv } = kvModule;
            await kv.del(key);
            return;
          }
        } catch (kvError) {
          // KV not available, fall through to localStorage
        }
      }
      
      // Use localStorage (client-side or fallback)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }

      console.log(`🗑️ Deleted wallet for FID ${fid}, chain: ${chain}`);
    } catch (error) {
      console.error('Error deleting wallet:', error);
      throw new Error('Failed to delete wallet');
    }
  }

  /**
   * Check if wallet exists for a FID
   */
  async hasWallet(fid: number, chain: string = 'ethereum'): Promise<boolean> {
    const stored = await this.getWallet(fid, chain);
    return stored !== null;
  }
}

