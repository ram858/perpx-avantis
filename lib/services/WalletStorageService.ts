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
  private storagePath: string;

  constructor() {
    this.encryptionService = new EncryptionService();
    this.storagePath = process.env.WALLET_STORAGE_PATH || './storage/wallets';
  }

  private async getServerFilePath(fid: number, chain: string) {
    const path = await import('path');
    const fs = await import('fs/promises');

    const basePath = this.storagePath.startsWith('/')
      ? this.storagePath
      : path.join(process.cwd(), this.storagePath);

    await fs.mkdir(basePath, { recursive: true });

    const fileName = `wallet_${fid}_${chain}.json`;
    return {
      filePath: path.join(basePath, fileName),
      fs,
    };
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
      const encryptionResult = this.encryptionService.encrypt(wallet.privateKey);

      const storedWallet: StoredWallet = {
        address: wallet.address,
        encryptedPrivateKey: encryptionResult.encrypted,
        iv: encryptionResult.iv,
        chain: wallet.chain,
        createdAt: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        console.warn('[WalletStorageService] Wallet storage is server-only. Skipping on client.');
        return;
      }

      const { filePath, fs } = await this.getServerFilePath(fid, wallet.chain);
      await fs.writeFile(filePath, JSON.stringify(storedWallet, null, 2), 'utf-8');

      console.log(`✅ Stored wallet for FID ${fid}, chain: ${wallet.chain} (file: ${filePath})`);
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
      if (typeof window !== 'undefined') {
        console.warn('[WalletStorageService] Wallet retrieval is server-only. Returning null on client.');
        return null;
      }

      const { filePath, fs } = await this.getServerFilePath(fid, chain);

      try {
        const stored = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(stored) as StoredWallet;
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          return null;
        }
        throw err;
      }
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
      if (typeof window !== 'undefined') {
        console.warn('[WalletStorageService] Wallet deletion is server-only. Skipping on client.');
        return;
      }

      const { filePath, fs } = await this.getServerFilePath(fid, chain);

      try {
        await fs.unlink(filePath);
        console.log(`🗑️ Deleted wallet for FID ${fid}, chain: ${chain}`);
      } catch (err: any) {
        if (err?.code !== 'ENOENT') {
          throw err;
        }
      }
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

