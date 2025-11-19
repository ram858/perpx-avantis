"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getStorageItem } from '../utils/safeStorage';

export interface Position {
  coin: string;
  symbol?: string; // Symbol name (e.g., "BTC")
  pair_index?: number; // Avantis pair index (required for closing positions)
  size: string;
  side: 'long' | 'short';
  entryPrice: number;
  markPrice: number;
  pnl: number;
  roe: number;
  positionValue: number;
  margin: string;
  leverage: string;
  liquidationPrice?: number | null; // Liquidation price from Avantis
  collateral?: number; // Collateral amount
  takeProfit?: number | null; // Take profit price
  stopLoss?: number | null; // Stop loss price
}

export interface PositionData {
  positions: Position[];
  totalPnL: number;
  openPositions: number;
}

export function usePositions() {
  const { token } = useAuth();
  const [positionData, setPositionData] = useState<PositionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchInProgressRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

      const fetchPositions = useCallback(async (force = false) => {
        // Authentication is handled by the API endpoint
        if (!token) {
          console.warn('[usePositions] No token available, skipping fetch');
          return;
        }

        // Prevent concurrent fetches
        if (fetchInProgressRef.current && !force) {
          console.log('[usePositions] Fetch already in progress, skipping...');
          return;
        }

        fetchInProgressRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.log('[usePositions] Request timeout, aborting...');
            controller.abort();
          }, 30000); // Increased to 30s timeout

          const response = await fetch('/api/positions', {
            headers: {
              // 'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setPositionData(data);
      retryCountRef.current = 0; // Reset retry count on success
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
      console.error('[usePositions] Error fetching positions:', errorMessage);
      
      // Handle AbortError gracefully
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[usePositions] Request was aborted, likely due to timeout');
        setError('Request timeout - please check your connection');
        setPositionData({ positions: [], totalPnL: 0, openPositions: 0 });
      } else {
        // Retry logic for network errors (but not abort errors)
        if (retryCountRef.current < maxRetries && errorMessage.includes('fetch')) {
          retryCountRef.current++;
          console.log(`[usePositions] Retrying... (${retryCountRef.current}/${maxRetries})`);
          setTimeout(() => fetchPositions(true), 2000 * retryCountRef.current);
        } else {
          setError(errorMessage);
          setPositionData({ positions: [], totalPnL: 0, openPositions: 0 });
        }
      }
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, []); // Removed token dependency since authentication is disabled

  const closePositionInProgressRef = useRef<Set<string>>(new Set());
  const closeAllInProgressRef = useRef(false);

  const closePosition = useCallback(async (positionIdentifier: string | number): Promise<boolean> => {
    // TEMPORARY: Skip authentication for testing
    // if (!token) return false;
    
    // Prevent duplicate close requests
    const identifier = String(positionIdentifier);
    if (closePositionInProgressRef.current.has(identifier)) {
      console.log(`[usePositions] Close position already in progress for ${identifier}`);
      return false;
    }
    
    closePositionInProgressRef.current.add(identifier);
    
    try {
      // Find the position to get pair_index
      const position = positionData?.positions.find(p => 
        p.coin === positionIdentifier || 
        p.symbol === positionIdentifier ||
        p.pair_index === positionIdentifier
      );
      
      // Use pair_index if available, otherwise try to use the identifier as pair_index
      const pair_index = position?.pair_index || (typeof positionIdentifier === 'number' ? positionIdentifier : undefined);
      
      if (!pair_index && typeof positionIdentifier !== 'number') {
        console.error(`[usePositions] No pair_index found for position ${positionIdentifier}`);
        throw new Error(`Position ${positionIdentifier} does not have a pair_index. Cannot close position.`);
      }
      
      const token = getStorageItem('token', '');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for close
      
      const response = await fetch('/api/close-position', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pair_index: pair_index || (typeof positionIdentifier === 'number' ? positionIdentifier : undefined),
          symbol: position?.coin || position?.symbol || (typeof positionIdentifier === 'string' ? positionIdentifier : undefined) // Include symbol for reference
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      // Force refresh positions after successful close
      if (result.success) {
        setTimeout(() => fetchPositions(true), 500);
      }
      
      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to close position';
      console.error(`[usePositions] Error closing position ${identifier}:`, errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      closePositionInProgressRef.current.delete(identifier);
    }
  }, [fetchPositions]); // Removed token dependency

  const closeAllPositions = useCallback(async (): Promise<boolean> => {
    // TEMPORARY: Skip authentication for testing
    // if (!token) return false;
    
    // Prevent duplicate close all requests
    if (closeAllInProgressRef.current) {
      console.log('[usePositions] Close all positions already in progress');
      return false;
    }
    
    closeAllInProgressRef.current = true;
    
    try {
      console.log('[usePositions] Calling close-all-positions API...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for close all
      
      const response = await fetch('/api/close-all-positions', {
        method: 'POST',
        headers: {
          // 'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[usePositions] Close all positions result:', result);
      
      // Force refresh positions after successful close
      if (result.success) {
        setTimeout(() => fetchPositions(true), 1000);
      }
      
      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to close all positions';
      console.error('[usePositions] Error closing all positions:', errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      closeAllInProgressRef.current = false;
    }
  }, [fetchPositions]); // Removed token dependency

      // Smart auto-refresh: only refresh when positions exist and page is visible
      useEffect(() => {
        fetchPositions();

        let interval: NodeJS.Timeout | null = null;

        const startPolling = () => {
          if (interval) return; // Already polling

          // Much slower polling to reduce server load and prevent conflicts
          // Only poll every 45 seconds when no positions, 20 seconds when positions exist
          const pollInterval = positionData && positionData.openPositions > 0 ? 20000 : 45000;
          interval = setInterval(() => {
            // Only fetch if not already in progress
            if (!fetchInProgressRef.current) {
              fetchPositions();
            }
          }, pollInterval);
        };
    
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    
    // Start polling on mount
    startPolling();
    
    // Pause polling when tab is not visible to save resources
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchPositions(true); // Force refresh when tab becomes visible
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchPositions, positionData?.openPositions]);

  return {
    positionData,
    isLoading,
    error,
    fetchPositions,
    closePosition,
    closeAllPositions,
  };
}
