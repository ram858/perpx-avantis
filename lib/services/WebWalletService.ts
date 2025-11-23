/**
 * Web Wallet Service
 * 
 * Handles wallet operations for web users (non-Farcaster)
 * Automatically creates trading wallet when user is created
 */

import { getSupabaseClient } from '@/lib/db/supabase';
import { EncryptionService } from './EncryptionService';
import { EthereumWalletService } from './wallets/EthereumWalletService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WebStoredWallet {
  user_id: number;
  address: string;
  encryptedPrivateKey?: string;
  privateKey?: string; // Raw private key (will be encrypted)
  iv?: string;
  chain: string;
  walletType?: string;
  createdAt?: string;
}

export interface WebWallet {
  id: number;
  user_id: number;
  address: string;
  chain: string;
  wallet_type: string;
  created_at: string;
  updated_at: string;
}

export class WebWalletService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Automatically create a trading wallet for a web user
   * This is called when a web user is first created
   */
  async createTradingWalletForUser(userId: number, chain: string = 'ethereum'): Promise<WebWallet> {
    try {
      // Check if wallet already exists
      const existingWallet = await this.getWallet(userId, chain);
      if (existingWallet) {
        console.log(`[WebWalletService] Trading wallet already exists for user ${userId}`);
        return existingWallet;
      }

      // Generate new Ethereum wallet
      const ethereumService = new EthereumWalletService();
      const walletInfo = await ethereumService.generateWallet();

      // Validate generated wallet
      if (!walletInfo.privateKey || walletInfo.privateKey.length !== 66 || !walletInfo.privateKey.startsWith('0x')) {
        throw new Error(`Invalid private key generated`);
      }

      // Encrypt private key
      const encrypted = this.encryptionService.encrypt(walletInfo.privateKey);
      const encryptedPrivateKey = encrypted.encrypted;
      const iv = encrypted.iv;

      // Store wallet in database
      const supabase = getSupabaseClient();
      const { data: newWallet, error } = await (supabase
        .from('web_wallets') as any)
        .insert({
          user_id: userId,
          address: walletInfo.address,
          encrypted_private_key: encryptedPrivateKey,
          iv: iv,
          chain: chain.toLowerCase(),
          wallet_type: 'trading',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[WebWalletService] Error storing wallet:', error);
        throw new Error(`Failed to store wallet: ${error.message}`);
      }

      console.log(`[WebWalletService] ✅ Created trading wallet for web user ${userId}: ${walletInfo.address}`);
      
      return newWallet as WebWallet;
    } catch (error) {
      console.error('[WebWalletService] Error creating trading wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet for a web user
   */
  async getWallet(userId: number, chain: string = 'ethereum'): Promise<WebWallet | null> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('web_wallets') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('chain', chain.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('[WebWalletService] Error fetching wallet:', error);
        throw new Error(`Failed to fetch wallet: ${error.message}`);
      }

      return data as WebWallet;
    } catch (error) {
      console.error('[WebWalletService] Error getting wallet:', error);
      throw error;
    }
  }

  /**
   * Get all wallets for a web user
   */
  async getAllWallets(userId: number): Promise<WebWallet[]> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('web_wallets') as any)
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('[WebWalletService] Error fetching wallets:', error);
        throw new Error(`Failed to fetch wallets: ${error.message}`);
      }

      return (data || []) as WebWallet[];
    } catch (error) {
      console.error('[WebWalletService] Error getting wallets:', error);
      throw error;
    }
  }

  /**
   * Get decrypted private key for a wallet
   */
  async getPrivateKey(userId: number, chain: string = 'ethereum'): Promise<string | null> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('web_wallets') as any)
        .select('encrypted_private_key, iv')
        .eq('user_id', userId)
        .eq('chain', chain.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to fetch wallet: ${error.message}`);
      }

      if (!data.encrypted_private_key || !data.iv) {
        return null;
      }

      // Decrypt the private key
      const decryptedKey = this.encryptionService.decrypt(
        data.encrypted_private_key,
        data.iv
      );

      return decryptedKey;
    } catch (error) {
      console.error('[WebWalletService] Error getting private key:', error);
      throw error;
    }
  }

  /**
   * Get wallet address only
   */
  async getWalletAddress(userId: number, chain: string = 'ethereum'): Promise<string | null> {
    try {
      const wallet = await this.getWallet(userId, chain);
      return wallet?.address || null;
    } catch (error) {
      console.error('[WebWalletService] Error getting wallet address:', error);
      throw error;
    }
  }

  /**
   * Ensure trading wallet exists (create if needed)
   */
  async ensureTradingWallet(userId: number): Promise<WebWallet> {
    const existingWallet = await this.getWallet(userId, 'ethereum');
    if (existingWallet) {
      return existingWallet;
    }
    return await this.createTradingWalletForUser(userId, 'ethereum');
  }
}

