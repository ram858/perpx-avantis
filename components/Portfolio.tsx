"use client";

import React from 'react';
import { useWallet } from '@/lib/wallet/WalletContext';
import { WalletConnection } from './WalletConnection';

interface PortfolioProps {
  className?: string;
}

export function Portfolio({ className = "" }: PortfolioProps) {
  const {
    isConnected,
    account,
    ethBalanceFormatted,
    holdings,
    totalPortfolioValue,
    isLoading,
    refreshBalances
  } = useWallet();

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatBalance = (balance: string, decimals: number = 4) => {
    const num = parseFloat(balance);
    if (num === 0) return '0.00';
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(decimals);
  };

  if (!isConnected) {
    return (
      <div className={className}>
        <WalletConnection />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Portfolio Header */}
      <div className="bg-[#1f2937] rounded-xl p-6 border border-[#374151]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-xl mb-1">Portfolio</h2>
            <p className="text-[#9ca3af] text-sm">
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'}
            </p>
          </div>
          <button
            onClick={refreshBalances}
            disabled={isLoading}
            className="p-2 text-[#9ca3af] hover:text-white transition-colors disabled:opacity-50"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className={`${isLoading ? 'animate-spin' : ''}`}
            >
              <path
                d="M1 4V10H7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M23 20V14H17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[#9ca3af] text-sm mb-1">Total Portfolio Value</p>
            <div className="text-white font-bold text-2xl">
              {isLoading ? (
                <div className="w-24 h-8 bg-[#374151] rounded animate-pulse"></div>
              ) : (
                formatValue(totalPortfolioValue)
              )}
            </div>
          </div>
          <div>
            <p className="text-[#9ca3af] text-sm mb-1">ETH Balance</p>
            <div className="text-white font-semibold text-lg">
              {isLoading ? (
                <div className="w-20 h-6 bg-[#374151] rounded animate-pulse"></div>
              ) : (
                `${formatBalance(ethBalanceFormatted)} ETH`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div className="bg-[#1f2937] rounded-xl border border-[#374151]">
        <div className="p-4 border-b border-[#374151]">
          <h3 className="text-white font-semibold">Holdings</h3>
        </div>
        
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#374151] rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#4b5563] rounded-full animate-pulse"></div>
                    <div>
                      <div className="w-16 h-4 bg-[#4b5563] rounded animate-pulse mb-1"></div>
                      <div className="w-12 h-3 bg-[#4b5563] rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="w-20 h-4 bg-[#4b5563] rounded animate-pulse mb-1"></div>
                    <div className="w-16 h-3 bg-[#4b5563] rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* ETH */}
              <div className="flex items-center justify-between p-3 bg-[#374151] rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#7c3aed] to-[#8b5cf6] rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">Ξ</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Ethereum</p>
                    <p className="text-[#9ca3af] text-sm">ETH</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">
                    {formatBalance(ethBalanceFormatted)}
                  </p>
                  <p className="text-[#9ca3af] text-sm">
                    {formatValue(parseFloat(ethBalanceFormatted) * 2000)}
                  </p>
                </div>
              </div>

              {/* Token Holdings */}
              {holdings.map((holding) => (
                <div key={holding.token.address} className="flex items-center justify-between p-3 bg-[#374151] rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#10b981] to-[#059669] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xs">
                        {holding.token.symbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{holding.token.name}</p>
                      <p className="text-[#9ca3af] text-sm">{holding.token.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">
                      {formatBalance(holding.balanceFormatted)}
                    </p>
                    <p className="text-[#9ca3af] text-sm">
                      {formatValue(holding.valueUSD)}
                    </p>
                  </div>
                </div>
              ))}

              {holdings.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg
                      width="24"
                      height="24"
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
                  <p className="text-[#9ca3af] text-sm">No token holdings found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1f2937] rounded-xl p-4 border border-[#374151]">
          <p className="text-[#9ca3af] text-sm mb-1">24h Change</p>
          <p className="text-[#10b981] font-semibold">+2.34%</p>
        </div>
        <div className="bg-[#1f2937] rounded-xl p-4 border border-[#374151]">
          <p className="text-[#9ca3af] text-sm mb-1">Total Assets</p>
          <p className="text-white font-semibold">{holdings.length + 1}</p>
        </div>
        <div className="bg-[#1f2937] rounded-xl p-4 border border-[#374151]">
          <p className="text-[#9ca3af] text-sm mb-1">Network</p>
          <p className="text-white font-semibold">Ethereum</p>
        </div>
      </div>
    </div>
  );
}
