"use client";

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTrading } from "@/lib/hooks/useTrading";
import { useWallet } from "@/lib/wallet/WalletContext";
import Link from "next/link";

export default function TradingPage() {
  const [targetProfit, setTargetProfit] = useState("10");
  const [investmentAmount, setInvestmentAmount] = useState("50");
  const [isRealTradingMode, setIsRealTradingMode] = useState(false);
  const [envStatus, setEnvStatus] = useState<{
    hasPrivateKey: boolean;
    isTestMode: boolean;
    message: string;
  }>({ hasPrivateKey: false, isTestMode: true, message: "Checking environment..." });

  const {
    tradingSession,
    startTrading,
    stopTrading,
    isConnected,
    error
  } = useTrading();

  const {
    isConnected: walletConnected,
    totalPortfolioValue
  } = useWallet();

  // Check environment configuration
  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        // Check if we have a real private key configured
        const hasRealKey = process.env.NEXT_PUBLIC_HYPERLIQUID_PK && 
                          process.env.NEXT_PUBLIC_HYPERLIQUID_PK !== '0x_your_private_key_here' &&
                          process.env.NEXT_PUBLIC_HYPERLIQUID_PK !== '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        
        setEnvStatus({
          hasPrivateKey: hasRealKey,
          isTestMode: !hasRealKey,
          message: hasRealKey ? "Real trading environment detected" : "Test mode - using simulation"
        });
        
        setIsRealTradingMode(hasRealKey && walletConnected && totalPortfolioValue > 0);
      } catch (error) {
        setEnvStatus({
          hasPrivateKey: false,
          isTestMode: true,
          message: "Unable to check environment status"
        });
      }
    };

    checkEnvironment();
  }, [walletConnected, totalPortfolioValue]);

  const handleStartTrading = async () => {
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

    // Check wallet requirements for real trading
    if (isRealTradingMode) {
      if (!walletConnected) {
        alert('Please connect your wallet first to start real trading');
        return;
      }
      
      if (totalPortfolioValue === 0) {
        alert('Your wallet balance is $0. Please add funds to your wallet before starting trading.');
        return;
      }
    }
    
    try {
      await startTrading({
        profitGoal: profit,
        maxBudget: investment,
        maxPerSession: 5
      });
    } catch (err) {
      console.error('Error starting trading:', err);
    }
  };

  const handleStopTrading = async () => {
    if (tradingSession?.sessionId) {
      await stopTrading(tradingSession.sessionId);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">
            {isRealTradingMode ? "💰 Real Trading" : "🎮 Trading Simulation"}
          </h1>
          <p className="text-[#b4b4b4]">
            {isRealTradingMode 
              ? "Trade with real money on Hyperliquid" 
              : "Test the trading engine without real money"
            }
          </p>
        </div>

        {/* Environment Status */}
        <Card className="bg-[#1a1a1a] border-[#262626] p-6 rounded-2xl">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Environment Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#262626] p-4 rounded-lg">
                <div className="text-[#b4b4b4] text-sm">Trading Mode</div>
                <div className={`text-lg font-semibold ${
                  isRealTradingMode ? 'text-green-400' : 'text-purple-400'
                }`}>
                  {isRealTradingMode ? '💰 Real Trading' : '🎮 Simulation'}
                </div>
              </div>
              
              <div className="bg-[#262626] p-4 rounded-lg">
                <div className="text-[#b4b4b4] text-sm">Wallet Status</div>
                <div className={`text-lg font-semibold ${
                  walletConnected ? 'text-green-400' : 'text-red-400'
                }`}>
                  {walletConnected ? '✅ Connected' : '❌ Not Connected'}
                </div>
              </div>
              
              <div className="bg-[#262626] p-4 rounded-lg">
                <div className="text-[#b4b4b4] text-sm">Balance</div>
                <div className="text-lg font-semibold text-white">
                  ${totalPortfolioValue.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="bg-[#262626] p-4 rounded-lg">
              <div className="text-[#b4b4b4] text-sm">Environment Message</div>
              <div className="text-white">{envStatus.message}</div>
            </div>

            {!envStatus.hasPrivateKey && (
              <div className="bg-yellow-900/20 border border-yellow-500/50 p-4 rounded-lg">
                <div className="text-yellow-400 font-semibold">⚠️ Setup Required for Real Trading</div>
                <div className="text-yellow-300 mt-2">
                  To enable real trading, you need to:
                </div>
                <ul className="text-yellow-300 mt-2 ml-4 list-disc">
                  <li>Create a <code className="bg-yellow-800/50 px-1 rounded">.env.local</code> file</li>
                  <li>Add your Hyperliquid private key: <code className="bg-yellow-800/50 px-1 rounded">HYPERLIQUID_PK=0x_your_key</code></li>
                  <li>Connect your wallet with funds</li>
                </ul>
                <div className="mt-3">
                  <Link href="/simulation" className="text-blue-400 hover:text-blue-300 underline">
                    Or try simulation mode instead →
                  </Link>
                </div>
              </div>
            )}

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
                onClick={handleStartTrading}
                disabled={tradingSession?.status === 'running'}
                className={`font-semibold py-3 px-6 rounded-lg ${
                  isRealTradingMode 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-[#8759ff] hover:bg-[#7C3AED] text-white'
                }`}
              >
                {tradingSession?.status === 'running' 
                  ? (isRealTradingMode ? 'Real Trading Running...' : 'Simulation Running...')
                  : (isRealTradingMode ? '💰 Start Real Trading' : '🎮 Start Simulation')
                }
              </Button>
              
              {tradingSession?.status === 'running' && (
                <Button
                  onClick={handleStopTrading}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg"
                >
                  Stop Trading
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
            <h2 className="text-xl font-bold text-white">
              {isRealTradingMode ? "Real Trading Instructions" : "Simulation Instructions"}
            </h2>
            
            <div className="space-y-3 text-[#b4b4b4]">
              {isRealTradingMode ? (
                <>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
                    <div>Make sure your wallet is connected and has sufficient funds</div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
                    <div>Set your target profit and investment amount above</div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
                    <div>Click "Start Real Trading" to begin trading with real money</div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">4</div>
                    <div>Monitor your trades and PnL in real-time</div>
                  </div>
                  
                  <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-lg mt-4">
                    <div className="text-red-400 font-semibold">⚠️ Warning</div>
                    <div className="text-red-300 text-sm">
                      Real trading involves actual money. Make sure you understand the risks before proceeding.
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
