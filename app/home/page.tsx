"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useIntegratedWallet } from "@/lib/wallet/IntegratedWalletContext"
import { useAuth } from "@/lib/auth/AuthContext"
import { useTrading } from "@/lib/hooks/useTrading"
import { useTradingProfits } from "@/lib/hooks/useTradingProfits"
import { useSuperAppEnvironment } from "@/lib/superapp/context"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function HomePage() {
  const { user, logout } = useAuth()
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const [targetProfit, setTargetProfit] = useState("10")
  const [investmentAmount, setInvestmentAmount] = useState("50")

  // SuperApp environment detection
  let isSuperApp = false;
  let hasUser = false;
  let ethereumAddress: string | null = null;
  let ethereumPrivateKey: string | null = null;
  let superAppLoading = false;
  let superAppError: string | null = null;

  try {
    const superAppEnv = useSuperAppEnvironment();
    isSuperApp = superAppEnv.isSuperApp;
    hasUser = superAppEnv.hasUser;
    ethereumAddress = superAppEnv.ethereumAddress || null;
    ethereumPrivateKey = superAppEnv.ethereumPrivateKey || null;
    superAppLoading = superAppEnv.isLoading;
    superAppError = superAppEnv.error;
  } catch (err) {
    // SuperApp not available, continue in standalone mode
    console.log('SuperApp not available, running in standalone mode');
  }

  const {
    isConnected,
    primaryWallet,
    allWallets,
    totalPortfolioValue,
    ethBalanceFormatted,
    holdings,
    dailyChange,
    dailyChangePercentage,
    isLoading,
    error,
    refreshWallets,
    createWallet,
    refreshBalances
  } = useIntegratedWallet()

  // Auto-create wallet if user doesn't have one
  useEffect(() => {
    if (user?.phoneNumber && !isConnected && !isLoading) {
      // User is logged in but doesn't have a wallet, create one automatically
      createWallet('ethereum')
    }
  }, [user?.phoneNumber, isConnected, isLoading, createWallet])

  // Check if trading is ready (wallet connected)
  const isTradingReady = isConnected && primaryWallet

  // Trading system integration
  const {
    isLoading: isTradingLoading,
    error: tradingError
  } = useTrading()

  // Trading profits integration
  const { totalProfits } = useTradingProfits()

  // Get real wallet holdings only when connected
  const realHoldings = isConnected ? [
    // Real ETH holding from wallet
    {
      token: {
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        price: 2500 // Mock price
      },
      balance: ethBalanceFormatted,
      valueUSD: totalPortfolioValue,
      color: '#627eea',
      link: "/detail/ethereum",
    },
    // Add other holdings from the wallet
    ...holdings.map(holding => ({
      token: holding.token,
      balance: holding.balanceFormatted,
      valueUSD: holding.valueUSD,
      color: holding.token.symbol === 'WBTC' ? '#f7931a' : '#f4b731',
      link: `/detail/${holding.token.symbol.toLowerCase()}`,
    }))
  ] : []

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0d0d0d] text-white relative">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-md mx-auto">
          <div className="w-16 h-16 bg-[#4A2C7C] rounded-2xl flex items-center justify-center shadow-lg">
            <Image src="/trading-bot-icon.svg" alt="Trading Bot" width={48} height={48} className="w-12 h-12" />
          </div>
          
          {/* User info and logout */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm text-[#b4b4b4]">{user?.phoneNumber}</p>
              <p className="text-xs text-[#666]">Welcome back!</p>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="bg-transparent border-[#444] text-[#e5e5e5] hover:bg-[#333] hover:text-white"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-4 sm:px-6 max-w-md mx-auto mb-6">
          <div className="flex space-x-2">
            <Link href="/home">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#1a1a1a] border-[#262626] text-[#e5e5e5] hover:bg-[#333] hover:text-white"
              >
                🏠 Home
              </Button>
            </Link>
            <Link href="/wallet">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#1a1a1a] border-[#262626] text-[#e5e5e5] hover:bg-[#333] hover:text-white"
              >
                💼 Wallets
              </Button>
            </Link>
            <Link href="/trading">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#1a1a1a] border-[#262626] text-[#e5e5e5] hover:bg-[#333] hover:text-white"
              >
                📈 Trading
              </Button>
            </Link>
            <Link href="/simulation">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#1a1a1a] border-[#262626] text-[#e5e5e5] hover:bg-[#333] hover:text-white"
              >
                🎮 Simulation
              </Button>
            </Link>
          </div>
        </div>

      <div className="px-4 sm:px-6 space-y-6 max-w-md mx-auto">
        {/* Portfolio Balance Card */}
        {!isConnected ? (
          <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl text-center">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-[#7c3aed] rounded-full flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg mb-2">Setting Up Your Wallet</h2>
                <p className="text-[#9ca3af] text-sm mb-4">
                  Creating your personal trading wallet...
                </p>
              </div>
              {isLoading && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-white">Creating wallet...</span>
                </div>
              )}
              {error && (
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 mt-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              <p className="text-[#6b7280] text-xs">
                Your wallet will be ready in a moment
              </p>
            </div>
          </Card>
        ) : (
          <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
            <div className="space-y-2">
              <h2 className="text-[#b4b4b4] text-sm font-medium">Total Portfolio Balance</h2>
              <div className="flex items-center space-x-3">
                <span className="text-3xl sm:text-4xl font-bold text-white">
                  {isBalanceVisible ? formatValue(totalPortfolioValue + totalProfits) : "••••••"}
                </span>
                <button
                  onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                  className="text-white hover:text-gray-300 transition-colors p-1"
                >
                  {isBalanceVisible ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                      <path d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z" stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                      <path
                        d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`text-sm sm:text-base font-medium ${dailyChange >= 0 ? 'text-[#27c47d]' : 'text-[#ef4444]'}`}>
                  {isBalanceVisible ? `${dailyChange >= 0 ? '+' : ''}${formatValue(dailyChange)} today` : `${dailyChange >= 0 ? '+' : ''}••••••• today`}
                </span>
                <div className="flex items-center space-x-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={dailyChange >= 0 ? 'text-[#27c47d]' : 'text-[#ef4444]'}>
                    <path d={dailyChange >= 0 ? "M6 2L10 8.5L17 8L10 9.5L12 15L8.5 9.5L3 8L8.5 8.5L12 2Z" : "M6 10L2 3.5L-5 4L2 2.5L0 -3L3.5 2.5L9 4L3.5 3.5L0 10Z"} fill="currentColor" />
                  </svg>
                  <span className={`text-sm sm:text-base font-medium ${dailyChange >= 0 ? 'text-[#27c47d]' : 'text-[#ef4444]'}`}>
                    {isBalanceVisible ? `${dailyChangePercentage >= 0 ? '+' : ''}${dailyChangePercentage.toFixed(2)}%` : `${dailyChangePercentage >= 0 ? '+' : ''}•••%`}
                  </span>
                </div>
              </div>
              <div className="text-xs text-[#9ca3af] mt-2">
                {isConnected ? 'Connected to wallet' : 'Wallet not connected'} • {isTradingLoading ? 'Trading system loading...' : 'Trading system ready'}
                {tradingError && (
                  <span className="ml-2 text-[#ef4444]">
                    • Trading error: {tradingError}
                  </span>
                )}
              </div>
              
              {/* Trading Profits Breakdown */}
              {totalProfits > 0 && (
                <div className="mt-3 p-3 bg-[#1f2937] border border-[#374151] rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9ca3af] text-sm">Trading Profits:</span>
                    <span className="text-[#27c47d] font-medium text-sm">+${totalProfits.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Start Trading Card - Show when wallet is connected */}
        {isConnected && primaryWallet && (
          <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#8759ff] rounded-lg flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg">Start Trading</h3>
              </div>
              
              <p className="text-[#9ca3af] text-sm">
                Your wallet is connected and ready for live trading on Hyperliquid. Configure your trading parameters and start your first session.
              </p>
              
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#9ca3af] text-xs font-medium mb-1">
                      Target Profit (USD)
                    </label>
                    <Input
                      type="number"
                      value={targetProfit}
                      onChange={(e) => setTargetProfit(e.target.value)}
                      className="bg-[#2a2a2a] border-[#444] text-white text-sm"
                      placeholder="20"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[#9ca3af] text-xs font-medium mb-1">
                      Investment Amount (USD)
                    </label>
                    <Input
                      type="number"
                      value={investmentAmount}
                      onChange={(e) => setInvestmentAmount(e.target.value)}
                      className="bg-[#2a2a2a] border-[#444] text-white text-sm"
                      placeholder="50"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Link href="/trading" className="flex-1">
                    <Button className="w-full bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold py-3 rounded-xl">
                      🚀 Open Trading Dashboard
                    </Button>
                  </Link>
                  
                  <Link href={`/chat?profit=${targetProfit}&investment=${investmentAmount}&mode=real&wallet=${primaryWallet?.address}${isSuperApp ? '&superapp=true' : ''}`}>
                    <Button className="bg-[#10b981] hover:bg-[#059669] text-white font-semibold py-3 px-6 rounded-xl">
                      💬 AI Chat
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9ca3af]">Trading Status:</span>
                  <span className="text-[#27c47d] font-medium">Ready to Trade</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-[#9ca3af]">Platform:</span>
                  <span className="text-white font-medium">Hyperliquid</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-[#9ca3af]">Wallet:</span>
                  <span className="text-white font-medium">{primaryWallet?.address.slice(0, 6)}...{primaryWallet?.address.slice(-4)}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Wallet Info Section - Show when connected */}
        {isConnected && primaryWallet && (
          <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-lg">Your Trading Wallet</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Connected</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af] text-sm">Wallet Address:</span>
                  <div className="flex items-center space-x-2">
                    <code className="text-white text-sm font-mono bg-[#374151] px-2 py-1 rounded">
                      {primaryWallet.address.slice(0, 6)}...{primaryWallet.address.slice(-4)}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(primaryWallet.address)}
                      className="text-[#7c3aed] hover:text-[#6d28d9] text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af] text-sm">Chain:</span>
                  <span className="text-white text-sm capitalize">{primaryWallet.chain}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af] text-sm">ETH Balance:</span>
                  <span className="text-white text-sm font-medium">{ethBalanceFormatted}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t border-[#374151]">
                <p className="text-[#9ca3af] text-xs">
                  Your wallet is automatically connected for trading. No manual setup required.
                </p>
              </div>
            </div>
          </Card>
        )}


        {/* AI Trading Goals */}
        <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center space-x-2">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#8759ff]">
                <path d="M10 1L11.5 6.5L17 8L11.5 9.5L10 15L8.5 9.5L3 8L8.5 6.5L10 1Z" fill="currentColor" />
                <path d="M15 3L15.5 4.5L17 5L15.5 5.5L15 7L14.5 5.5L13 5L14.5 4.5L15 3Z" fill="currentColor" />
              </svg>
              <h3 className="text-lg sm:text-xl font-bold text-white">AI Trading Goals</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-white font-medium text-sm sm:text-base">Target Profit</label>
                <div className="relative">
                  <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-[#b4b4b4] text-sm sm:text-base">
                    $
                  </span>
                  <Input
                    className="bg-[#262626] border-[#404040] text-white pl-7 sm:pl-8 pr-12 sm:pr-16 py-3 sm:py-4 rounded-2xl text-base sm:text-lg"
                    value={targetProfit}
                    onChange={(e) => setTargetProfit(e.target.value)}
                  />
                  <span className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-[#b4b4b4] text-sm sm:text-base">
                    USD
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white font-medium text-sm sm:text-base">Investment Amount</label>
                <div className="relative">
                  <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-[#b4b4b4] text-sm sm:text-base">
                    $
                  </span>
                  <Input
                    className="bg-[#262626] border-[#404040] text-white pl-7 sm:pl-8 pr-12 sm:pr-16 py-3 sm:py-4 rounded-2xl text-base sm:text-lg"
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(e.target.value)}
                  />
                  <span className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-[#b4b4b4] text-sm sm:text-base">
                    USD
                  </span>
                </div>
              </div>

            </div>
          </div>
        </Card>

        {/* Your Holdings - Only show when connected and has holdings */}
        {isConnected && realHoldings.length > 0 && (
          <div className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
            <div className="flex items-center justify-between px-1 sm:px-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">Your Holdings</h3>
            </div>

            <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8 px-0 sm:px-1">
              {realHoldings.map((holding, index) => (
                <Link key={index} href={holding.link}>
                  <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl hover:bg-[#1f1f1f] transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base"
                          style={{ backgroundColor: holding.color }}
                        >
                          {holding.token.symbol.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-white font-semibold text-base sm:text-lg">{holding.token.symbol}</h4>
                          <p className="text-[#9ca3af] text-sm">{holding.token.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold text-base sm:text-lg">{holding.balance}</p>
                        <p className="text-[#9ca3af] text-sm">{formatValue(holding.valueUSD)}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  )
}
