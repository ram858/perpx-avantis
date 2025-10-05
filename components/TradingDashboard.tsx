"use client";

import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTrading, TradingConfig, TradingSession } from '@/lib/hooks/useTrading';

export function TradingDashboard() {
  const { startTrading, stopTrading, getTradingSessions, isLoading, error } = useTrading();
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [showStartForm, setShowStartForm] = useState(false);
  const [config, setConfig] = useState<TradingConfig>({
    totalBudget: 100,
    profitGoal: 20,
    maxPositions: 3,
    leverage: 5
  });

  // Load trading sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const userSessions = await getTradingSessions();
      setSessions(userSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleStartTrading = async () => {
    try {
      const newSession = await startTrading(config);
      setSessions(prev => [newSession, ...prev]);
      setShowStartForm(false);
      // Reset form
      setConfig({
        totalBudget: 100,
        profitGoal: 20,
        maxPositions: 3,
        leverage: 5
      });
    } catch (error) {
      console.error('Failed to start trading:', error);
    }
  };

  const handleStopTrading = async (sessionId: string) => {
    try {
      await stopTrading(sessionId);
      await loadSessions(); // Reload sessions to get updated status
    } catch (error) {
      console.error('Failed to stop trading:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'completed': return 'text-blue-500';
      case 'stopped': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Trading Dashboard</h2>
        <Button 
          onClick={() => setShowStartForm(true)}
          disabled={isLoading}
          className="bg-[#8759ff] hover:bg-[#7c4dff] text-white"
        >
          Start Trading Session
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-900/20 border-red-500">
          <p className="text-red-400">Error: {error}</p>
        </Card>
      )}

      {/* Start Trading Form */}
      {showStartForm && (
        <Card className="p-6 bg-[#1a1a1a] border-[#333]">
          <h3 className="text-xl font-semibold text-white mb-4">Start New Trading Session</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Total Budget (USD)
              </label>
              <Input
                type="number"
                value={config.totalBudget}
                onChange={(e) => setConfig(prev => ({ ...prev, totalBudget: parseFloat(e.target.value) || 0 }))}
                className="bg-[#2a2a2a] border-[#444] text-white"
                placeholder="100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Profit Goal (USD)
              </label>
              <Input
                type="number"
                value={config.profitGoal}
                onChange={(e) => setConfig(prev => ({ ...prev, profitGoal: parseFloat(e.target.value) || 0 }))}
                className="bg-[#2a2a2a] border-[#444] text-white"
                placeholder="20"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Positions
              </label>
              <Input
                type="number"
                value={config.maxPositions}
                onChange={(e) => setConfig(prev => ({ ...prev, maxPositions: parseInt(e.target.value) || 1 }))}
                className="bg-[#2a2a2a] border-[#444] text-white"
                placeholder="3"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Leverage
              </label>
              <Input
                type="number"
                value={config.leverage}
                onChange={(e) => setConfig(prev => ({ ...prev, leverage: parseFloat(e.target.value) || 1 }))}
                className="bg-[#2a2a2a] border-[#444] text-white"
                placeholder="5"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleStartTrading}
              disabled={isLoading}
              className="bg-[#8759ff] hover:bg-[#7c4dff] text-white"
            >
              {isLoading ? 'Starting...' : 'Start Trading'}
            </Button>
            <Button 
              onClick={() => setShowStartForm(false)}
              variant="outline"
              className="border-[#444] text-gray-300 hover:bg-[#2a2a2a]"
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Trading Sessions */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Trading Sessions</h3>
        
        {sessions.length === 0 ? (
          <Card className="p-6 bg-[#1a1a1a] border-[#333] text-center">
            <p className="text-gray-400">No trading sessions found. Start your first session above.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Card key={session.id} className="p-6 bg-[#1a1a1a] border-[#333]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">
                      Session {session.id.substring(0, 8)}...
                    </h4>
                    <p className="text-sm text-gray-400">
                      Started: {formatDate(session.startTime)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${getStatusColor(session.status)}`}>
                      {session.status.toUpperCase()}
                    </span>
                    
                    {session.status === 'running' && (
                      <Button 
                        onClick={() => handleStopTrading(session.id)}
                        disabled={isLoading}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Stop
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Total PnL</p>
                    <p className={`text-lg font-semibold ${session.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(session.totalPnL)}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400">Budget</p>
                    <p className="text-lg font-semibold text-white">
                      {formatCurrency(session.config.totalBudget)}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400">Goal</p>
                    <p className="text-lg font-semibold text-white">
                      {formatCurrency(session.config.profitGoal)}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400">Positions</p>
                    <p className="text-lg font-semibold text-white">
                      {session.positions}/{session.config.maxPositions}
                    </p>
                  </div>
                </div>

                {session.error && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-500 rounded">
                    <p className="text-red-400 text-sm">Error: {session.error}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
