"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBaseAccountTrading } from '@/lib/hooks/useBaseAccountTrading';
import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp';
import { useToast } from './ui/toast';

interface BaseAccountTradingPanelProps {
  sessionId: string;
  onPositionOpened?: () => void;
  onPositionClosed?: () => void;
}

export function BaseAccountTradingPanel({ 
  sessionId, 
  onPositionOpened, 
  onPositionClosed 
}: BaseAccountTradingPanelProps) {
  const { openPosition, closePosition, isLoading, error, isAvailable } = useBaseAccountTrading();
  const { addToast } = useToast();
  const { isBaseContext } = useBaseMiniApp();

  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [openParams, setOpenParams] = useState({
    symbol: 'BTC',
    collateral: 100,
    leverage: 10,
    isLong: true,
    tp: '',
    sl: '',
  });
  const [closePairIndex, setClosePairIndex] = useState('');

  if (!isBaseContext || !isAvailable) {
    return null;
  }

  const handleOpenPosition = async () => {
    try {
      const result = await openPosition(
        sessionId,
        openParams.symbol,
        openParams.collateral,
        openParams.leverage,
        openParams.isLong,
        openParams.tp ? parseFloat(openParams.tp) : undefined,
        openParams.sl ? parseFloat(openParams.sl) : undefined,
      );

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Position opened',
          message: `Transaction submitted: ${result.txHash?.slice(0, 10)}...`,
        });
        setShowOpenForm(false);
        setOpenParams({
          symbol: 'BTC',
          collateral: 100,
          leverage: 10,
          isLong: true,
          tp: '',
          sl: '',
        });
        onPositionOpened?.();
      } else {
        addToast({
          type: 'error',
          title: 'Failed to open position',
          message: result.error || 'Unknown error occurred',
        });
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to open position',
      });
    }
  };

  const handleClosePosition = async () => {
    const pairIndex = parseInt(closePairIndex);
    if (isNaN(pairIndex)) {
      addToast({
        type: 'error',
        title: 'Invalid pair index',
        message: 'Please enter a valid pair index',
      });
      return;
    }

    try {
      const result = await closePosition(sessionId, pairIndex);

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Position closed',
          message: `Transaction submitted: ${result.txHash?.slice(0, 10)}...`,
        });
        setShowCloseForm(false);
        setClosePairIndex('');
        onPositionClosed?.();
      } else {
        addToast({
          type: 'error',
          title: 'Failed to close position',
          message: result.error || 'Unknown error occurred',
        });
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to close position',
      });
    }
  };

  return (
    <Card className="p-6 bg-[#1a1a1a] border-[#333] mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Base Account Trading</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Open Position */}
        <div>
          {!showOpenForm ? (
            <Button
              onClick={() => setShowOpenForm(true)}
              disabled={isLoading}
              className="w-full bg-[#8759ff] hover:bg-[#7c4dff] text-white"
            >
              Open Position
            </Button>
          ) : (
            <div className="space-y-3 p-4 bg-[#2a2a2a] rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Symbol</label>
                  <Input
                    value={openParams.symbol}
                    onChange={(e) => setOpenParams({ ...openParams, symbol: e.target.value.toUpperCase() })}
                    className="bg-[#1a1a1a] border-[#444] text-white text-sm"
                    placeholder="BTC"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Collateral ($)</label>
                  <Input
                    type="number"
                    value={openParams.collateral}
                    onChange={(e) => setOpenParams({ ...openParams, collateral: parseFloat(e.target.value) || 0 })}
                    className="bg-[#1a1a1a] border-[#444] text-white text-sm"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Leverage</label>
                  <Input
                    type="number"
                    value={openParams.leverage}
                    onChange={(e) => setOpenParams({ ...openParams, leverage: parseInt(e.target.value) || 1 })}
                    className="bg-[#1a1a1a] border-[#444] text-white text-sm"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Direction</label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setOpenParams({ ...openParams, isLong: true })}
                      className={openParams.isLong ? 'bg-green-600' : 'bg-[#444]'}
                    >
                      Long
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setOpenParams({ ...openParams, isLong: false })}
                      className={!openParams.isLong ? 'bg-red-600' : 'bg-[#444]'}
                    >
                      Short
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Take Profit (optional)</label>
                  <Input
                    type="number"
                    value={openParams.tp}
                    onChange={(e) => setOpenParams({ ...openParams, tp: e.target.value })}
                    className="bg-[#1a1a1a] border-[#444] text-white text-sm"
                    placeholder="45000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Stop Loss (optional)</label>
                  <Input
                    type="number"
                    value={openParams.sl}
                    onChange={(e) => setOpenParams({ ...openParams, sl: e.target.value })}
                    className="bg-[#1a1a1a] border-[#444] text-white text-sm"
                    placeholder="40000"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleOpenPosition}
                  disabled={isLoading}
                  className="flex-1 bg-[#8759ff] hover:bg-[#7c4dff] text-white"
                >
                  {isLoading ? 'Opening...' : 'Open Position'}
                </Button>
                <Button
                  onClick={() => setShowOpenForm(false)}
                  variant="outline"
                  className="border-[#444] text-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Close Position */}
        <div>
          {!showCloseForm ? (
            <Button
              onClick={() => setShowCloseForm(true)}
              disabled={isLoading}
              variant="outline"
              className="w-full border-[#444] text-gray-300 hover:bg-[#2a2a2a]"
            >
              Close Position
            </Button>
          ) : (
            <div className="space-y-3 p-4 bg-[#2a2a2a] rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Pair Index</label>
                <Input
                  type="number"
                  value={closePairIndex}
                  onChange={(e) => setClosePairIndex(e.target.value)}
                  className="bg-[#1a1a1a] border-[#444] text-white text-sm"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleClosePosition}
                  disabled={isLoading || !closePairIndex}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isLoading ? 'Closing...' : 'Close Position'}
                </Button>
                <Button
                  onClick={() => setShowCloseForm(false)}
                  variant="outline"
                  className="border-[#444] text-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#444]">
        <p className="text-xs text-gray-500">
          💡 Transactions will be signed via Base Account SDK. You'll need to approve each transaction.
        </p>
      </div>
    </Card>
  );
}

