/**
 * Database Wallet Storage Service (Supabase/PostgreSQL)
 * 
 * This service replaces the filesystem-based WalletStorageService.
 * It stores encrypted wallets in PostgreSQL via Supabase.
 * 
 * Key Features:
 * - Scalable to millions of users
 * - ACID transactions
 * - Fast indexed queries
 * - Automatic backups
 * - Works on serverless platforms
 */

import { getSupabaseClient, type Database } from '@/lib/db/supabase';
import { EncryptionService } from './EncryptionService';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface StoredWallet {
  fid?: number;
  address: string;
  encryptedPrivateKey?: string;
  privateKey?: string; // Raw private key (will be encrypted)
  iv?: string;
  chain: string;
  walletType?: string;
  createdAt?: string;
}

export class DatabaseWalletStorageService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Store a wallet in the database
   * Uses UPSERT to insert or update if already exists
   * Automatically encrypts private key if provided
   */
  async storeWallet(fid: number, wallet: StoredWallet): Promise<void> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      // Determine wallet type from chain
      const walletType = wallet.chain === 'base-account' ? 'base-account' : 'trading';

      let encryptedPrivateKey: string | null = null;
      let iv: string | null = null;

      // Encrypt private key if provided (for trading wallets)
      if (wallet.privateKey && wallet.privateKey.length > 0) {
        const encrypted = this.encryptionService.encrypt(wallet.privateKey);
        encryptedPrivateKey = encrypted.encrypted; // Note: property is 'encrypted', not 'encryptedData'
        iv = encrypted.iv;
      } else if (wallet.encryptedPrivateKey) {
        // Already encrypted
        encryptedPrivateKey = wallet.encryptedPrivateKey;
        iv = wallet.iv || null;
      }

      // @ts-ignore - Supabase type inference issue with nullable fields
      const { error } = await supabase
        .from('wallets')
        .upsert(
          {
            fid,
            address: wallet.address,
            encrypted_private_key: encryptedPrivateKey,
            iv: iv,
            chain: wallet.chain,
            wallet_type: walletType,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'fid,chain', // Update if exists
          }
        );

      if (error) {
        console.error('[DatabaseWalletStorageService] Error storing wallet:', error);
        throw new Error(`Failed to store wallet: ${error.message}`);
      }

      // Log the wallet creation/update for audit
      await this.logWalletAccess(fid, wallet.chain, 'created');
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Unexpected error storing wallet:', error);
      throw error;
    }
  }

  /**
   * Get a wallet from the database (without decrypting private key)
   */
  async getWallet(fid: number, chain: string): Promise<StoredWallet | null> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      // @ts-ignore - Supabase type inference issue
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('fid', fid)
        .eq('chain', chain)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - wallet doesn't exist
          return null;
        }
        console.error('[DatabaseWalletStorageService] Error fetching wallet:', error);
        throw new Error(`Failed to fetch wallet: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      // Log the wallet access for audit
      await this.logWalletAccess(fid, chain, 'accessed');

      // Type cast to work around Supabase type inference issue
      const wallet = data as any;
      return {
        fid: wallet.fid,
        address: wallet.address,
        encryptedPrivateKey: wallet.encrypted_private_key,
        iv: wallet.iv,
        chain: wallet.chain,
        walletType: wallet.wallet_type,
        createdAt: wallet.created_at,
      };
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Unexpected error fetching wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet address only (faster, no need to fetch encrypted key)
   */
  async getWalletAddress(fid: number, chain: string): Promise<string | null> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      const { data, error } = await supabase
        .from('wallets')
        .select('address')
        .eq('fid', fid)
        .eq('chain', chain)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to fetch wallet address: ${error.message}`);
      }

      return (data as any)?.address || null;
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Error fetching wallet address:', error);
      throw error;
    }
  }

  /**
   * Get decrypted private key for a wallet
   */
  async getPrivateKey(fid: number, chain: string): Promise<string | null> {
    try {
      const wallet = await this.getWallet(fid, chain);

      if (!wallet) {
        return null;
      }

      // Check if encrypted private key exists (Base Account wallets don't have private keys)
      if (!wallet.encryptedPrivateKey || !wallet.iv) {
        return null;
      }

      // Decrypt the private key
      const decryptedKey = this.encryptionService.decrypt(
        wallet.encryptedPrivateKey,
        wallet.iv
      );

      // Log private key access for security audit
      await this.logWalletAccess(fid, chain, 'private_key_accessed');

      return decryptedKey;
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Error decrypting private key:', error);
      throw error;
    }
  }

  /**
   * Check if a wallet exists for a user
   */
  async hasWallet(fid: number, chain: string): Promise<boolean> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      const { count, error } = await supabase
        .from('wallets')
        .select('id', { count: 'exact', head: true })
        .eq('fid', fid)
        .eq('chain', chain);

      if (error) {
        console.error('[DatabaseWalletStorageService] Error checking wallet existence:', error);
        throw new Error(`Failed to check wallet existence: ${error.message}`);
      }

      return (count ?? 0) > 0;
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Unexpected error checking wallet:', error);
      throw error;
    }
  }

  /**
   * Get all wallets for a user (both trading and base-account)
   */
  async getAllWalletsByFid(fid: number): Promise<StoredWallet[]> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('fid', fid)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DatabaseWalletStorageService] Error fetching user wallets:', error);
        throw new Error(`Failed to fetch user wallets: ${error.message}`);
      }

      return (data || []).map((row: any) => ({
        fid: row.fid,
        address: row.address,
        encryptedPrivateKey: row.encrypted_private_key,
        iv: row.iv,
        chain: row.chain,
        walletType: row.wallet_type,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Unexpected error fetching wallets:', error);
      throw error;
    }
  }

  /**
   * Delete a wallet (use with caution!)
   * Also deletes related audit logs
   */
  async deleteWallet(fid: number, chain: string): Promise<void> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      // Get wallet ID first
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('fid', fid)
        .eq('chain', chain)
        .single();

      if (!wallet) {
        return; // Wallet doesn't exist, nothing to delete
      }

      // Delete audit logs first (to avoid foreign key constraint)
      await supabase
        .from('wallet_audit_log')
        .delete()
        .eq('wallet_id', (wallet as any).id);

      // Now delete the wallet
      const { error } = await supabase
        .from('wallets')
        .delete()
        .eq('fid', fid)
        .eq('chain', chain);

      if (error) {
        console.error('[DatabaseWalletStorageService] Error deleting wallet:', error);
        throw new Error(`Failed to delete wallet: ${error.message}`);
      }
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Unexpected error deleting wallet:', error);
      throw error;
    }
  }

  /**
   * Update wallet metadata (balance, transaction count, etc.)
   */
  async updateWalletMetadata(
    fid: number,
    chain: string,
    metadata: {
      balanceUsd?: number;
      totalDeposits?: number;
      totalWithdrawals?: number;
      transactionCount?: number;
    }
  ): Promise<void> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      // First, get the wallet ID
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('fid', fid)
        .eq('chain', chain)
        .single();

      if (walletError || !wallet) {
        console.error('[DatabaseWalletStorageService] Wallet not found for metadata update');
        return;
      }

      // Update or insert metadata
      // @ts-ignore - Supabase type inference issue with nullable fields
      const { error } = await supabase.from('wallet_metadata').upsert(
        {
          wallet_id: (wallet as any).id,
          balance_usd: metadata.balanceUsd,
          total_deposits: metadata.totalDeposits,
          total_withdrawals: metadata.totalWithdrawals,
          transaction_count: metadata.transactionCount,
          last_balance_check: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'wallet_id',
        }
      );

      if (error) {
        console.error('[DatabaseWalletStorageService] Error updating metadata:', error);
      }
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Unexpected error updating metadata:', error);
    }
  }

  /**
   * Log wallet access for security audit
   */
  private async logWalletAccess(
    fid: number,
    chain: string,
    action: string
  ): Promise<void> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      // Get wallet ID first
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('fid', fid)
        .eq('chain', chain)
        .single();

      if (!wallet) {
        return;
      }

      // Insert audit log (fire and forget - don't block main operation)
      // @ts-ignore - Supabase type inference issue
      await supabase.from('wallet_audit_log').insert({
        wallet_id: (wallet as any).id,
        action,
        accessed_by: 'backend_api',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Don't throw - audit logging shouldn't break the main flow
      console.error('[DatabaseWalletStorageService] Error logging wallet access:', error);
    }
  }

  /**
   * Get wallet statistics (for admin/analytics)
   */
  async getWalletStats(): Promise<{
    totalWallets: number;
    tradingWallets: number;
    baseAccountWallets: number;
    totalUsers: number;
  }> {
    try {
      const supabase: SupabaseClient<Database> = getSupabaseClient();

      const { count: totalWallets } = await supabase
        .from('wallets')
        .select('id', { count: 'exact', head: true });

      const { count: tradingWallets } = await supabase
        .from('wallets')
        .select('id', { count: 'exact', head: true })
        .eq('wallet_type', 'trading');

      const { count: baseAccountWallets } = await supabase
        .from('wallets')
        .select('id', { count: 'exact', head: true })
        .eq('wallet_type', 'base-account');

      const { data: uniqueUsers } = await supabase
        .from('wallets')
        .select('fid', { count: 'exact' })
        .then(({ data }) => ({ data: [...new Set(data?.map((w: any) => w.fid))] }));

      return {
        totalWallets: totalWallets ?? 0,
        tradingWallets: tradingWallets ?? 0,
        baseAccountWallets: baseAccountWallets ?? 0,
        totalUsers: uniqueUsers?.length ?? 0,
      };
    } catch (error) {
      console.error('[DatabaseWalletStorageService] Error fetching stats:', error);
      throw error;
    }
  }
}

