"use client";

import React from 'react';
import { useWallet } from '@/lib/wallet/WalletContext';
import { useSuperAppEnvironment } from '@/lib/superapp/context';

interface WalletConnectionProps {
  className?: string;
}

export function WalletConnection({ className = "" }: WalletConnectionProps) {
  const {
    isConnected,
    account,
    chainId,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    isSuperAppMode
  } = useWallet();

  // SuperApp integration (optional)
  let isSuperApp = false;
  let hasUser = false;

  try {
    const superAppEnv = useSuperAppEnvironment();
    isSuperApp = superAppEnv.isSuperApp;
    hasUser = superAppEnv.hasUser;
  } catch (error) {
    // SuperApp not available, continue in standalone mode
    console.log('SuperApp not available in WalletConnection, running in standalone mode');
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 1:
        return 'Ethereum';
      case 11155111:
        return 'Sepolia';
      case 5:
        return 'Goerli';
      default:
        return `Chain ${chainId}`;
    }
  };

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleSwitchToMainnet = () => {
    switchNetwork(1);
  };

  if (isConnected && account) {
    return (
      <div className={`bg-[#1f2937] rounded-xl p-4 border border-[#374151] ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-white font-medium">
              {isSuperAppMode ? 'SuperApp Connected' : 'Connected'}
            </span>
          </div>
          {!isSuperAppMode && (
            <button
              onClick={handleDisconnect}
              className="text-[#9ca3af] hover:text-white transition-colors text-sm"
            >
              Disconnect
            </button>
          )}
        </div>
        
        <div className="space-y-2">
          <div>
            <p className="text-[#9ca3af] text-sm">Address</p>
            <p className="text-white font-mono text-sm">{formatAddress(account)}</p>
          </div>
          
          <div>
            <p className="text-[#9ca3af] text-sm">Network</p>
            <div className="flex items-center space-x-2">
              <p className="text-white text-sm">{getNetworkName(chainId)}</p>
              {chainId !== 1 && !isSuperAppMode && (
                <button
                  onClick={handleSwitchToMainnet}
                  className="text-[#7c3aed] hover:text-[#8b5cf6] text-xs underline"
                >
                  Switch to Mainnet
                </button>
              )}
            </div>
          </div>

          {isSuperAppMode && (
            <div>
              <p className="text-[#9ca3af] text-sm">Mode</p>
              <p className="text-[#7c3aed] text-sm font-medium">SuperApp Mini-App</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If we're in SuperApp mode but not connected, show SuperApp-specific message
  if (isSuperApp && !isConnected) {
    return (
      <div className={`bg-[#1f2937] rounded-xl p-6 border border-[#374151] text-center ${className}`}>
        <div className="mb-4">
          <div className="w-12 h-12 bg-[#7c3aed] rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">SuperApp Integration</h3>
          <p className="text-[#9ca3af] text-sm mb-4">
            Your wallet will be automatically connected through the SuperApp
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="w-full bg-[#7c3aed] hover:bg-[#8b5cf6] disabled:bg-[#4b5563] disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Connect SuperApp Wallet</span>
            </>
          )}
        </button>

        <p className="text-[#6b7280] text-xs mt-3">
          Using your existing SuperApp wallet for trading
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-[#1f2937] rounded-xl p-6 border border-[#374151] text-center ${className}`}>
      <div className="mb-4">
        <div className="w-12 h-12 bg-[#7c3aed] rounded-full flex items-center justify-center mx-auto mb-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white"
          >
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Connect Your Wallet</h3>
        <p className="text-[#9ca3af] text-sm mb-4">
          Connect your MetaMask wallet to view your real portfolio and start trading
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={isLoading}
        className="w-full bg-[#7c3aed] hover:bg-[#8b5cf6] disabled:bg-[#4b5563] disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Connect MetaMask</span>
          </>
        )}
      </button>

      <p className="text-[#6b7280] text-xs mt-3">
        By connecting, you agree to our Terms of Service
      </p>
    </div>
  );
}
