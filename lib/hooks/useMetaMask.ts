"use client";

import { useState, useEffect, useCallback } from 'react';

export interface MetaMaskState {
  isInstalled: boolean;
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  error: string | null;
}

export function useMetaMask() {
  const [state, setState] = useState<MetaMaskState>({
    isInstalled: false,
    isConnected: false,
    account: null,
    chainId: null,
    error: null
  });

  const checkConnection = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum?.isMetaMask) {
      setState(prev => ({ ...prev, isInstalled: false, isConnected: false, account: null }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isInstalled: true, error: null }));

      const ethereum = window.ethereum;
      if (!ethereum || !ethereum.request) {
        setState(prev => ({ ...prev, isInstalled: false }));
        return;
      }

      // Check if already connected
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      const chainId = await ethereum.request({ method: 'eth_chainId' });

      if (accounts && accounts.length > 0) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          account: accounts[0],
          chainId: parseInt(chainId, 16)
        }));
      } else {
        setState(prev => ({
          ...prev,
          isConnected: false,
          account: null,
          chainId: parseInt(chainId, 16)
        }));
      }
    } catch (error) {
      console.error('Error checking MetaMask connection:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check MetaMask connection'
      }));
    }
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum?.isMetaMask) {
      setState(prev => ({ ...prev, error: 'MetaMask is not installed' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, error: null }));
      
      const ethereum = window.ethereum;
      if (!ethereum || !ethereum.request) {
        setState(prev => ({ ...prev, error: 'MetaMask is not installed' }));
        return;
      }

      const accounts = await ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const chainId = await ethereum.request({ method: 'eth_chainId' });

      if (accounts && accounts.length > 0) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          account: accounts[0],
          chainId: parseInt(chainId, 16)
        }));
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect to MetaMask'
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      account: null
    }));
  }, []);

  // Check connection on mount and when window.ethereum changes
  useEffect(() => {
    checkConnection();

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          account: accounts[0]
        }));
      } else {
        setState(prev => ({
          ...prev,
          isConnected: false,
          account: null
        }));
      }
    };

    // Listen for chain changes
    const handleChainChanged = (chainId: string) => {
      setState(prev => ({
        ...prev,
        chainId: parseInt(chainId, 16)
      }));
    };

    const ethereum = window.ethereum as any;
    if (ethereum && ethereum.on) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener('accountsChanged', handleAccountsChanged);
          ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [checkConnection]);

  return {
    ...state,
    connect,
    disconnect,
    checkConnection
  };
}
