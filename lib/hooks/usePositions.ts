"use client";

import { useState, useEffect, useCallback } from 'react';

export interface Position {
  coin: string;
  size: string;
  side: 'long' | 'short';
  entryPrice: number;
  markPrice: number;
  pnl: number;
  roe: number;
  positionValue: number;
  margin: string;
  leverage: string;
}

export interface PositionData {
  positions: Position[];
  totalPnL: number;
  openPositions: number;
}

export function usePositions() {
  const [positionData, setPositionData] = useState<PositionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/positions`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setPositionData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closePosition = useCallback(async (symbol: string): Promise<boolean> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/close-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to close position';
      setError(errorMessage);
      return false;
    }
  }, []);

  // Auto-refresh positions every 5 seconds
  useEffect(() => {
    fetchPositions();
    
    const interval = setInterval(fetchPositions, 5000);
    
    return () => clearInterval(interval);
  }, [fetchPositions]);

  return {
    positionData,
    isLoading,
    error,
    fetchPositions,
    closePosition,
  };
}
