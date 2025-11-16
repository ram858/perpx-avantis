"use client";

import { useState, useCallback, useEffect } from 'react';
import { useTrading } from './useTrading';
import { usePositions } from './usePositions';
import { useTradingFee } from './useTradingFee';
import { useIntegratedWallet } from '@/lib/wallet/IntegratedWalletContext';

export interface TradingSessionState {
  id: string;
  status: 'running' | 'completed' | 'stopped' | 'error';
  startTime: Date;
  endTime?: Date;
  totalPnL: number;
  positions: number;
  cycle: number;
  openPositions: number;
  pnl: number;
  sessionId: string;
  config: {
    profitGoal: number;
    maxBudget: number;
    maxPerSession: number;
    totalBudget?: number;
  };
}

export function useTradingSession() {
  const { startTrading: startTradingAPI, stopTrading: stopTradingAPI, getTradingSession, getTradingSessions } = useTrading();
  const { positionData, fetchPositions } = usePositions();
  const { payTradingFee, isPayingFee } = useTradingFee();
  const { refreshBalances } = useIntegratedWallet();
  
  const [tradingSession, setTradingSession] = useState<TradingSessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh session status from API - also tries to restore session if not in state
  const refreshSessionStatus = useCallback(async (forceRestore: boolean = false) => {
    // If we have a session, refresh it
    if (tradingSession && !forceRestore) {
      try {
        const session = await getTradingSession(tradingSession.id);
        if (session) {
          setTradingSession(prev => prev ? {
            ...prev,
            status: session.status,
            totalPnL: session.totalPnL,
            positions: session.positions?.length || 0,
            pnl: session.totalPnL,
            openPositions: session.positions?.length || 0,
            cycle: (session as any).cycle || prev.cycle || 0,
          } : null);
        }
      } catch (err) {
        console.error('Failed to refresh session status:', err);
      }
    } else {
      // If no session in state OR force restore, try to find active session
      // Check for active sessions even without positions (session might be running but no positions yet)
      try {
        // Try to get all sessions and find the active one
        const sessions = await getTradingSessions();
        const activeSession = sessions.find(s => s.status === 'running');
        
        if (activeSession) {
          const sessionState: TradingSessionState = {
            id: activeSession.id,
            sessionId: activeSession.id,
            status: activeSession.status,
            startTime: activeSession.startTime,
            totalPnL: activeSession.totalPnL || positionData?.totalPnL || 0,
            positions: (activeSession.positions && Array.isArray(activeSession.positions) ? activeSession.positions.length : activeSession.positions) || positionData?.openPositions || 0,
            cycle: 0,
            openPositions: positionData?.openPositions || 0,
            pnl: activeSession.totalPnL || positionData?.totalPnL || 0,
            config: activeSession.config ? {
              profitGoal: activeSession.config.profitGoal || 0,
              maxBudget: (activeSession.config as any).maxBudget || (activeSession.config as any).totalBudget || 0,
              maxPerSession: (activeSession.config as any).maxPerSession || (activeSession.config as any).maxPositions || 0,
              totalBudget: (activeSession.config as any).totalBudget || (activeSession.config as any).maxBudget || 0,
            } : {
              profitGoal: 0,
              maxBudget: 0,
              maxPerSession: 0,
            }
          };
          setTradingSession(sessionState);
          console.log('[useTradingSession] Restored active session:', activeSession.id);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      }
    }
  }, [tradingSession, getTradingSession, getTradingSessions, positionData]);

  // Clear current session
  const clearSession = useCallback(() => {
    setTradingSession(null);
    setError(null);
  }, []);

  // Start trading with session management - with progress callbacks
  const startTrading = useCallback(async (config: {
    maxBudget?: number;
    investmentAmount?: number;
    profitGoal?: number;
    targetProfit?: number;
    maxPerSession?: number;
    leverage?: number;
    lossThreshold?: number;
  }, onProgress?: (step: string, message: string) => void) => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Pay trading fee
      onProgress?.('fee', 'Paying trading fee...');
      console.log('[useTradingSession] Paying trading fee...');
      const feeResult = await payTradingFee();
      
      if (!feeResult.success) {
        throw new Error(feeResult.error || 'Failed to pay trading fee');
      }
      
      onProgress?.('fee', `✅ Fee paid: ${feeResult.amount} ${feeResult.currency}`);
      console.log(`[useTradingSession] Fee paid successfully: ${feeResult.amount} ${feeResult.currency} (tx: ${feeResult.transactionHash})`);

      // Step 2: Refresh balances (non-blocking)
      onProgress?.('balance', 'Updating balances...');
      refreshBalances(true).then(() => {
        console.log('[useTradingSession] Balances refreshed after fee payment');
        onProgress?.('balance', '✅ Balances updated');
      }).catch((refreshError) => {
        console.warn('[useTradingSession] Failed to refresh balances after fee payment:', refreshError);
        // Don't fail the trading start if balance refresh fails
      });

      // Step 3: Start trading session (this should return quickly)
      onProgress?.('session', 'Starting trading session...');
      const session = await startTradingAPI({
        totalBudget: config.maxBudget || config.investmentAmount || 50,
        profitGoal: config.profitGoal || config.targetProfit || 10,
        maxPositions: config.maxPerSession || 3,
        leverage: config.leverage || 1,
        lossThreshold: config.lossThreshold || 10
      });
      
      onProgress?.('session', `✅ Session started: ${session.id.slice(0, 8)}...`);

      // Create session state
      const sessionState: TradingSessionState = {
        id: session.id,
        sessionId: session.id,
        status: session.status,
        startTime: session.startTime,
        totalPnL: session.totalPnL,
        positions: session.positions || 0,
        cycle: 0,
        openPositions: 0,
        pnl: session.totalPnL,
        config: {
          profitGoal: config.profitGoal || config.targetProfit || 10,
          maxBudget: config.maxBudget || config.investmentAmount || 50,
          maxPerSession: config.maxPerSession || 5,
          totalBudget: config.maxBudget || config.investmentAmount || 50,
        }
      };

      setTradingSession(sessionState);
      onProgress?.('complete', '✅ Trading session ready!');
      return session.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start trading';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [startTradingAPI, payTradingFee, refreshBalances]);

  // Stop trading
  const stopTrading = useCallback(async (sessionId: string, closeAll?: boolean) => {
    if (!tradingSession) return false;

    try {
      await stopTradingAPI(sessionId);
      
      setTradingSession(prev => prev ? {
        ...prev,
        status: 'stopped',
        endTime: new Date()
      } : null);
      
      return true;
    } catch (err) {
      console.error('Failed to stop trading:', err);
      return false;
    }
  }, [tradingSession, stopTradingAPI]);

  // Update session with position data
  useEffect(() => {
    if (tradingSession && positionData) {
      setTradingSession(prev => prev ? {
        ...prev,
        totalPnL: positionData.totalPnL || 0,
        pnl: positionData.totalPnL || 0,
        openPositions: positionData.openPositions || 0,
        positions: positionData.openPositions || 0,
        cycle: (prev.cycle || 0) + 1
      } : null);
    }
  }, [positionData]); // Removed tradingSession from dependencies to prevent infinite loop

      // Auto-refresh session status periodically
      useEffect(() => {
        if (!tradingSession || tradingSession.status !== 'running') return;

        const interval = setInterval(() => {
          refreshSessionStatus();
          // Don't call fetchPositions here - it's already handled by usePositions hook
          // fetchPositions();
        }, 10000); // Refresh every 10 seconds (less frequent)

        return () => clearInterval(interval);
      }, [tradingSession?.status]); // Only depend on status, not the entire session object

  return {
    tradingSession,
    isLoading: isLoading || isPayingFee,
    error,
    startTrading,
    stopTrading,
    refreshSessionStatus,
    clearSession,
  };
}
