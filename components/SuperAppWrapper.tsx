"use client";

import React, { useEffect, useState } from 'react';
import { SuperAppProvider } from '@/lib/superapp/context';
import { useSuperAppEnvironment } from '@/lib/superapp/context';
import { useIntegratedWallet } from '@/lib/wallet/IntegratedWalletContext';
import { createSuperAppHyperliquidClient } from '@/lib/superapp/hyperliquid';

interface SuperAppWrapperProps {
  children: React.ReactNode;
  deploymentToken?: string;
}

/**
 * SuperApp Wrapper Component
 * 
 * This component wraps the entire Perp-x app and provides:
 * 1. SuperApp SDK initialization
 * 2. Automatic wallet connection using SuperApp's wallet
 * 3. Hyperliquid client setup with SuperApp wallet
 * 4. Environment detection (SuperApp vs standalone)
 */
function SuperAppContent({ children }: { children: React.ReactNode }) {
  // Try to get SuperApp environment, but don't fail if not available
  let isSuperApp = false;
  let hasUser = false;
  let ethereumAddress: string | null = null;
  let ethereumPrivateKey: string | null = null;
  let isLoading = false;
  let error: string | null = null;

  try {
    const superAppEnv = useSuperAppEnvironment();
    isSuperApp = superAppEnv.isSuperApp;
    hasUser = superAppEnv.hasUser;
    ethereumAddress = superAppEnv.ethereumAddress;
    ethereumPrivateKey = superAppEnv.ethereumPrivateKey;
    isLoading = superAppEnv.isLoading;
    error = superAppEnv.error;
  } catch (err) {
    // SuperApp not available, continue in standalone mode
    console.log('SuperApp not available, running in standalone mode');
  }

  const { createWallet, isConnected } = useIntegratedWallet();
  const [hyperliquidClient, setHyperliquidClient] = useState<any>(null);

  // Auto-connect wallet when SuperApp user is available
  useEffect(() => {
    if (isSuperApp && hasUser && ethereumAddress && !isConnected) {
      console.log('Auto-connecting SuperApp wallet...');
      createWallet('ethereum');
    }
  }, [isSuperApp, hasUser, ethereumAddress, isConnected, createWallet]);

  // Initialize Hyperliquid client when SuperApp user is available
  useEffect(() => {
    if (isSuperApp && hasUser && ethereumAddress && ethereumPrivateKey) {
      try {
        const client = createSuperAppHyperliquidClient({
          user: {
            id: 'superapp-user',
            email: `${ethereumAddress}@wapal.io`,
            phoneNumber: '+9779804089413', // This would come from SuperApp
            wallet_addresses: {
              ethereum: ethereumAddress,
            },
            privateKeys: {
              ethereum: ethereumPrivateKey,
            },
          },
          isTestnet: true, // Use testnet for safety
        });

        setHyperliquidClient(client);
        console.log('SuperApp Hyperliquid client initialized');
      } catch (error) {
        console.error('Failed to initialize SuperApp Hyperliquid client:', error);
      }
    }
  }, [isSuperApp, hasUser, ethereumAddress, ethereumPrivateKey]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Initializing SuperApp integration...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">SuperApp Integration Error</h2>
          <p className="text-[#9ca3af] mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show SuperApp mode indicator
  if (isSuperApp && hasUser) {
    return (
      <div className="min-h-screen bg-[#0d0d0d]">
        {/* SuperApp Mode Banner */}
        <div className="bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white py-2 px-4 text-center text-sm">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Connected to SuperApp • Wallet: {ethereumAddress?.slice(0, 6)}...{ethereumAddress?.slice(-4)}</span>
          </div>
        </div>
        
        {/* Main App Content */}
        <div className="relative">
          {children}
        </div>
      </div>
    );
  }

  // Show standalone mode (original app)
  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {children}
    </div>
  );
}

export function SuperAppWrapper({ children, deploymentToken }: SuperAppWrapperProps) {
  return (
    <SuperAppProvider deploymentToken={deploymentToken}>
      <SuperAppContent>
        {children}
      </SuperAppContent>
    </SuperAppProvider>
  );
}

/**
 * Hook to access SuperApp Hyperliquid client
 */
export function useSuperAppHyperliquid() {
  const [client, setClient] = useState<any>(null);
  
  // Try to get SuperApp environment, but don't fail if not available
  let isSuperApp = false;
  let hasUser = false;
  let ethereumAddress: string | null = null;
  let ethereumPrivateKey: string | null = null;

  try {
    const superAppEnv = useSuperAppEnvironment();
    isSuperApp = superAppEnv.isSuperApp;
    hasUser = superAppEnv.hasUser;
    ethereumAddress = superAppEnv.ethereumAddress;
    ethereumPrivateKey = superAppEnv.ethereumPrivateKey;
  } catch (err) {
    // SuperApp not available, continue in standalone mode
    console.log('SuperApp not available in useSuperAppHyperliquid, running in standalone mode');
  }

  useEffect(() => {
    if (isSuperApp && hasUser && ethereumAddress && ethereumPrivateKey) {
      try {
        const hyperliquidClient = createSuperAppHyperliquidClient({
          user: {
            id: 'superapp-user',
            email: `${ethereumAddress}@wapal.io`,
            phoneNumber: '+9779804089413',
            wallet_addresses: {
              ethereum: ethereumAddress,
            },
            privateKeys: {
              ethereum: ethereumPrivateKey,
            },
          },
          isTestnet: true,
        });

        setClient(hyperliquidClient);
      } catch (error) {
        console.error('Failed to create SuperApp Hyperliquid client:', error);
      }
    }
  }, [isSuperApp, hasUser, ethereumAddress, ethereumPrivateKey]);

  return client;
}
