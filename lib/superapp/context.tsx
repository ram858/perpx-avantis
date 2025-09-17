"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SuperAppSDK, SuperAppUser, SuperAppWalletBalances, SuperAppConfig, SuperAppContextType } from './types';
import superAppSDK from './sdk';

const SuperAppContext = createContext<SuperAppContextType | undefined>(undefined);

interface SuperAppProviderProps {
  children: React.ReactNode;
  deploymentToken?: string;
}

export function SuperAppProvider({ children, deploymentToken }: SuperAppProviderProps) {
  const [isSuperApp, setIsSuperApp] = useState(false);
  const [user, setUser] = useState<SuperAppUser | null>(null);
  const [balances, setBalances] = useState<SuperAppWalletBalances | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect if we're running in SuperApp environment
  const detectSuperAppEnvironment = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const superappToken = urlParams.get('superapp_token');
    const appId = urlParams.get('app_id');
    const sessionId = urlParams.get('session_id');

    return {
      isSuperApp: !!(superappToken && appId),
      launchParams: {
        superapp_token: superappToken,
        app_id: appId,
        session_id: sessionId,
        platform: 'web' as const,
      },
    };
  }, []);

  // Initialize SuperApp SDK
  const initializeSuperApp = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const environment = detectSuperAppEnvironment();
      
      if (!environment.isSuperApp) {
        console.log('Not running in SuperApp environment');
        setIsSuperApp(false);
        return;
      }

      console.log('Initializing SuperApp SDK...', environment.launchParams);

      // Initialize SDK with deployment token
      const config: SuperAppConfig = {
        deploymentToken: deploymentToken || 'default-deployment-token',
        ...environment.launchParams,
      };

      await superAppSDK.init(config);
      setIsSuperApp(true);

      // Get user data
      const userData = await superAppSDK.getUser();
      setUser(userData);
      console.log('SuperApp user loaded:', userData);

      // Get wallet balances
      const walletBalances = await superAppSDK.getWalletBalances();
      setBalances(walletBalances);
      console.log('SuperApp balances loaded:', walletBalances);

    } catch (err) {
      console.error('Failed to initialize SuperApp:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize SuperApp');
      setIsSuperApp(false);
    } finally {
      setIsLoading(false);
    }
  }, [deploymentToken, detectSuperAppEnvironment]);

  // Refresh balances
  const refreshBalances = useCallback(async () => {
    if (!isSuperApp) return;

    try {
      const walletBalances = await superAppSDK.getWalletBalances();
      setBalances(walletBalances);
    } catch (err) {
      console.error('Failed to refresh balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh balances');
    }
  }, [isSuperApp]);

  // Auto-initialize on mount if in SuperApp environment
  useEffect(() => {
    const environment = detectSuperAppEnvironment();
    if (environment.isSuperApp) {
      initializeSuperApp();
    }
  }, [initializeSuperApp, detectSuperAppEnvironment]);

  const contextValue: SuperAppContextType = {
    isSuperApp,
    user,
    balances,
    isLoading,
    error,
    initializeSuperApp,
    refreshBalances,
  };

  return (
    <SuperAppContext.Provider value={contextValue}>
      {children}
    </SuperAppContext.Provider>
  );
}

// Hook to use SuperApp context
export function useSuperApp(): SuperAppContextType {
  const context = useContext(SuperAppContext);
  if (context === undefined) {
    throw new Error('useSuperApp must be used within a SuperAppProvider');
  }
  return context;
}

// Hook to check if we're in SuperApp environment
export function useSuperAppEnvironment() {
  const { isSuperApp, user, isLoading, error } = useSuperApp();
  
  return {
    isSuperApp,
    hasUser: !!user,
    isLoading,
    error,
    ethereumAddress: user?.wallet_addresses.ethereum,
    ethereumPrivateKey: user?.privateKeys?.ethereum,
  };
}
