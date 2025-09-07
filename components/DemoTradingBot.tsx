"use client";

import React, { useState, useEffect } from 'react';

interface TradingSession {
  sessionId: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  pnl: number;
  openPositions: number;
  cycle: number;
  startTime: Date;
  lastUpdate: Date;
}

interface DemoTradingBotProps {
  onTradingUpdate?: (session: TradingSession) => void;
}

export const DemoTradingBot: React.FC<DemoTradingBotProps> = ({ onTradingUpdate }) => {
  const [sessions, setSessions] = useState<Map<string, TradingSession>>(new Map());
  const [isRunning, setIsRunning] = useState(false);

  const startSession = (config: { maxBudget: number; profitGoal: number; maxPerSession: number }) => {
    const sessionId = `demo_${Date.now()}`;
    const session: TradingSession = {
      sessionId,
      status: 'running',
      pnl: 0,
      openPositions: 0,
      cycle: 0,
      startTime: new Date(),
      lastUpdate: new Date()
    };

    setSessions(prev => new Map(prev.set(sessionId, session)));
    setIsRunning(true);

    // Start simulation
    simulateTrading(sessionId, config);
    
    return sessionId;
  };

  const stopSession = (sessionId: string) => {
    setSessions(prev => {
      const newSessions = new Map(prev);
      const session = newSessions.get(sessionId);
      if (session) {
        session.status = 'stopped';
        newSessions.set(sessionId, session);
      }
      return newSessions;
    });
  };

  const simulateTrading = (sessionId: string, config: { maxBudget: number; profitGoal: number; maxPerSession: number }) => {
    const interval = setInterval(() => {
      setSessions(prev => {
        const newSessions = new Map(prev);
        const session = newSessions.get(sessionId);
        
        if (!session || session.status !== 'running') {
          clearInterval(interval);
          return newSessions;
        }

        // Update session
        session.cycle++;
        session.lastUpdate = new Date();

        // Simulate PnL changes
        const marketVolatility = 1.2;
        const trendBias = 0.15;
        const change = (Math.random() - 0.5 + trendBias) * marketVolatility * 2;
        session.pnl += change;

        // Simulate position changes
        if (Math.random() > 0.6) {
          const positionChange = Math.random() > 0.5 ? 1 : -1;
          session.openPositions = Math.min(
            config.maxPerSession,
            Math.max(0, session.openPositions + positionChange)
          );
        }

        // Check completion conditions
        if (session.pnl >= config.profitGoal) {
          session.status = 'completed';
          clearInterval(interval);
        } else if (session.pnl <= -config.maxBudget * 0.8) {
          session.status = 'error';
          clearInterval(interval);
        }

        newSessions.set(sessionId, session);
        
        // Notify parent component
        if (onTradingUpdate) {
          onTradingUpdate(session);
        }

        return newSessions;
      });
    }, 2000); // Update every 2 seconds
  };

  const getSession = (sessionId: string) => {
    return sessions.get(sessionId);
  };

  const getAllSessions = () => {
    return Array.from(sessions.values());
  };

  // Expose methods for external use
  useEffect(() => {
    // @ts-ignore
    window.demoTradingBot = {
      startSession,
      stopSession,
      getSession,
      getAllSessions
    };
  }, []);

  return null; // This component doesn't render anything
};

export default DemoTradingBot;
