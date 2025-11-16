"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

interface UILoggerContextType {
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], message: string, details?: any) => void;
  clearLogs: () => void;
  isVisible: boolean;
  toggleVisibility: () => void;
}

const UILoggerContext = createContext<UILoggerContextType | undefined>(undefined);

export function UILoggerProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(true); // Show by default for debugging

  const addLog = useCallback((level: LogEntry['level'], message: string, details?: any) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      message,
      details,
    };
    
    setLogs(prev => {
      const newLogs = [entry, ...prev].slice(0, 50); // Keep last 50 logs
      return newLogs;
    });
    
    // Also log to console for developers
    const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
    console[consoleMethod](`[UI Logger] ${message}`, details || '');
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  return (
    <UILoggerContext.Provider value={{ logs, addLog, clearLogs, isVisible, toggleVisibility }}>
      {children}
    </UILoggerContext.Provider>
  );
}

export function useUILogger() {
  const context = useContext(UILoggerContext);
  if (!context) {
    throw new Error('useUILogger must be used within UILoggerProvider');
  }
  return context;
}

