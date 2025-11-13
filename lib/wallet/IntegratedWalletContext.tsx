"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ClientWalletService, ClientUserWallet } from '../services/ClientWalletService';
import { RealBalanceData } from '../services/RealBalanceService';
import { useAuth } from '../auth/AuthContext';
import { useMetaMask } from '../hooks/useMetaMask';
import { getNetworkConfig } from '../config/network';

// Types
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price?: number;
  isNative?: boolean;
}

export interface TokenBalance {
  token: Token;
  balance: string;
  balanceFormatted: string;
  valueUSD: number;
}

export interface IntegratedWalletState {
  isConnected: boolean;
  primaryWallet: ClientUserWallet | null;
  tradingWallet: ClientUserWallet | null;
  baseAccountAddress: string | null;
  tradingWalletAddress: string | null;
  allWallets: ClientUserWallet[];
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
  createWallet: (chain: string, mnemonic?: string) => Promise<ClientUserWallet | null>;
  switchToWallet: (walletId: string) => Promise<void>;
  refreshBalances: () => Promise<void>;
  getWalletForChain: (chain: string) => ClientUserWallet | null;
}

const IntegratedWalletContext = createContext<IntegratedWalletContextType | undefined>(undefined);

export function IntegratedWalletProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const clientWalletService = new ClientWalletService(() => token || '');
  const { isConnected: isMetaMaskConnected, account: metaMaskAccount } = useMetaMask();
  const networkConfig = useMemo(() => getNetworkConfig(), []);
  const nativeSymbol = networkConfig.nativeSymbol || 'ETH';
  
  // Ref to prevent concurrent balance refresh calls
  const isRefreshingRef = React.useRef(false);
  
  const [state, setState] = useState<IntegratedWalletState>({
    isConnected: false,
    primaryWallet: null,
    tradingWallet: null,
    baseAccountAddress: null,
    tradingWalletAddress: null,
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

  const fetchBalanceData = useCallback(async (address: string): Promise<RealBalanceData> => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = `/api/wallet/balances?address=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch balance data');
    }

    const result = await response.json();
    return result.balance as RealBalanceData;
  }, [token]);

  // Define refreshBalances first to avoid circular dependency
  const refreshBalances = useCallback(async (walletOverride?: ClientUserWallet | null, tradingOverride?: ClientUserWallet | null) => {
    const walletToUse = walletOverride || state.primaryWallet;
    const addressToUse =
      walletToUse?.address ||
      walletOverride?.address ||
      state.baseAccountAddress ||
      user?.baseAccountAddress ||
      null;

    if (!addressToUse || !token) {
      console.log('[IntegratedWallet] No wallet address available, skipping balance refresh');
      return;
    }

    // Prevent concurrent calls
    if (isRefreshingRef.current) {
      console.log('[IntegratedWallet] Balance refresh already in progress, skipping...');
      return;
    }

    try {
      isRefreshingRef.current = true;
      
      // Set loading state while preserving previous values to prevent flickering
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      console.log(`[IntegratedWallet] Fetching real balances for: ${addressToUse}`);

      const balanceData = await fetchBalanceData(addressToUse);

      // Convert real balance data to the expected format
      const holdings: TokenBalance[] = balanceData.holdings.map(realToken => ({
        token: {
          address: realToken.token.address,
          symbol: realToken.token.symbol,
          name: realToken.token.name,
          decimals: realToken.token.decimals,
          price: realToken.priceUSD,
          isNative: realToken.token.isNative
        },
        balance: realToken.balance,
        balanceFormatted: realToken.balanceFormatted,
        valueUSD: realToken.valueUSD
      }));

      console.log(`[IntegratedWallet] Real balance fetched: $${balanceData.totalPortfolioValue.toFixed(2)}`);

      // Determine trading wallet balance (only if it exists and is different from base account)
      // NOTE: Trading wallet is only needed for fully automated trading.
      // For normal trading, we use Base Account directly (no separate vault needed).
      let tradingAddress =
        tradingOverride?.address ||
        state.tradingWallet?.address ||
        state.tradingWalletAddress ||
        (walletOverride?.walletType === 'trading' ? walletOverride.address : null);

      // If trading address is not in state, try to fetch it from API
      if (!tradingAddress && user?.fid && token) {
        try {
          const wallets = await clientWalletService.getAllUserWallets();
          const tradingWallet = wallets.find(w => w.walletType === 'trading');
          if (tradingWallet) {
            tradingAddress = tradingWallet.address;
            console.log(`[IntegratedWallet] Found trading wallet from API: ${tradingAddress}`);
          }
        } catch (walletFetchError) {
          console.warn('[IntegratedWallet] Could not fetch trading wallet from API:', walletFetchError);
        }
      }

      let avantisBalance = 0;
      let tradingVaultHoldings: TokenBalance[] = [];
      
      // Only fetch trading vault balance if:
      // 1. Trading wallet exists
      // 2. It's different from the base account address
      // 3. User has explicitly created it for automated trading
      if (tradingAddress && tradingAddress.toLowerCase() !== addressToUse.toLowerCase()) {
        try {
          console.log(`[IntegratedWallet] Fetching trading vault balances for: ${tradingAddress}`);
          console.log(`[IntegratedWallet] NOTE: Trading vault is only used for fully automated trading. Normal trading uses Base Account directly.`);
          const tradingBalanceData = await fetchBalanceData(tradingAddress);
          avantisBalance = tradingBalanceData.totalPortfolioValue;
          
          // Merge trading vault holdings into main holdings (mark them as vault holdings)
          tradingVaultHoldings = tradingBalanceData.holdings
            .filter(vaultHolding => parseFloat(vaultHolding.balance) > 0) // Only show non-zero balances
            .map(realToken => ({
              token: {
                ...realToken.token,
                name: `${realToken.token.name} (Trading Vault)`, // Mark as vault holdings
                price: realToken.priceUSD
              },
              balance: realToken.balance,
              balanceFormatted: realToken.balanceFormatted,
              valueUSD: realToken.valueUSD
            }));
          
          console.log(`[IntegratedWallet] Trading vault balance: $${avantisBalance.toFixed(2)} (${tradingVaultHoldings.length} holdings)`);
        } catch (vaultError) {
          console.warn('[IntegratedWallet] Unable to fetch trading vault balance:', vaultError);
          console.warn('[IntegratedWallet] This is normal if no trading wallet exists. Trading will use Base Account directly.');
        }
      } else {
        if (tradingAddress) {
          console.log(`[IntegratedWallet] Trading vault address (${tradingAddress}) is same as base account (${addressToUse}) - skipping separate fetch`);
        } else {
          console.log(`[IntegratedWallet] No separate trading vault found - using Base Account for all trading`);
        }
      }

      // Combine Base Account holdings with Trading Vault holdings
      // Deduplicate by token address to avoid showing same token twice
      const combinedHoldingsMap = new Map<string, TokenBalance>();
      
      // Add Base Account holdings first
      holdings.forEach(holding => {
        const key = holding.token.address.toLowerCase();
        combinedHoldingsMap.set(key, holding);
      });
      
      // Add/merge Trading Vault holdings
      tradingVaultHoldings.forEach(vaultHolding => {
        const key = vaultHolding.token.address.toLowerCase();
        const existing = combinedHoldingsMap.get(key);
        
        if (existing) {
          // Merge: combine balances
          // Parse formatted strings (e.g., "20.0000 USDC" -> 20.0)
          const parseFormatted = (str: string): number => {
            const match = str.match(/^([\d.]+)/);
            return match ? parseFloat(match[1]) : 0;
          };
          
          const existingNum = parseFormatted(existing.balanceFormatted);
          const vaultNum = parseFormatted(vaultHolding.balanceFormatted);
          const totalNum = existingNum + vaultNum;
          
          // Re-format with same symbol and appropriate decimals
          const symbol = existing.token.symbol;
          const decimals = symbol === 'USDC' ? 4 : 6; // USDC uses 4, ETH uses 6
          const formatted = `${totalNum.toFixed(decimals)} ${symbol}`;
          
          // Combine raw balances (add BigInt values)
          const existingBalanceBig = BigInt(existing.balance || '0');
          const vaultBalanceBig = BigInt(vaultHolding.balance || '0');
          const totalBalanceBig = existingBalanceBig + vaultBalanceBig;
          
          combinedHoldingsMap.set(key, {
            ...existing,
            balance: totalBalanceBig.toString(),
            balanceFormatted: formatted,
            valueUSD: existing.valueUSD + vaultHolding.valueUSD,
            token: {
              ...existing.token,
              name: existing.token.name // Keep original name, balance includes vault
            }
          });
        } else {
          // New holding from vault
          combinedHoldingsMap.set(key, vaultHolding);
        }
      });

      const combinedHoldings = Array.from(combinedHoldingsMap.values());
      
      // Calculate total portfolio value
      // balanceData.totalPortfolioValue already includes ETH + all tokens from base account
      // avantisBalance already includes ETH + all tokens from trading vault
      const totalPortfolioValue = balanceData.totalPortfolioValue + avantisBalance;

      // Debug logging
      console.log('[IntegratedWallet] Balance calculation breakdown:');
      console.log(`  - Base account address: ${addressToUse}`);
      console.log(`  - Trading vault address: ${tradingAddress || 'none'}`);
      console.log(`  - Base account total: $${balanceData.totalPortfolioValue.toFixed(2)}`);
      console.log(`  - Trading vault total: $${avantisBalance.toFixed(2)}`);
      console.log(`  - Combined total: $${totalPortfolioValue.toFixed(2)}`);
      console.log(`  - Combined holdings count: ${combinedHoldings.length}`);
      combinedHoldings.forEach(h => {
        console.log(`    - ${h.token.symbol}: $${h.valueUSD.toFixed(2)} (${h.balanceFormatted})`);
      });

      const nativeHolding = holdings.find(
        holding => holding.token.symbol.toUpperCase() === nativeSymbol.toUpperCase()
      );

      // Find native holding from combined holdings
      const combinedNativeHolding = combinedHoldings.find(
        holding => holding.token.symbol.toUpperCase() === nativeSymbol.toUpperCase()
      );

      // Update state with all balances at once - this prevents flickering
      setState(prev => ({
        ...prev,
        ethBalance: balanceData.ethBalance,
        ethBalanceFormatted: combinedNativeHolding?.balanceFormatted || nativeHolding?.balanceFormatted || `${balanceData.ethBalanceFormatted} ${nativeSymbol}`,
        holdings: combinedHoldings,
        totalPortfolioValue,
        dailyChange: balanceData.dailyChange,
        dailyChangePercentage: balanceData.dailyChangePercentage,
        lastDayValue: balanceData.lastDayValue,
        avantisBalance,
        isAvantisConnected: avantisBalance > 0,
        hasRealAvantisBalance: avantisBalance > 0,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      console.error('[IntegratedWallet] Error refreshing real balances:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to refresh balances'
      }));
    } finally {
      isRefreshingRef.current = false;
    }
  }, [
    state.primaryWallet,
    state.baseAccountAddress,
    state.tradingWallet,
    state.tradingWalletAddress,
    user?.baseAccountAddress,
    user?.fid,
    metaMaskAccount,
    isMetaMaskConnected,
    token,
    fetchBalanceData,
    nativeSymbol,
    clientWalletService
  ]);

  const refreshWallets = useCallback(async () => {
    if (!user?.fid || !token) {
      console.log('[IntegratedWallet] Skipping wallet refresh - no user or token');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch wallets from API
      const wallets = await clientWalletService.getAllUserWallets();

      const baseWalletFromApi = wallets.find(w => w.walletType === 'base-account');
      const tradingWallet = wallets.find(w => w.walletType === 'trading') || null;

      const baseWallet = baseWalletFromApi || (user.baseAccountAddress
        ? {
            id: `fid_${user.fid}_base-account`,
            address: user.baseAccountAddress,
            chain: 'base',
            createdAt: new Date(),
            walletType: 'base-account'
          } as ClientUserWallet
        : null);

      const combinedWallets =
        baseWallet && !baseWalletFromApi
          ? [...wallets, baseWallet]
          : wallets;

      const primaryWallet = baseWallet || tradingWallet || wallets[0] || null;

      // Refresh balances if we have a primary wallet
      // Pass the wallet directly to avoid state timing issues
      const walletForBalances = baseWallet || primaryWallet;

      if (walletForBalances) {
        // Update wallet state but keep isLoading true - refreshBalances will handle it
        setState(prev => ({
          ...prev,
          isConnected: !!primaryWallet,
          baseAccountAddress: baseWallet?.address || user.baseAccountAddress || null,
          tradingWalletAddress: tradingWallet?.address || null,
          primaryWallet,
          tradingWallet,
          allWallets: combinedWallets,
          isLoading: true // Keep loading true until balances are fetched
        }));
        
        await refreshBalances(walletForBalances, tradingWallet);
      } else {
        // No wallet found, set loading to false
        setState(prev => ({
          ...prev,
          isConnected: !!primaryWallet,
          baseAccountAddress: baseWallet?.address || user.baseAccountAddress || null,
          tradingWalletAddress: tradingWallet?.address || null,
          primaryWallet,
          tradingWallet,
          allWallets: combinedWallets,
          isLoading: false
        }));
        console.log('[IntegratedWallet] No primary wallet found, balances will not be refreshed');
      }
    } catch (error) {
      console.error('Error refreshing wallets:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load wallets'
      }));
    }
  }, [user?.fid, token, refreshBalances]);

  // Load user wallets on mount
  useEffect(() => {
    if (user?.fid && token) {
      refreshWallets();
    }
  }, [user?.fid, token, refreshWallets]);

  const createWallet = useCallback(async (chain: string, mnemonic?: string): Promise<ClientUserWallet | null> => {
    if (!user?.fid || !token) return null;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await clientWalletService.createWallet({ chain, mnemonic });
      
      if (result.success && result.wallet) {
        // Refresh wallets list
        await refreshWallets();
        return {
          ...result.wallet,
          walletType: (chain || 'ethereum').toLowerCase() === 'ethereum' ? 'trading' : result.wallet.walletType
        } as ClientUserWallet;
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
      // Pass wallet directly to avoid state timing issues
      await refreshBalances(wallet);
    }
  }, [state.allWallets, refreshBalances]);

  // Refresh balances when MetaMask connection changes
  useEffect(() => {
    let mounted = true;
    
    if (state.primaryWallet && (isMetaMaskConnected || metaMaskAccount)) {
      console.log('[IntegratedWallet] MetaMask connection changed, refreshing balances...');
      refreshBalances().catch(err => {
        if (mounted) {
          console.error('[IntegratedWallet] Error refreshing balances:', err);
        }
      });
    }
    
    return () => {
      mounted = false;
    };
  }, [isMetaMaskConnected, metaMaskAccount, state.primaryWallet, refreshBalances]);

  const getWalletForChain = useCallback((chain: string): ClientUserWallet | null => {
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

