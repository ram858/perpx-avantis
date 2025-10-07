"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/AuthContext';
import { useIntegratedWallet } from '@/lib/wallet/IntegratedWalletContext';

interface WalletCreationProps {
  className?: string;
  onWalletCreated?: (wallet: any) => void;
}

export function WalletCreation({ className = "", onWalletCreated }: WalletCreationProps) {
  const { token } = useAuth();
  const { allWallets, primaryWallet } = useIntegratedWallet();
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [mnemonic, setMnemonic] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdWallet, setCreatedWallet] = useState<any>(null);
  
  // Check if wallet already exists for selected chain
  const existingWallet = allWallets.find(wallet => wallet.chain === selectedChain);

  const supportedChains = [
    { id: 'ethereum', name: 'Ethereum', icon: 'Ξ' },
    { id: 'bitcoin', name: 'Bitcoin', icon: '₿' },
    { id: 'solana', name: 'Solana', icon: '◎' },
    { id: 'aptos', name: 'Aptos', icon: 'A' }
  ];

  const handleCreateWallet = async () => {
    if (!selectedChain) {
      setError('Please select a blockchain');
      return;
    }

    // Check if wallet already exists
    if (existingWallet) {
      setError(`You already have a ${selectedChain} wallet: ${existingWallet.address}`);
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chain: selectedChain,
          mnemonic: mnemonic || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create wallet');
      }

      if (data.success) {
        setCreatedWallet(data.wallet);
        setSuccess(`Wallet created successfully! Address: ${data.wallet.address}`);
        onWalletCreated?.(data.wallet);
      } else {
        throw new Error(data.error || 'Failed to create wallet');
      }
    } catch (err) {
      console.error('Error creating wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setIsCreating(false);
    }
  };

  const handleChainSelect = (chainId: string) => {
    setSelectedChain(chainId);
    setError(null);
    setSuccess(null);
    setCreatedWallet(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="p-6 bg-[#1f2937] border-[#374151]">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#7c3aed] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              width="32"
              height="32"
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
          <h2 className="text-2xl font-bold text-white mb-2">Create New Wallet</h2>
          <p className="text-[#9ca3af]">
            Generate a new wallet for your chosen blockchain
          </p>
        </div>

        {/* Chain Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white mb-3">
            Select Blockchain
          </label>
          <div className="grid grid-cols-2 gap-3">
            {supportedChains.map((chain) => (
              <button
                key={chain.id}
                onClick={() => handleChainSelect(chain.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedChain === chain.id
                    ? 'border-[#7c3aed] bg-[#7c3aed]/10'
                    : 'border-[#374151] hover:border-[#4b5563]'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">{chain.icon}</div>
                  <div className="text-white font-medium">{chain.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Existing Wallet Warning */}
        {existingWallet && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-yellow-400 font-medium">Wallet Already Exists</p>
                <p className="text-yellow-300 text-sm">
                  You already have a {selectedChain} wallet: <span className="font-mono">{existingWallet.address}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mnemonic Input (Optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white mb-2">
            Mnemonic Phrase (Optional)
          </label>
          <Input
            type="text"
            placeholder="Enter 12 or 24 word mnemonic phrase..."
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            className="bg-[#374151] border-[#4b5563] text-white placeholder-[#9ca3af]"
          />
          <p className="text-xs text-[#9ca3af] mt-1">
            Leave empty to generate a new wallet, or enter an existing mnemonic to restore
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}

        {/* Create Wallet Button */}
        <Button
          onClick={handleCreateWallet}
          disabled={isCreating || !selectedChain || existingWallet}
          className={`w-full py-3 ${
            existingWallet 
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
              : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
          }`}
        >
          {isCreating ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Creating Wallet...
            </div>
          ) : existingWallet ? (
            'Wallet Already Exists'
          ) : (
            'Create Wallet'
          )}
        </Button>

        {/* Created Wallet Info */}
        {createdWallet && (
          <div className="mt-6 p-4 bg-[#374151] rounded-lg">
            <h3 className="text-white font-medium mb-3">Wallet Created Successfully!</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-sm">Address:</span>
                <div className="flex items-center space-x-2">
                  <code className="text-white text-sm font-mono">
                    {createdWallet.address.slice(0, 6)}...{createdWallet.address.slice(-4)}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdWallet.address)}
                    className="text-[#7c3aed] hover:text-[#6d28d9] text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-sm">Chain:</span>
                <span className="text-white text-sm capitalize">{createdWallet.chain}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-sm">Wallet ID:</span>
                <span className="text-white text-sm font-mono">{createdWallet.id}</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
