"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { walletBalanceUpdater, TradingResult } from './balanceUpdater';
import { getAvantisBalanceUSD } from './avantisBalance';
import { useTrading } from '../hooks/useTrading';

// Types
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price?: number; // Price fetched from CoinGecko API
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
  avantisBalance: number;
  isLoading: boolean;
  error: string | null;
}

export interface WalletContextType extends WalletState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  setAvantisWalletAddress: (address: string) => void;
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
    price: 0 // Price fetched from CoinGecko API
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
    avantisBalance: 0,
    isLoading: false,
    error: null
  });

  const [avantisWalletAddress, setAvantisWalletAddress] = useState<string>('');
  const isLoadingRef = useRef(false);


  // Note: Balance refresh is triggered manually from the UI when Avantis address changes

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
      return;
    }

    try {
      isLoadingRef.current = true;
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get ETH balance
      const { balance: ethBalance, balanceFormatted: ethBalanceFormatted } = await getEthBalance(provider, address);

      // Get token balances
      const tokenBalances = await Promise.all(
        SUPPORTED_TOKENS.map(token => getTokenBalance(provider, token, address))
      );

      // Get Avantis balance (use Avantis wallet private key if available, otherwise use MetaMask address)
      // Note: Avantis requires private key, not just address
      let avantisBalance = 0;
      try {
        const avantisAddress = avantisWalletAddress || address;
        // Avantis balance fetching is handled by IntegratedWalletContext
        // This context is kept for backward compatibility
      } catch (error) {
        console.warn('[WalletContext] Could not fetch Avantis balance:', error);
      }

      // Calculate total portfolio value (including Avantis balance)
      // Fetch real ETH price from CoinGecko
      let ethPrice = 2500; // Fallback price
      try {
        const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const priceData = await priceResponse.json();
        ethPrice = priceData.ethereum?.usd || 2500;
      } catch (error) {
        console.warn('[WalletContext] Failed to fetch ETH price, using fallback:', error);
      }
      const ethValueUSD = parseFloat(ethBalanceFormatted) * ethPrice;
      const totalTokenValue = tokenBalances.reduce((sum, tokenBalance) => sum + tokenBalance.valueUSD, 0);
      const totalPortfolioValue = ethValueUSD + totalTokenValue + avantisBalance;

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

      setState(prev => ({
        ...prev,
        ethBalance,
        ethBalanceFormatted,
        holdings: tokenBalances,
        totalPortfolioValue,
        dailyChange,
        dailyChangePercentage,
        lastDayValue: lastDayPortfolioValue,
        avantisBalance,
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
  }, [getEthBalance, getTokenBalance, avantisWalletAddress]);

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
      avantisBalance: 0,
      isLoading: false,
      error: null
    });

    // Remove event listeners
    const ethereum = window.ethereum as any;
    if (ethereum && ethereum.removeAllListeners) {
      ethereum.removeAllListeners();
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
    // Use MetaMask for wallet connection
    if (!isMetaMaskInstalled() || !window.ethereum) {
      setState(prev => ({ ...prev, error: 'MetaMask is not installed' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const provider = new ethers.BrowserProvider(window.ethereum as any);
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
      const ethereum = window.ethereum as any;
      if (ethereum && ethereum.on) {
        ethereum.on('accountsChanged', handleAccountsChanged);
        ethereum.on('chainChanged', handleChainChanged);
        ethereum.on('disconnect', handleDisconnect);
      }

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
    const ethereum = window.ethereum as any;
    if (!ethereum || !ethereum.request) return;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: unknown) {
      console.error('Error switching network:', error);
      setState(prev => ({ ...prev, error: 'Failed to switch network' }));
    }
  }, []);

  // Lazy auto-connect - only when user interacts with wallet
  useEffect(() => {
    let isMounted = true;

    const checkMetaMask = () => {
      if (!isMounted) return;

      if (!isMetaMaskInstalled() || !window.ethereum) {
        console.log('[WalletContext] MetaMask not installed');
        if (isMounted) {
          setState(prev => ({
            ...prev,
            error: null // Don't show error until user tries to connect
          }));
        }
        return;
      }

      // Only set up basic error handling, don't auto-connect
      setState(prev => ({
        ...prev,
        error: null
      }));
    };

    // Minimal initialization - no auto-connect
    const timer = setTimeout(checkMetaMask, 50);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []); // Empty dependency array - only run once on mount

  // Listen for trading results and update balance
  useEffect(() => {
    const unsubscribe = walletBalanceUpdater.onTradingResult((result: TradingResult) => {

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
      const ethereum = window.ethereum as any;
      if (ethereum && ethereum.removeAllListeners) {
        ethereum.removeAllListeners();
      }
    };
  }, []);

  const contextValue: WalletContextType = {
    ...state,
    connectWallet,
    disconnectWallet,
    refreshBalances,
    switchNetwork,
    setAvantisWalletAddress
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