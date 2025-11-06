"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthContext';
import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp';

interface BaseAccountTradingOptionsProps {
  onFallbackWalletCreated?: () => void;
}

export function BaseAccountTradingOptions({ onFallbackWalletCreated }: BaseAccountTradingOptionsProps) {
  const { token, user } = useAuth();
  const { isBaseContext } = useBaseMiniApp();
  const [hasFallbackWallet, setHasFallbackWallet] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkFallbackWallet();
  }, [token]);

  const checkFallbackWallet = async () => {
    if (!token) return;

    setIsChecking(true);
    try {
      const response = await fetch('/api/trading/create-fallback-wallet', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHasFallbackWallet(data.hasFallbackWallet || false);
      }
    } catch (err) {
      console.error('Error checking fallback wallet:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const createFallbackWallet = async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/trading/create-fallback-wallet', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create fallback wallet');
      }

      setSuccess(data.message || 'Fallback wallet created successfully');
      setHasFallbackWallet(true);
      
      if (onFallbackWalletCreated) {
        onFallbackWalletCreated();
      }

      // Refresh wallet status
      await checkFallbackWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create fallback wallet');
    } finally {
      setIsCreating(false);
    }
  };

  // Only show if in Base mini app context
  if (!isBaseContext) {
    return null;
  }

  return (
    <Card className="p-6 bg-[#1f2937] border-[#374151] mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Base Account Trading Options</h3>
      
      <div className="space-y-4">
        <div className="bg-[#111827] p-4 rounded-lg border border-[#374151]">
          <h4 className="text-sm font-medium text-white mb-2">Base Account (Manual Trading)</h4>
          <p className="text-sm text-[#9ca3af] mb-3">
            Use your Base Account for manual trading. Transactions will be signed via Base Account SDK.
            You'll need to approve each transaction.
          </p>
          <div className="flex items-center space-x-2">
            <div className="flex-1">
              <p className="text-xs text-[#6b7280]">Base Account Address</p>
              <p className="text-sm text-white font-mono">
                {user?.baseAccountAddress ? `${user.baseAccountAddress.slice(0, 6)}...${user.baseAccountAddress.slice(-4)}` : 'Not available'}
              </p>
            </div>
            <div className="px-3 py-1 bg-[#059669] text-white text-xs rounded-full">
              Active
            </div>
          </div>
        </div>

        <div className="bg-[#111827] p-4 rounded-lg border border-[#374151]">
          <h4 className="text-sm font-medium text-white mb-2">Fallback Trading Wallet (Automated Trading)</h4>
          <p className="text-sm text-[#9ca3af] mb-3">
            Create a separate trading wallet for fully automated trading strategies. 
            This wallet will be used for automated trades without requiring manual approval.
          </p>
          
          {isChecking ? (
            <div className="text-sm text-[#9ca3af]">Checking wallet status...</div>
          ) : hasFallbackWallet ? (
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-[#6b7280]">Fallback Wallet Status</p>
                <p className="text-sm text-white">Fallback wallet is available for automated trading</p>
              </div>
              <div className="px-3 py-1 bg-[#059669] text-white text-xs rounded-full">
                Available
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#fbbf24]">
                ⚠️ No fallback wallet found. Create one to enable automated trading.
              </p>
              <Button
                onClick={createFallbackWallet}
                disabled={isCreating}
                className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
              >
                {isCreating ? 'Creating...' : 'Create Fallback Trading Wallet'}
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-[#7f1d1d] border border-[#991b1b] text-white p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-[#064e3b] border border-[#065f46] text-white p-3 rounded-lg text-sm">
            {success}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-[#374151]">
        <p className="text-xs text-[#6b7280]">
          💡 <strong>Tip:</strong> Use Base Account for manual control, or create a fallback wallet for automated strategies.
        </p>
      </div>
    </Card>
  );
}

