"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { walletBalanceUpdater, TradingResult } from './balanceUpdater';
import { getHyperliquidBalanceUSD } from './hyperliquidBalance';
import { useTrading } from '../hooks/useTrading';

// Types
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price?: number; // Mock price for MVP
}

export interface TokenBalance {
  token: Token;
  balance: string;
  balanceFormatted: string;
  valueUSD: number;
}

export interface WalletState {
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  ethBalance: string;
  ethBalanceFormatted: string;
  holdings: TokenBalance[];
  totalPortfolioValue: number;
  dailyChange: number;
  dailyChangePercentage: number;
  lastDayValue: number;
  hyperliquidBalance: number;
  isLoading: boolean;
  error: string | null;
}

export interface WalletContextType extends WalletState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  setHyperliquidWalletAddress: (address: string) => void;
}

// Supported tokens
export const SUPPORTED_TOKENS: Token[] = [
  // Temporarily disabled USDC due to invalid address causing checksum errors
  // {
  //   address: '0xA0b86a33E6441b8bD7b8CF95A80a23CdA8AF3d7F', // USDC - INVALID ADDRESS
  //   symbol: 'USDC',
  //   name: 'USD Coin',
  //   decimals: 6,
  //   price: 1.0
  // },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    price: 45000 // Mock price
  },
  {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    symbol: 'DAI',
    name: 'Dai',
    decimals: 18,
    price: 1.0
  }
];

// ERC-20 ABI for balance reading
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

// Context
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Provider component
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    account: null,
    chainId: null,
    provider: null,
    signer: null,
    ethBalance: '0',
    ethBalanceFormatted: '0.00',
    holdings: [],
    totalPortfolioValue: 0,
    dailyChange: 0,
    dailyChangePercentage: 0,
    lastDayValue: 0,
    hyperliquidBalance: 0,
    isLoading: false,
    error: null
  });

  const [hyperliquidWalletAddress, setHyperliquidWalletAddress] = useState<string>('');
  const isLoadingRef = useRef(false);

  // Note: Balance refresh is triggered manually from the UI when Hyperliquid address changes

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  }, []);

  // Get ETH balance
  const getEthBalance = useCallback(async (provider: ethers.BrowserProvider, address: string) => {
    try {
      const balance = await provider.getBalance(address);
      const balanceFormatted = ethers.formatEther(balance);
      return { balance: balance.toString(), balanceFormatted };
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      return { balance: '0', balanceFormatted: '0.00' };
    }
  }, []);

  // Get token balance
  const getTokenBalance = useCallback(async (provider: ethers.BrowserProvider, token: Token, address: string): Promise<TokenBalance> => {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balance = await contract.balanceOf(address);
      const balanceFormatted = ethers.formatUnits(balance, token.decimals);
      const valueUSD = parseFloat(balanceFormatted) * (token.price || 0);

      return {
        token,
        balance: balance.toString(),
        balanceFormatted,
        valueUSD
      };
    } catch (error) {
      console.error(`Error fetching ${token.symbol} balance:`, error);
      return {
        token,
        balance: '0',
        balanceFormatted: '0.00',
        valueUSD: 0
      };
    }
  }, []);

  // Fetch all balances
  const fetchBalances = useCallback(async (provider: ethers.BrowserProvider, address: string) => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('[WalletContext] Already loading balances, skipping...');
      return;
    }

    try {
      isLoadingRef.current = true;
      console.log('[WalletContext] Fetching balances for:', address);
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get ETH balance
      const { balance: ethBalance, balanceFormatted: ethBalanceFormatted } = await getEthBalance(provider, address);
      console.log('[WalletContext] ETH balance:', ethBalanceFormatted);

      // Get token balances
      const tokenBalances = await Promise.all(
        SUPPORTED_TOKENS.map(token => getTokenBalance(provider, token, address))
      );
      console.log('[WalletContext] Token balances fetched:', tokenBalances.length);

      // Get Hyperliquid balance (use Hyperliquid wallet address if provided, otherwise use MetaMask address)
      const hyperliquidAddress = hyperliquidWalletAddress || address;
      const hyperliquidBalance = await getHyperliquidBalanceUSD(hyperliquidAddress);
      console.log('[WalletContext] Hyperliquid balance for address', hyperliquidAddress, ':', hyperliquidBalance);

      // Calculate total portfolio value (including Hyperliquid balance)
      const ethValueUSD = parseFloat(ethBalanceFormatted) * 2000; // Mock ETH price
      const totalTokenValue = tokenBalances.reduce((sum, tokenBalance) => sum + tokenBalance.valueUSD, 0);
      const totalPortfolioValue = ethValueUSD + totalTokenValue + hyperliquidBalance;

      // Update daily change when total portfolio value changes
      const lastDayValue = localStorage.getItem('lastDayPortfolioValue');
      const lastDayDate = localStorage.getItem('lastDayDate');
      const today = new Date().toDateString();

      let dailyChange = 0;
      let dailyChangePercentage = 0;
      let lastDayPortfolioValue = totalPortfolioValue;

      if (!lastDayValue || !lastDayDate || lastDayDate !== today) {
        // First connection of the day, set initial values
        localStorage.setItem('lastDayPortfolioValue', totalPortfolioValue.toString());
        localStorage.setItem('lastDayDate', today);
      } else {
        // Calculate changes only if we have a previous value
        lastDayPortfolioValue = parseFloat(lastDayValue);
        dailyChange = totalPortfolioValue - lastDayPortfolioValue;
        dailyChangePercentage = lastDayPortfolioValue !== 0 ? (dailyChange / lastDayPortfolioValue) * 100 : 0;
      }

      console.log('[WalletContext] Total portfolio value:', totalPortfolioValue);
      console.log('[WalletContext] Daily change:', dailyChange);
      console.log('[WalletContext] Daily change percentage:', dailyChangePercentage);

      setState(prev => ({
        ...prev,
        ethBalance,
        ethBalanceFormatted,
        holdings: tokenBalances,
        totalPortfolioValue,
        dailyChange,
        dailyChangePercentage,
        lastDayValue: lastDayPortfolioValue,
        hyperliquidBalance,
        isLoading: false
      }));
    } catch (error) {
      console.error('[WalletContext] Error fetching balances:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    } finally {
      isLoadingRef.current = false;
    }
  }, [getEthBalance, getTokenBalance, hyperliquidWalletAddress]);

  // Refresh balances
  const refreshBalances = useCallback(async () => {
    if (state.provider && state.account) {
      await fetchBalances(state.provider, state.account);
    }
  }, [state.provider, state.account, fetchBalances]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setState({
      isConnected: false,
      account: null,
      chainId: null,
      provider: null,
      signer: null,
      ethBalance: '0',
      ethBalanceFormatted: '0.00',
      holdings: [],
      totalPortfolioValue: 0,
      dailyChange: 0,
      dailyChangePercentage: 0,
      lastDayValue: 0,
      hyperliquidBalance: 0,
      isLoading: false,
      error: null
    });

    // Remove event listeners
    if (window.ethereum) {
      window.ethereum.removeAllListeners();
    }
  }, []);

  // Event handlers
  const handleAccountsChanged = useCallback((accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else if (state.provider) {
      setState(prev => ({ ...prev, account: accounts[0] }));
      fetchBalances(state.provider, accounts[0]);
    }
  }, [state.provider, disconnectWallet, fetchBalances]);

  const handleChainChanged = useCallback((chainId: string) => {
    setState(prev => ({ ...prev, chainId: parseInt(chainId, 16) }));
    if (state.provider && state.account) {
      fetchBalances(state.provider, state.account);
    }
  }, [state.provider, state.account, fetchBalances]);

  const handleDisconnect = useCallback(() => {
    disconnectWallet();
  }, [disconnectWallet]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled() || !window.ethereum) {
      setState(prev => ({ ...prev, error: 'MetaMask is not installed' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const address = accounts[0];

      setState(prev => ({
        ...prev,
        isConnected: true,
        account: address,
        chainId: Number(network.chainId),
        provider,
        signer,
        isLoading: false
      }));

      // Fetch balances
      await fetchBalances(provider, address);

      // Set up event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);

    } catch (error: unknown) {
      console.error('Error connecting wallet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, [isMetaMaskInstalled, fetchBalances, handleAccountsChanged, handleChainChanged, handleDisconnect]);

  // Switch network
  const switchNetwork = useCallback(async (chainId: number) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: unknown) {
      console.error('Error switching network:', error);
      setState(prev => ({ ...prev, error: 'Failed to switch network' }));
    }
  }, []);

  // Auto-connect on page load (only run once)
  useEffect(() => {
    let isMounted = true;
    let hasAttemptedAutoConnect = false;

    const autoConnect = async () => {
      if (!isMounted || hasAttemptedAutoConnect) return;
      hasAttemptedAutoConnect = true;

      console.log('[WalletContext] Starting auto-connect process...');

      if (!isMetaMaskInstalled() || !window.ethereum) {
        console.log('[WalletContext] MetaMask not installed, skipping auto-connect');
        if (isMounted) {
          setState(prev => ({
            ...prev,
            error: 'MetaMask not installed. Please install MetaMask to connect your wallet.'
          }));
        }
        return;
      }

      try {
        console.log('[WalletContext] Attempting auto-connect...');
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);

        if (!isMounted) return;

        console.log('[WalletContext] Found accounts:', accounts.length);

        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          const network = await provider.getNetwork();
          const address = accounts[0];

          console.log('[WalletContext] Auto-connecting to:', address);
          console.log('[WalletContext] Network:', network.name, 'Chain ID:', network.chainId);

          if (isMounted) {
            setState(prev => ({
              ...prev,
              isConnected: true,
              account: address,
              chainId: Number(network.chainId),
              provider,
              signer,
              error: null
            }));

            await fetchBalances(provider, address);

            // Set up event listeners
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
            window.ethereum.on('disconnect', handleDisconnect);

            console.log('[WalletContext] Auto-connect successful');
          }
        } else {
          console.log('[WalletContext] No accounts found, skipping auto-connect');
          if (isMounted) {
            setState(prev => ({
              ...prev,
              error: 'No accounts found. Please connect your wallet manually.'
            }));
          }
        }
      } catch (error) {
        console.error('[WalletContext] Auto-connect failed:', error);
        if (isMounted) {
          setState(prev => ({
            ...prev,
            error: `Auto-connect failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }));
        }
      }
    };

    // Add a small delay to ensure the component is fully mounted
    const timer = setTimeout(autoConnect, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []); // Empty dependency array - only run once on mount

  // Listen for trading results and update balance
  useEffect(() => {
    const unsubscribe = walletBalanceUpdater.onTradingResult((result: TradingResult) => {
      console.log('[WalletContext] Trading result received:', result);

      // Update the portfolio value based on trading results
      setState(prev => ({
        ...prev,
        totalPortfolioValue: prev.totalPortfolioValue + result.pnl
      }));

      // Refresh balances to get updated values
      if (state.provider && state.account) {
        fetchBalances(state.provider, state.account);
      }
    });

    return unsubscribe;
  }, [state.provider, state.account, fetchBalances]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners();
      }
    };
  }, []);

  const contextValue: WalletContextType = {
    ...state,
    connectWallet,
    disconnectWallet,
    refreshBalances,
    switchNetwork,
    setHyperliquidWalletAddress
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

// Hook to use wallet context
export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}