"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  data?: any;
  sessionId?: string;
}

interface WebSocketState {
  isConnected: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  reconnectAttempts: number;
}

export function useWebSocket(url: string) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    error: null,
    lastMessage: null,
    reconnectAttempts: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      console.log(`[WebSocket] Connecting to ${url}`);
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null,
          reconnectAttempts: 0
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message);
          setState(prev => ({
            ...prev,
            lastMessage: message,
            error: null
          }));
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: `Connection closed: ${event.reason || 'Unknown reason'}`
        }));

        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && state.reconnectAttempts < maxReconnectAttempts) {
          console.log(`[WebSocket] Attempting to reconnect (${state.reconnectAttempts + 1}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
            connect();
          }, reconnectDelay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: 'Connection error occurred'
        }));
      };

    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setState(prev => ({
        ...prev,
        isConnected: false,
        error: 'Failed to create WebSocket connection'
      }));
    }
  }, [url, state.reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setState({
      isConnected: false,
      error: null,
      lastMessage: null,
      reconnectAttempts: 0
    });
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        console.log('[WebSocket] Message sent:', message);
      } catch (error) {
        console.error('[WebSocket] Failed to send message:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to send message'
        }));
      }
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
      setState(prev => ({
        ...prev,
        error: 'Cannot send message: not connected'
      }));
    }
  }, []);

  // Connect on mount and when URL changes
  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage
  };
}
