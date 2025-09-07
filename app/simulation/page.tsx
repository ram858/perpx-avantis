"use client";

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTrading } from "@/lib/hooks/useTrading";

export default function SimulationPage() {
  const [targetProfit, setTargetProfit] = useState("10");
  const [investmentAmount, setInvestmentAmount] = useState("50");
  const [isSimulationMode, setIsSimulationMode] = useState(true);

  const {
    tradingSession,
    startTrading,
    stopTrading,
    isConnected,
    error
  } = useTrading();

  const handleStartSimulation = async () => {
    const profit = parseFloat(targetProfit);
    const investment = parseFloat(investmentAmount);
    
    if (!profit || profit <= 0) {
      alert('Please enter a valid target profit amount');
      return;
    }
    
    if (!investment || investment <= 0) {
      alert('Please enter a valid investment amount');
      return;
    }
    
    try {
      await startTrading({
        profitGoal: profit,
        maxBudget: investment,
        maxPerSession: 5
      });
    } catch (err) {
      console.error('Error starting simulation:', err);
    }
  };

  const handleStopSimulation = async () => {
    if (tradingSession?.sessionId) {
      await stopTrading(tradingSession.sessionId);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">🎮 Trading Simulation</h1>
          <p className="text-[#b4b4b4]">Test the trading engine without real money</p>
        </div>

        {/* Status Card */}
        <Card className="bg-[#1a1a1a] border-[#262626] p-6 rounded-2xl">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Simulation Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#262626] p-4 rounded-lg">
                <div className="text-[#b4b4b4] text-sm">WebSocket Status</div>
                <div className={`text-lg font-semibold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? '✅ Connected' : '❌ Disconnected'}
                </div>
              </div>
              
              <div className="bg-[#262626] p-4 rounded-lg">
                <div className="text-[#b4b4b4] text-sm">Trading Status</div>
                <div className={`text-lg font-semibold ${
                  tradingSession?.status === 'running' ? 'text-green-400' :
                  tradingSession?.status === 'completed' ? 'text-blue-400' :
                  tradingSession?.status === 'error' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {tradingSession?.status || 'Not Started'}
                </div>
              </div>
              
              <div className="bg-[#262626] p-4 rounded-lg">
                <div className="text-[#b4b4b4] text-sm">Mode</div>
                <div className="text-lg font-semibold text-purple-400">
                  🎮 Simulation
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-lg">
                <div className="text-red-400 font-semibold">Error:</div>
                <div className="text-red-300">{error}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Trading Configuration */}
        <Card className="bg-[#1a1a1a] border-[#262626] p-6 rounded-2xl">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Trading Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-white font-medium">Target Profit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#b4b4b4]">$</span>
                  <Input
                    className="bg-[#262626] border-[#404040] text-white pl-8 pr-12 py-3 rounded-lg"
                    value={targetProfit}
                    onChange={(e) => setTargetProfit(e.target.value)}
                    placeholder="10"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#b4b4b4]">USD</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white font-medium">Investment Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#b4b4b4]">$</span>
                  <Input
                    className="bg-[#262626] border-[#404040] text-white pl-8 pr-12 py-3 rounded-lg"
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(e.target.value)}
                    placeholder="50"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#b4b4b4]">USD</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <Button
                onClick={handleStartSimulation}
                disabled={tradingSession?.status === 'running'}
                className="bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold py-3 px-6 rounded-lg"
              >
                {tradingSession?.status === 'running' ? 'Simulation Running...' : '🎮 Start Simulation'}
              </Button>
              
              {tradingSession?.status === 'running' && (
                <Button
                  onClick={handleStopSimulation}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg"
                >
                  Stop Simulation
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Live Trading Data */}
        {tradingSession && (
          <Card className="bg-[#1a1a1a] border-[#262626] p-6 rounded-2xl">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">Live Trading Data</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#262626] p-4 rounded-lg">
                  <div className="text-[#b4b4b4] text-sm">Session ID</div>
                  <div className="text-white font-mono text-sm">{tradingSession.sessionId}</div>
                </div>
                
                <div className="bg-[#262626] p-4 rounded-lg">
                  <div className="text-[#b4b4b4] text-sm">Current PnL</div>
                  <div className={`text-lg font-semibold ${
                    tradingSession.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    ${tradingSession.pnl.toFixed(2)}
                  </div>
                </div>
                
                <div className="bg-[#262626] p-4 rounded-lg">
                  <div className="text-[#b4b4b4] text-sm">Open Positions</div>
                  <div className="text-white text-lg font-semibold">{tradingSession.openPositions}</div>
                </div>
                
                <div className="bg-[#262626] p-4 rounded-lg">
                  <div className="text-[#b4b4b4] text-sm">Cycle</div>
                  <div className="text-white text-lg font-semibold">{tradingSession.cycle}</div>
                </div>
              </div>

              <div className="bg-[#262626] p-4 rounded-lg">
                <div className="text-[#b4b4b4] text-sm">Last Update</div>
                <div className="text-white">{new Date(tradingSession.lastUpdate).toLocaleString()}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-[#1a1a1a] border-[#262626] p-6 rounded-2xl">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">How to Test</h2>
            
            <div className="space-y-3 text-[#b4b4b4]">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#8759ff] rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
                <div>Set your target profit and investment amount above</div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#8759ff] rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
                <div>Click "Start Simulation" to begin the trading simulation</div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#8759ff] rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
                <div>Watch the live trading data update in real-time</div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#8759ff] rounded-full flex items-center justify-center text-white text-sm font-bold">4</div>
                <div>The simulation will automatically stop when profit goal is reached or losses exceed 80% of budget</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
