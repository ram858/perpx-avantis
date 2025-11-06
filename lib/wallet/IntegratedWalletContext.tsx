"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserWallet } from '../services/UserWalletService';
import { ClientWalletService } from '../services/ClientWalletService';
import { RealBalanceService, RealBalanceData } from '../services/RealBalanceService';
import { useAuth } from '../auth/AuthContext';
import { useMetaMask } from '../hooks/useMetaMask';
import { hasRealAvantisBalance } from './avantisBalance';

// Types
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price?: number;
}

export interface TokenBalance {
  token: Token;
  balance: string;
  balanceFormatted: string;
  valueUSD: number;
}

export interface IntegratedWalletState {
  isConnected: boolean;
  primaryWallet: UserWallet | null;
  allWallets: UserWallet[];
  ethBalance: string;
  ethBalanceFormatted: string;
  holdings: TokenBalance[];
  totalPortfolioValue: number;
  dailyChange: number;
  dailyChangePercentage: number;
  lastDayValue: number;
  avantisBalance: number;
  isAvantisConnected: boolean;
  hasRealAvantisBalance: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface IntegratedWalletContextType extends IntegratedWalletState {
  refreshWallets: () => Promise<void>;
  createWallet: (chain: string, mnemonic?: string) => Promise<UserWallet | null>;
  switchToWallet: (walletId: string) => Promise<void>;
  refreshBalances: () => Promise<void>;
  getWalletForChain: (chain: string) => UserWallet | null;
}

const IntegratedWalletContext = createContext<IntegratedWalletContextType | undefined>(undefined);

// Real balance service instance
const realBalanceService = new RealBalanceService();

export function IntegratedWalletProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const clientWalletService = new ClientWalletService(() => token || '');
  const { isConnected: isMetaMaskConnected, account: metaMaskAccount } = useMetaMask();
  
  const [state, setState] = useState<IntegratedWalletState>({
    isConnected: false,
    primaryWallet: null,
    allWallets: [],
    ethBalance: '0',
    ethBalanceFormatted: '0.00 ETH',
    holdings: [],
    totalPortfolioValue: 0,
    dailyChange: 0,
    dailyChangePercentage: 0,
    lastDayValue: 0,
    avantisBalance: 0,
    isAvantisConnected: false,
    hasRealAvantisBalance: false,
    isLoading: false,
    error: null
  });

  const refreshWallets = useCallback(async () => {
    // TEMPORARY: Skip authentication for testing
    // TODO: Re-enable authentication once basic functionality is working
    // if (!user?.phoneNumber || !token) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // TEMPORARY: Mock primary wallet for testing
      // TODO: Re-enable authentication once basic functionality is working
      const primaryWallet = {
        id: 'mock-wallet-id',
        address: '0xaa0bA0700Cfd1489d08C63C4bd177638Be4C86F6',
        privateKey: '0xc2614e090f4a9e229c197256ef9c5b0647fadfc44cb1da5b2d5e6969b68ba61b',
        chain: 'ethereum',
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Get all user wallets
      const allWallets = [primaryWallet];

      setState(prev => ({
        ...prev,
        isConnected: !!primaryWallet,
        primaryWallet,
        allWallets,
        isLoading: false
      }));

      // Refresh balances if we have a primary wallet
      if (primaryWallet) {
        await refreshBalances();
      }
    } catch (error) {
      console.error('Error refreshing wallets:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load wallets'
      }));
    }
  }, [user?.fid, token]);

  // Load user wallets on mount
  useEffect(() => {
    if (user?.fid && token) {
      refreshWallets();
    }
  }, [user?.fid, token, refreshWallets]);

  const createWallet = useCallback(async (chain: string, mnemonic?: string): Promise<UserWallet | null> => {
    if (!user?.fid || !token) return null;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await clientWalletService.createWallet({ chain, mnemonic });
      
      if (result.success && result.wallet) {
        // Refresh wallets list
        await refreshWallets();
        return result.wallet;
      } else {
        throw new Error(result.error || 'Failed to create wallet');
      }
    } catch (error) {
      console.error('Error creating wallet:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create wallet'
      }));
      return null;
    }
  }, [user?.fid, token, refreshWallets]);

  const switchToWallet = useCallback(async (walletId: string) => {
    const wallet = state.allWallets.find(w => w.id === walletId);
    if (wallet) {
      setState(prev => ({
        ...prev,
        primaryWallet: wallet,
        isConnected: true
      }));
      await refreshBalances();
    }
  }, [state.allWallets]);

  const refreshBalances = useCallback(async () => {
    if (!state.primaryWallet?.address) {
      console.log('[IntegratedWallet] No primary wallet address, skipping balance refresh');
      return;
    }

    try {
      console.log(`[IntegratedWallet] Fetching real balances for: ${state.primaryWallet.address}`);
      
      // Fetch real blockchain balances
      const balanceData: RealBalanceData = await realBalanceService.getAllBalances(state.primaryWallet.address);
      
      // Convert real balance data to the expected format
      const holdings: TokenBalance[] = balanceData.holdings.map(realToken => ({
        token: {
          address: realToken.token.address,
          symbol: realToken.token.symbol,
          name: realToken.token.name,
          decimals: realToken.token.decimals,
          price: realToken.priceUSD
        },
        balance: realToken.balance,
        balanceFormatted: realToken.balanceFormatted,
        valueUSD: realToken.valueUSD
      }));

      console.log(`[IntegratedWallet] Real balance fetched: $${balanceData.totalPortfolioValue.toFixed(2)}`);

      // Check Avantis connection and fetch balance
      let avantisBalance = 0;
      let isAvantisConnected = false;
      let hasRealAvantisBalanceFlag = false;
      
      // Use stored wallet private key for Avantis
      const avantisPrivateKey = state.primaryWallet.privateKey;
      
      if (avantisPrivateKey) {
        try {
          // Check if wallet has real balance on Avantis
          const avantisStatus = await hasRealAvantisBalance(avantisPrivateKey);
          avantisBalance = avantisStatus.balance;
          isAvantisConnected = avantisStatus.isConnected;
          hasRealAvantisBalanceFlag = avantisStatus.hasBalance;
        } catch (error) {
          console.error('[IntegratedWallet] Error fetching Avantis data:', error);
          // If we can't fetch data, wallet is not connected to Avantis
          isAvantisConnected = false;
          hasRealAvantisBalanceFlag = false;
        }
      }

      const totalPortfolioValue = balanceData.totalPortfolioValue + avantisBalance;

      setState(prev => ({
        ...prev,
        ethBalance: balanceData.ethBalance,
        ethBalanceFormatted: `${balanceData.ethBalanceFormatted} ETH`,
        holdings,
        totalPortfolioValue,
        dailyChange: balanceData.dailyChange,
        dailyChangePercentage: balanceData.dailyChangePercentage,
        lastDayValue: balanceData.lastDayValue,
        avantisBalance,
        isAvantisConnected,
        hasRealAvantisBalance: hasRealAvantisBalanceFlag,
        error: null
      }));
    } catch (error) {
      console.error('[IntegratedWallet] Error refreshing real balances:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to refresh balances'
      }));
    }
  }, [state.primaryWallet, metaMaskAccount, isMetaMaskConnected]);

  // Refresh balances when MetaMask connection changes
  useEffect(() => {
    if (state.primaryWallet && (isMetaMaskConnected || metaMaskAccount)) {
      console.log('[IntegratedWallet] MetaMask connection changed, refreshing balances...');
      refreshBalances();
    }
  }, [isMetaMaskConnected, metaMaskAccount, state.primaryWallet, refreshBalances]);

  const getWalletForChain = useCallback((chain: string): UserWallet | null => {
    return state.allWallets.find(wallet => wallet.chain === chain) || null;
  }, [state.allWallets]);

  const value: IntegratedWalletContextType = {
    ...state,
    refreshWallets,
    createWallet,
    switchToWallet,
    refreshBalances,
    getWalletForChain
  };

  return (
    <IntegratedWalletContext.Provider value={value}>
      {children}
    </IntegratedWalletContext.Provider>
  );
}

export function useIntegratedWallet(): IntegratedWalletContextType {
  const context = useContext(IntegratedWalletContext);
  if (context === undefined) {
    throw new Error('useIntegratedWallet must be used within an IntegratedWalletProvider');
  }
  return context;
}

