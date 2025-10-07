"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/AuthContext';

interface Wallet {
  id: string;
  address: string;
  chain: string;
  createdAt: string;
}

interface WalletManagementProps {
  className?: string;
}

export function WalletManagement({ className = "" }: WalletManagementProps) {
  const { token } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportedChains = [
    { id: 'ethereum', name: 'Ethereum', icon: 'Ξ', color: 'text-blue-400' },
    { id: 'bitcoin', name: 'Bitcoin', icon: '₿', color: 'text-orange-400' },
    { id: 'solana', name: 'Solana', icon: '◎', color: 'text-purple-400' },
    { id: 'aptos', name: 'Aptos', icon: 'A', color: 'text-green-400' }
  ];

  const getChainInfo = (chainId: string) => {
    return supportedChains.find(chain => chain.id === chainId) || {
      id: chainId,
      name: chainId.charAt(0).toUpperCase() + chainId.slice(1),
      icon: '?',
      color: 'text-gray-400'
    };
  };

  const fetchWallets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/wallet', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch wallets');
      }

      if (data.success) {
        setWallets(data.wallets || []);
      } else {
        throw new Error(data.error || 'Failed to fetch wallets');
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch wallets');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    if (token) {
      fetchWallets();
    }
  }, [token]);

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="p-6 bg-[#1f2937] border-[#374151]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">My Wallets</h2>
            <p className="text-[#9ca3af]">
              Manage your blockchain wallets
            </p>
          </div>
          <Button
            onClick={fetchWallets}
            disabled={isLoading}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Loading...
              </div>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Wallets List */}
        {wallets.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#9ca3af]"
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
            <h3 className="text-white font-medium mb-2">No Wallets Found</h3>
            <p className="text-[#9ca3af] text-sm">
              Create your first wallet to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {wallets.map((wallet) => {
              const chainInfo = getChainInfo(wallet.chain);
              return (
                <div
                  key={wallet.id}
                  className="p-4 bg-[#374151] rounded-lg border border-[#4b5563]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`text-2xl ${chainInfo.color}`}>
                        {chainInfo.icon}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-white font-medium">
                            {chainInfo.name} Wallet
                          </h3>
                          <span className="text-xs bg-[#7c3aed] text-white px-2 py-1 rounded">
                            {wallet.chain}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <code className="text-[#9ca3af] text-sm font-mono">
                            {formatAddress(wallet.address)}
                          </code>
                          <button
                            onClick={() => copyToClipboard(wallet.address)}
                            className="text-[#7c3aed] hover:text-[#6d28d9] text-sm"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#9ca3af] text-xs">
                        Created {formatDate(wallet.createdAt)}
                      </div>
                      <div className="text-[#9ca3af] text-xs font-mono">
                        ID: {wallet.id.slice(-8)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
