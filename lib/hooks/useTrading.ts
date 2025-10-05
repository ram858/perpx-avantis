"use client";

import { useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';

export interface TradingConfig {
  totalBudget: number;
  profitGoal: number;
  maxPositions: number;
  leverage?: number;
}

export interface TradingSession {
  id: string;
  status: 'running' | 'completed' | 'stopped' | 'error';
  startTime: Date;
  endTime?: Date;
  totalPnL: number;
  positions: number;
  config: TradingConfig;
  error?: string;
}

export interface TradingPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  leverage: number;
  timestamp: Date;
}

export function useTrading() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Request failed');
    }

    return response.json();
  }, [token]);

  const startTrading = useCallback(async (config: TradingConfig): Promise<TradingSession> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await makeRequest('/api/trading/start', {
        method: 'POST',
        body: JSON.stringify(config),
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to start trading');
      }

      // Return a basic session object
      return {
        id: result.sessionId,
        status: 'running',
        startTime: new Date(),
        totalPnL: 0,
        positions: 0,
        config
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start trading';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [makeRequest]);

  const stopTrading = useCallback(async (sessionId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await makeRequest('/api/trading/stop', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to stop trading');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop trading';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [makeRequest]);

  const getTradingSessions = useCallback(async (): Promise<TradingSession[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await makeRequest('/api/trading/sessions');

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch trading sessions');
      }

      return result.sessions.map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trading sessions';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [makeRequest]);

  const getTradingSession = useCallback(async (sessionId: string): Promise<TradingSession & { positions: TradingPosition[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await makeRequest(`/api/trading/session/${sessionId}`);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch trading session');
      }

      return {
        ...result.session,
        startTime: new Date(result.session.startTime),
        endTime: result.session.endTime ? new Date(result.session.endTime) : undefined,
        positions: result.session.positions.map((pos: any) => ({
          ...pos,
          timestamp: new Date(pos.timestamp),
        })),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trading session';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [makeRequest]);

  return {
    isLoading,
    error,
    startTrading,
    stopTrading,
    getTradingSessions,
    getTradingSession,
  };
}