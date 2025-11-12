"use client";

import { useState, useEffect } from 'react';

export interface TradingProfit {
  sessionId: string;
  pnl: number;
  status: string;
  completedAt: Date;
}

export function useTradingProfits() {
  const [totalProfits, setTotalProfits] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTradingProfits = async () => {
    setIsLoading(true);
    try {
      // Use API route instead of direct trading engine connection
      // This avoids CORS and connection issues in production
      const response = await fetch('/api/status');
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.sessions && Array.isArray(data.sessions)) {
          // Calculate total profits from completed sessions
          const completedSessions = data.sessions.filter((session: any) => 
            session.status === 'completed' && session.pnl > 0
          );
          
          const total = completedSessions.reduce((sum: number, session: any) => 
            sum + session.pnl, 0
          );
          
          setTotalProfits(total);
        }
      }
    } catch (error) {
      console.error('[useTradingProfits] Failed to fetch trading profits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Delay initial fetch to improve loading performance
    const timer = setTimeout(() => {
      fetchTradingProfits();
    }, 2000); // 2 second delay
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchTradingProfits, 30000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return {
    totalProfits,
    isLoading,
    refreshProfits: fetchTradingProfits
  };
}
