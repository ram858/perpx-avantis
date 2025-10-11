"use client";

import { useState, useCallback, useEffect } from 'react';
import { useTrading } from './useTrading';
import { usePositions } from './usePositions';

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
  const { startTrading: startTradingAPI, stopTrading: stopTradingAPI, getTradingSession } = useTrading();
  const { positionData, fetchPositions } = usePositions();
  
  const [tradingSession, setTradingSession] = useState<TradingSessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh session status from API
  const refreshSessionStatus = useCallback(async () => {
    if (!tradingSession) return;
    
    try {
      const session = await getTradingSession(tradingSession.id);
      if (session) {
        setTradingSession(prev => prev ? {
          ...prev,
          status: session.status,
          totalPnL: session.totalPnL,
          positions: session.positions?.length || 0,
          pnl: session.totalPnL,
        } : null);
      }
    } catch (err) {
      console.error('Failed to refresh session status:', err);
    }
  }, [tradingSession, getTradingSession]);

  // Clear current session
  const clearSession = useCallback(() => {
    setTradingSession(null);
    setError(null);
  }, []);

  // Start trading with session management
  const startTrading = useCallback(async (config: {
    maxBudget?: number;
    investmentAmount?: number;
    profitGoal?: number;
    targetProfit?: number;
    maxPerSession?: number;
    leverage?: number;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await startTradingAPI({
        totalBudget: config.maxBudget || config.investmentAmount,
        profitGoal: config.profitGoal || config.targetProfit,
        maxPositions: config.maxPerSession || 5,
        leverage: config.leverage || 1
      });

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
          profitGoal: config.profitGoal || config.targetProfit,
          maxBudget: config.maxBudget || config.investmentAmount,
          maxPerSession: config.maxPerSession || 5,
          totalBudget: config.maxBudget || config.investmentAmount,
        }
      };

      setTradingSession(sessionState);
      return session.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start trading';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [startTradingAPI]);

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
      fetchPositions();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [tradingSession?.status]); // Only depend on status, not the entire session object

  return {
    tradingSession,
    isLoading,
    error,
    startTrading,
    stopTrading,
    refreshSessionStatus,
    clearSession,
  };
}
