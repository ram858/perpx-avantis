"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useWallet } from "@/lib/wallet/WalletContext"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

export default function HomePage() {
  const [isHoldingsExpanded, setIsHoldingsExpanded] = useState(false)
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const [targetProfit, setTargetProfit] = useState("10")
  const [investmentAmount, setInvestmentAmount] = useState("50")

    const {
    isConnected,
    totalPortfolioValue,
    ethBalanceFormatted,
    holdings,
    isLoading,
    error,
    connectWallet
  } = useWallet()

  // Mock holdings data (will be replaced with real wallet data when connected)
  const mockHoldings = [
    {
      name: "Bitcoin",
      symbol: "BTC",
      amount: "0.5432",
      value: "$27,156.90",
      change: "+5.2%",
      color: "#f7931a",
      link: "/detail/bitcoin",
    },
    {
      name: "Ethereum",
      symbol: "ETH",
      amount: "3.2145",
      value: "$6,429.00",
      change: "+2.8%",
      color: "#627eea",
      link: "/detail/ethereum",
    },
    {
      name: "DAI",
      symbol: "DAI",
      amount: "0.5432",
      value: "$7,156.90",
      change: "+0.2%",
      color: "#f4b731",
      link: "/detail/dai",
    },
    {
      name: "Chainlink",
      symbol: "LINK",
      amount: "125.45",
      value: "$2,890.50",
      change: "+1.8%",
      color: "#375bd2",
      link: "/detail/chainlink",
    },
    {
      name: "Polygon",
      symbol: "MATIC",
      amount: "1,250.00",
      value: "$1,125.00",
      change: "-0.5%",
      color: "#8247e5",
      link: "/detail/polygon",
    },
    {
      name: "Solana",
      symbol: "SOL",
      amount: "15.75",
      value: "$3,465.75",
      change: "+3.1%",
      color: "#00d4aa",
      link: "/detail/solana",
    },
    {
      name: "Cardano",
      symbol: "ADA",
      amount: "2,500.00",
      value: "$1,200.00",
      change: "+0.8%",
      color: "#0033ad",
      link: "/detail/cardano",
    },
    {
      name: "Polkadot",
      symbol: "DOT",
      amount: "85.25",
      value: "$892.13",
      change: "-1.2%",
      color: "#e6007a",
      link: "/detail/polkadot",
    },
    {
      name: "Avalanche",
      symbol: "AVAX",
      amount: "45.80",
      value: "$1,647.60",
      change: "+2.5%",
      color: "#e84142",
      link: "/detail/avalanche",
    },
    {
      name: "Uniswap",
      symbol: "UNI",
      amount: "180.50",
      value: "$1,264.50",
      change: "+1.1%",
      color: "#ff007a",
      link: "/detail/uniswap",
    },
  ]

  // Get real wallet holdings only when connected
  const realHoldings = isConnected ? [
    // Real ETH holding from wallet
    {
      name: "Ethereum",
      symbol: "ETH",
      amount: parseFloat(ethBalanceFormatted).toFixed(4),
      value: `$${(parseFloat(ethBalanceFormatted) * 2000).toFixed(2)}`,
      change: "+2.8%",
      color: "#627eea",
      link: "/detail/ethereum",
    },
    // Real token holdings from wallet
    ...holdings.map(holding => ({
      name: holding.token.name,
      symbol: holding.token.symbol,
      amount: parseFloat(holding.balanceFormatted).toFixed(4),
      value: `$${holding.valueUSD.toFixed(2)}`,
      change: "+0.2%", // Mock change for now
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
    <div className="min-h-screen bg-[#0d0d0d] text-white relative">
      {/* Header */}
      <div className="flex items-center justify-center px-4 sm:px-6 py-4 max-w-md mx-auto">
        <div className="w-16 h-16 bg-[#4A2C7C] rounded-2xl flex items-center justify-center shadow-lg">
          <Image src="/trading-bot-icon.svg" alt="Trading Bot" width={48} height={48} className="w-12 h-12" />
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
                <h2 className="text-white font-semibold text-lg mb-2">Connect Your Wallet</h2>
                <p className="text-[#9ca3af] text-sm mb-4">
                  Connect your MetaMask wallet to view your real portfolio and start trading
                </p>
              </div>
              <button
                onClick={connectWallet}
                disabled={isLoading}
                className="w-full bg-[#7c3aed] hover:bg-[#8b5cf6] disabled:bg-[#4b5563] disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{isLoading ? "Connecting..." : "Connect MetaMask"}</span>
              </button>
              {error && (
                <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 mt-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              <p className="text-[#6b7280] text-xs">
                By connecting, you agree to our Terms of Service
              </p>
            </div>
          </Card>
        ) : (
          <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
            <div className="space-y-2">
              <h2 className="text-[#b4b4b4] text-sm font-medium">Total Portfolio Balance</h2>
              <div className="flex items-center space-x-3">
                <span className="text-3xl sm:text-4xl font-bold text-white">
                  {isBalanceVisible ? formatValue(totalPortfolioValue) : "••••••"}
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
                <span className="text-[#27c47d] text-sm sm:text-base font-medium">
                  {isBalanceVisible ? "+$1,234.56 today" : "+••••••• today"}
                </span>
                <div className="flex items-center space-x-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#27c47d]">
                    <path d="M6 2L10 8.5L17 8L10 9.5L12 15L8.5 9.5L3 8L8.5 8.5L12 2Z" fill="currentColor" />
                  </svg>
                  <span className="text-[#27c47d] text-sm sm:text-base font-medium">
                    {isBalanceVisible ? "3.28%" : "•••%"}
                  </span>
                </div>
              </div>
              <div className="text-xs text-[#9ca3af] mt-2">
                Connected to wallet • Real-time data
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

              {!isConnected ? (
                <div className="space-y-3">
                  <Link href={`/chat?profit=${targetProfit}&investment=${investmentAmount}&mode=simulation`}>
                    <Button className="w-full bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold py-3 sm:py-4 rounded-2xl text-base sm:text-lg">
                      🎮 Start Simulation
                    </Button>
                  </Link>
                  <Link href="/simulation">
                    <Button className="w-full bg-[#374151] hover:bg-[#4b5563] text-white font-semibold py-3 sm:py-4 rounded-2xl text-base sm:text-lg">
                      🧪 Test Trading Engine
                    </Button>
                  </Link>
                </div>
              ) : totalPortfolioValue === 0 ? (
                <div className="space-y-3">
                  <Link href={`/chat?profit=${targetProfit}&investment=${investmentAmount}&mode=simulation`}>
                    <Button className="w-full bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold py-3 sm:py-4 rounded-2xl text-base sm:text-lg">
                      🎮 Start Simulation
                    </Button>
                  </Link>
                  <Link href="/simulation">
                    <Button className="w-full bg-[#374151] hover:bg-[#4b5563] text-white font-semibold py-3 sm:py-4 rounded-2xl text-base sm:text-lg">
                      🧪 Test Trading Engine
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link href={`/chat?profit=${targetProfit}&investment=${investmentAmount}&mode=real`}>
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 sm:py-4 rounded-2xl text-base sm:text-lg">
                      💰 Start Real Trading
                    </Button>
                  </Link>
                  <Link href={`/chat?profit=${targetProfit}&investment=${investmentAmount}&mode=simulation`}>
                    <Button className="w-full bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold py-3 sm:py-4 rounded-2xl text-base sm:text-lg">
                      🎮 Start Simulation
                    </Button>
                  </Link>
                  <Link href="/trading">
                    <Button className="w-full bg-[#374151] hover:bg-[#4b5563] text-white font-semibold py-3 sm:py-4 rounded-2xl text-base sm:text-lg">
                      ⚙️ Trading Settings
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Your Holdings - Only show when connected */}
        {isConnected && realHoldings.length > 0 && (
          <div className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
            <div className="flex items-center justify-between px-1 sm:px-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">Your Holdings</h3>
              {realHoldings.length > 3 && (
                <button
                  onClick={() => setIsHoldingsExpanded(true)}
                  className="text-[#27c47d] font-medium hover:text-[#22c55e] transition-colors"
                >
                  See All
                </button>
              )}
            </div>

            <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8 px-0 sm:px-1">
              {realHoldings.slice(0, 3).map((holding, index) => (
                <Link key={index} href={holding.link}>
                  <div className="flex items-center justify-between p-4 sm:p-5 bg-[#1a1a1a] rounded-2xl hover:bg-[#202020] transition-colors cursor-pointer mb-4">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: holding.color }}
                      >
                        <span className="text-white font-bold text-sm sm:text-base">{holding.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-base sm:text-lg">{holding.name}</h4>
                        <p className="text-[#b4b4b4] text-sm sm:text-base">
                          {holding.amount} {holding.symbol}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold text-base sm:text-lg">{holding.value}</p>
                      <p
                        className={`text-sm sm:text-base ${holding.change.startsWith("+") ? "text-[#27c47d]" : "text-[#ef4444]"}`}
                      >
                        {holding.change}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when connected but no holdings */}
        {isConnected && realHoldings.length === 0 && (
          <div className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
            <div className="flex items-center justify-between px-1 sm:px-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">Your Holdings</h3>
            </div>
            <Card className="bg-[#1a1a1a] border-[#262626] p-8 rounded-2xl text-center">
              <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-[#9ca3af]">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h4 className="text-white font-semibold text-lg mb-2">No Holdings Found</h4>
              <p className="text-[#9ca3af] text-sm">
                Your wallet doesn't have any supported tokens yet. Add some ETH or supported tokens to see them here.
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* Expandable Holdings Overlay */}
      {isHoldingsExpanded && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end">
          <div className="w-full max-w-md mx-auto bg-[#0d0d0d] rounded-t-3xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#262626] bg-[#0d0d0d] rounded-t-3xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white">All Holdings</h2>
              <button
                onClick={() => setIsHoldingsExpanded(false)}
                className="text-white hover:text-gray-300 transition-colors p-2"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto momentum-scroll p-4 sm:p-6">
              <div className="space-y-5 sm:space-y-6">
                {realHoldings.map((holding, index) => (
                  <Link key={index} href={holding.link}>
                    <div className="flex items-center justify-between p-4 sm:p-5 bg-[#1a1a1a] rounded-2xl hover:bg-[#202020] transition-colors cursor-pointer mb-4">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: holding.color }}
                        >
                          <span className="text-white font-bold text-sm sm:text-base">
                            {holding.symbol.slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold text-base sm:text-lg">{holding.name}</h4>
                          <p className="text-[#b4b4b4] text-sm sm:text-base">
                            {holding.amount} {holding.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold text-base sm:text-lg">{holding.value}</p>
                        <p
                          className={`text-sm sm:text-base ${holding.change.startsWith("+") ? "text-[#27c47d]" : "text-[#ef4444]"}`}
                        >
                          {holding.change}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
