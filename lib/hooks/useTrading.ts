"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

export interface TradingConfig {
  maxBudget: number;
  profitGoal: number;
  maxPerSession: number;
}

export interface SessionStatus {
  sessionId: string;
  status: 'running' | 'stopped' | 'completed' | 'error';
  pnl: number;
  openPositions: number;
  cycle: number;
  lastUpdate: Date;
  config: TradingConfig;
  error?: string;
}

export interface TradingUpdate {
  type: 'trading_update' | 'session_update' | 'error' | 'ping' | 'pong';
  data?: SessionStatus | { error?: string; timestamp?: number };
  sessionId?: string;
}

export function useTrading() {
  const [isConnected, setIsConnected] = useState(false);
  const [tradingSession, setTradingSession] = useState<SessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const checkAndSubscribeToActiveSessions = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/status`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.sessions && Array.isArray(data.sessions)) {
          const runningSessions = data.sessions.filter((session: any) => session.status === 'running');
          
          if (runningSessions.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
            // Subscribe to the most recent running session
            const latestSession = runningSessions[runningSessions.length - 1];
            
            wsRef.current.send(JSON.stringify({
              type: 'subscribe',
              sessionId: latestSession.sessionId
            }));
            
            // Set the trading session state
            setTradingSession(latestSession);
          }
        }
      }
    } catch (error) {
      console.error('[useTrading] Failed to check active sessions:', error);
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = 'ws://localhost:3002';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.error('[useTrading] WebSocket connection timeout');
          ws.close();
          setError('WebSocket connection timeout');
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Send a test message to verify connection
        ws.send(JSON.stringify({ type: 'ping', data: { timestamp: Date.now() } }));
        
        // Check for active sessions and subscribe to them
        checkAndSubscribeToActiveSessions();
      };

      ws.onmessage = (event) => {
        try {
          const data: TradingUpdate = JSON.parse(event.data);

          if (data.type === 'session_update' && data.data && 'sessionId' in data.data) {
            console.log('[FRONTEND_DEBUG] Received session_update:', data.data);
            setTradingSession(data.data as SessionStatus);
          } else if (data.type === 'trading_update' && data.data && 'sessionId' in data.data) {
            console.log('[FRONTEND_DEBUG] Received trading_update:', data.data);
            setTradingSession(data.data as SessionStatus);
          } else if (data.type === 'error') {
            setError(data.data?.error || 'Unknown error');
          } else if (data.type === 'ping') {
            // Respond to ping with pong
            ws.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }));
          }
        } catch (err) {
          console.error('[useTrading] Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[useTrading] WebSocket error:', error.message || 'Unknown WebSocket error');
        console.error('[useTrading] WebSocket readyState:', ws.readyState);
        console.error('[useTrading] WebSocket url:', ws.url);
        clearTimeout(connectionTimeout);
        setError('WebSocket connection error');
      };
    } catch (err) {
      console.error('[useTrading] Failed to create WebSocket:', err);
      setError('Failed to connect to trading server');
    }
  }, []);

  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const startTrading = useCallback(async (config: TradingConfig, hyperliquidApiWallet?: string): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/start-trading`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          hyperliquidApiWallet
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      // Subscribe to updates
      if (wsRef.current?.readyState === WebSocket.OPEN && result.sessionId) {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe',
          sessionId: result.sessionId
        }));
      }

      return result.sessionId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start trading session';
      console.error('[useTrading] Error starting trading:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopTrading = useCallback(async (sessionId: string, force = false): Promise<boolean> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/stop-trading`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, force }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop trading session';
      console.error('[useTrading] Error stopping trading:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, []);

  const getSessionStatus = useCallback(async (sessionId: string): Promise<SessionStatus | null> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/session/${sessionId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[useTrading] Error getting session status:', err);
      return null;
    }
  }, []);

  const getTradingConfig = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/status`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[useTrading] Error getting trading config:', err);
      return null;
    }
  }, []);

  // Connect WebSocket when component mounts
  useEffect(() => {
    // Connect with a small delay to ensure server is ready
    const connectWithDelay = () => {
      setTimeout(() => {
        connectWebSocket();
      }, 1000); // 1 second delay
    };
    
    connectWithDelay();

    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  return {
    // State
    isConnected,
    tradingSession,
    isLoading,
    error,
    
    // Actions
    startTrading,
    stopTrading,
    getSessionStatus,
    getTradingConfig,
    connectWebSocket,
    disconnectWebSocket,
    refreshSessionStatus: checkAndSubscribeToActiveSessions,
    
    // Utilities
    clearError: () => setError(null),
    clearSession: () => setTradingSession(null),
  };
}
