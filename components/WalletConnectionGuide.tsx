"use client";

import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIntegratedWallet } from '@/lib/wallet/IntegratedWalletContext';

export function WalletConnectionGuide() {
  const { primaryWallet } = useIntegratedWallet();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [connectionStep, setConnectionStep] = useState(0);
  
  // Determine if we're using testnet (default to true for safety)
  const isTestnet = process.env.NEXT_PUBLIC_HYPERLIQUID_TESTNET !== 'false';
  const hyperliquidUrl = isTestnet ? 'https://app.hyperliquid-testnet.xyz' : 'https://app.hyperliquid.xyz';

  useEffect(() => {
    // Check if MetaMask is installed
    const checkMetaMask = () => {
      if (typeof window !== 'undefined' && window.ethereum?.isMetaMask) {
        setHasMetaMask(true);
      } else {
        setHasMetaMask(false);
      }
    };
    
    checkMetaMask();
    // Check again after a delay in case MetaMask loads later
    const timer = setTimeout(checkMetaMask, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!primaryWallet) {
    return null;
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card className="p-6 bg-[#1a1a1a] border-[#333]">
      <h3 className="text-xl font-semibold text-white mb-4">
        🔗 Connect Your Wallet to Hyperliquid
      </h3>
      
      <div className="space-y-4">
        <div className="bg-yellow-900/20 border border-yellow-500 p-4 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ <strong>Important:</strong> Hyperliquid only accepts wallet extensions (MetaMask, etc.), not direct private key imports.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Wallet Address:
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={primaryWallet.address}
                readOnly
                className="flex-1 bg-[#2a2a2a] border border-[#444] text-white p-2 rounded text-sm font-mono"
              />
              <Button
                onClick={() => copyToClipboard(primaryWallet.address)}
                size="sm"
                className="bg-[#8759ff] hover:bg-[#7c4dff] text-white"
              >
                Copy
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Private Key (for MetaMask import):
            </label>
            <div className="flex items-center space-x-2">
              <input
                type={showPrivateKey ? "text" : "password"}
                value={primaryWallet.privateKey || 'Not available'}
                readOnly
                className="flex-1 bg-[#2a2a2a] border border-[#444] text-white p-2 rounded text-sm font-mono"
              />
              <Button
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                size="sm"
                variant="outline"
                className="border-[#444] text-gray-300 hover:bg-[#2a2a2a]"
              >
                {showPrivateKey ? 'Hide' : 'Show'}
              </Button>
              {primaryWallet.privateKey && (
                <Button
                  onClick={() => {
                    copyToClipboard(primaryWallet.privateKey!);
                    // Show notification that MetaMask should be opened
                    alert('✅ Private key copied! Now open MetaMask and follow the steps below.');
                  }}
                  size="sm"
                  className="bg-[#8759ff] hover:bg-[#7c4dff] text-white"
                >
                  Copy & Guide
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* MetaMask Status */}
        <div className={`p-4 rounded-lg border ${
          hasMetaMask 
            ? 'bg-green-900/20 border-green-500' 
            : 'bg-red-900/20 border-red-500'
        }`}>
          <h4 className={`font-semibold mb-2 ${
            hasMetaMask ? 'text-green-400' : 'text-red-400'
          }`}>
            {hasMetaMask ? '✅ MetaMask Detected' : '❌ MetaMask Not Found'}
          </h4>
          <p className={`text-sm ${
            hasMetaMask ? 'text-green-300' : 'text-red-300'
          }`}>
            {hasMetaMask 
              ? 'Great! MetaMask is installed. Follow the steps below to import your wallet.'
              : 'Please install MetaMask browser extension first to proceed with wallet import.'
            }
          </p>
        </div>

        <div className="bg-blue-900/20 border border-blue-500 p-4 rounded-lg">
          <h4 className="text-blue-400 font-semibold mb-2">📋 Smart Connection Guide:</h4>
          
          {/* Step 1: Copy Private Key */}
          <div className={`p-3 rounded mb-2 ${connectionStep >= 1 ? 'bg-blue-800/30' : 'bg-gray-800/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-blue-300 text-sm font-medium">Step 1: Copy Private Key</span>
              <Button
                onClick={() => {
                  copyToClipboard(primaryWallet.privateKey!);
                  setConnectionStep(1);
                  alert('✅ Private key copied! MetaMask should open automatically...');
                }}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!hasMetaMask}
              >
                {connectionStep >= 1 ? '✅ Copied' : '📋 Copy Key'}
              </Button>
            </div>
          </div>

          {/* Step 2: Import to MetaMask */}
          <div className={`p-3 rounded mb-2 ${connectionStep >= 2 ? 'bg-blue-800/30' : 'bg-gray-800/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-blue-300 text-sm font-medium">Step 2: Import to MetaMask</span>
              <Button
                onClick={() => {
                  // Try to open MetaMask import page
                  window.open('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#import-wallet', '_blank');
                  setConnectionStep(2);
                }}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!hasMetaMask}
              >
                🔗 Open MetaMask
              </Button>
            </div>
            <p className="text-xs text-blue-400 mt-1">
              • Click &quot;Import Account&quot; → &quot;Private Key&quot; → Paste your key → &quot;Import&quot;
            </p>
          </div>

          {/* Step 3: Connect to Hyperliquid */}
          <div className={`p-3 rounded ${connectionStep >= 3 ? 'bg-blue-800/30' : 'bg-gray-800/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-blue-300 text-sm font-medium">
                Step 3: Connect to Hyperliquid {isTestnet ? 'TESTNET' : 'MAINNET'}
              </span>
              <Button
                onClick={() => {
                  window.open(hyperliquidUrl, '_blank');
                  setConnectionStep(3);
                }}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                🚀 Open Hyperliquid {isTestnet ? 'Testnet' : ''}
              </Button>
            </div>
            <p className="text-xs text-blue-400 mt-1">
              • Click &quot;Connect Wallet&quot; → Select MetaMask → Choose your imported wallet
            </p>
          </div>
        </div>

        <div className="bg-green-900/20 border border-green-500 p-4 rounded-lg">
          <h4 className="text-green-400 font-semibold mb-2">💰 Before Trading:</h4>
          <p className="text-green-300 text-sm">
            {isTestnet ? (
              <>
                Make sure to add funds to your wallet on Hyperliquid Testnet. 
                Visit <a href={hyperliquidUrl} target="_blank" rel="noopener noreferrer" className="underline">Hyperliquid Testnet</a> and 
                use the testnet faucet to get test funds.
              </>
            ) : (
              <>
                Make sure to send some ETH to your wallet address above before starting to trade on Hyperliquid.
                You can get test ETH from a faucet or transfer from another wallet.
              </>
            )}
          </p>
        </div>

        <div className="flex space-x-3">
          <Button
            onClick={() => window.open(hyperliquidUrl, '_blank')}
            className="bg-[#8759ff] hover:bg-[#7c4dff] text-white"
          >
            🚀 Open Hyperliquid {isTestnet ? 'Testnet' : ''}
          </Button>
          {!hasMetaMask ? (
            <Button
              onClick={() => window.open('https://metamask.io/download', '_blank')}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              📱 Install MetaMask
            </Button>
          ) : (
            <Button
              onClick={() => {
                copyToClipboard(primaryWallet.privateKey!);
                alert('✅ Private key copied! You can now paste it into MetaMask.');
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              📋 Quick Copy Key
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
