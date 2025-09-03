"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import type { JSX } from "react/jsx-runtime"

interface CoinData {
  name: string
  symbol: string
  price: string
  change: string
  changeColor: string
  icon: JSX.Element
  marketCap?: string
  volume24h?: string
  supply?: string
}

interface CoinDataMap {
  [key: string]: CoinData
}

const coinData: CoinDataMap = {
  bitcoin: {
    name: "Bitcoin",
    symbol: "BTC",
    price: "$24,634.06",
    change: "+ $248.23 (+0.35)",
    changeColor: "text-[#27c47d]",
    marketCap: "$481.2B",
    volume24h: "$12.4B",
    supply: "19.8M BTC",
    icon: (
      <div
        className="w-12 h-12 bg-[#f7931a] rounded-full flex items-center justify-center"
        role="img"
        aria-label="Bitcoin"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
          <path
            d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM13.5 8H11V6H13.5C14.33 6 15 6.67 15 7.5S14.33 9 13.5 9H11V11H13.5C14.33 11 15 11.67 15 12.5S14.33 14 13.5 14H11V16H9V14H8V12H9V10H8V8H9V6H11V8H13.5Z"
            fill="currentColor"
          />
        </svg>
      </div>
    ),
  },
  ethereum: {
    name: "Ethereum",
    symbol: "ETH",
    price: "$2,156.90",
    change: "+ $48.23 (+2.28)",
    changeColor: "text-[#27c47d]",
    marketCap: "$259.1B",
    volume24h: "$8.2B",
    supply: "120.4M ETH",
    icon: (
      <div
        className="w-12 h-12 bg-[#627eea] rounded-full flex items-center justify-center"
        role="img"
        aria-label="Ethereum"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
          <path d="M12 2L5.5 12.5L12 16L18.5 12.5L12 2Z" fill="currentColor" />
          <path d="M12 17L5.5 13L12 22L18.5 13L12 17Z" fill="currentColor" />
        </svg>
      </div>
    ),
  },
  dai: {
    name: "DAI",
    symbol: "DAI",
    price: "$1.00",
    change: "+ $0.002 (+0.2)",
    changeColor: "text-[#27c47d]",
    marketCap: "$5.3B",
    volume24h: "$156.2M",
    supply: "5.3B DAI",
    icon: (
      <div className="w-12 h-12 bg-[#f4b731] rounded-full flex items-center justify-center" role="img" aria-label="DAI">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="M8 12H16M10 8H14M10 16H14" stroke="#f4b731" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
  },
}

export default function DetailPage() {
  const params = useParams()
  const coin = params.coin as string
  const [activeTab, setActiveTab] = useState<"position" | "tradeHistory">("tradeHistory")
  const [selectedPeriod, setSelectedPeriod] = useState("1D")
  const [isLoading, setIsLoading] = useState(true)

  const currentCoin = coinData[coin as keyof typeof coinData]

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#8759ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#b4b4b4]">Loading {coin} details...</p>
        </div>
      </div>
    )
  }

  if (!currentCoin) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold mb-4">Cryptocurrency Not Found</h1>
          <p className="text-[#b4b4b4] mb-6">
            The requested cryptocurrency "{coin}" could not be found in our database.
          </p>
          <Link href="/home">
            <Button className="bg-[#8759ff] hover:bg-[#7C3AED] text-white">Return to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  const periods = ["1H", "1D", "1W", "1M", "6M", "1Y", "ALL"]

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-md mx-auto px-4 sm:px-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between py-4">
          <Link href="/home" aria-label="Go back to home">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden="true">
              <path
                d="M19 12H5M12 19L5 12L12 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">Detail</h1>
          <div className="w-6" aria-hidden="true"></div>
        </header>

        <section aria-labelledby="coin-info">
          <div className="flex items-center space-x-4">
            {currentCoin.icon}
            <div>
              <h2 id="coin-info" className="text-2xl font-bold text-white">
                {currentCoin.name}
              </h2>
              <p className="text-[#b4b4b4] text-sm">({currentCoin.symbol})</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="price-info">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 id="price-info" className="text-3xl font-bold text-white">
                {currentCoin.price}
              </h3>
              <p className={`text-lg ${currentCoin.changeColor}`} aria-label={`Price change: ${currentCoin.change}`}>
                {currentCoin.change}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[#b4b4b4]">Market Cap</p>
                <p className="text-white font-semibold">{currentCoin.marketCap}</p>
              </div>
              <div>
                <p className="text-[#b4b4b4]">24h Volume</p>
                <p className="text-white font-semibold">{currentCoin.volume24h}</p>
              </div>
              <div>
                <p className="text-[#b4b4b4]">Supply</p>
                <p className="text-white font-semibold">{currentCoin.supply}</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="price-chart">
          <h3 id="price-chart" className="sr-only">
            Price Chart
          </h3>
          <div
            className="bg-[#1a1a1a] rounded-2xl p-4 h-56 relative overflow-hidden"
            role="img"
            aria-label="Price chart showing recent trading activity"
          >
            <svg width="100%" height="100%" className="absolute inset-4" viewBox="0 0 360 160" aria-hidden="true">
              <defs>
                <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#262626" strokeWidth="0.5" />
                </pattern>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#27c47d" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#27c47d" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              <path d="M 0 100 Q 60 60 120 80 T 240 70 Q 300 50 360 100" fill="none" stroke="#27c47d" strokeWidth="2" />
              <path d="M 0 100 Q 60 60 120 80 T 240 70 Q 300 50 360 100 L 360 160 L 0 160 Z" fill="url(#gradient)" />
            </svg>

            <div
              className="absolute left-0 top-4 h-[calc(100%-2rem)] flex flex-col justify-between text-xs text-[#696969] py-2"
              aria-label="Price scale"
            >
              <span>44.1</span>
              <span>44.0</span>
              <span>43.9</span>
              <span>43.8</span>
            </div>

            <div
              className="absolute bottom-0 left-8 right-4 flex justify-between text-xs text-[#696969] pb-1"
              aria-label="Time scale"
            >
              <span>18:40</span>
              <span>22:31</span>
              <span>02:21</span>
              <span>06:12</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="time-periods">
          <h3 id="time-periods" className="sr-only">
            Time Period Selection
          </h3>
          <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label="Select time period for chart">
            {periods.map((period) => (
              <Button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? "bg-[#8759ff] text-white"
                    : "bg-transparent text-[#b4b4b4] hover:text-white"
                }`}
                aria-pressed={selectedPeriod === period}
                aria-label={`Select ${period} time period`}
              >
                {period}
              </Button>
            ))}
          </div>
        </section>

        <nav role="tablist" aria-label="Trading information tabs">
          <div className="flex space-x-8 border-b border-[#262626]">
            <button
              role="tab"
              aria-selected={activeTab === "position"}
              aria-controls="position-panel"
              id="position-tab"
              onClick={() => setActiveTab("position")}
              className={`pb-3 text-lg font-medium transition-colors ${
                activeTab === "position"
                  ? "text-[#8759ff] border-b-2 border-[#8759ff]"
                  : "text-[#b4b4b4] hover:text-white"
              }`}
            >
              Position
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "tradeHistory"}
              aria-controls="tradeHistory-panel"
              id="tradeHistory-tab"
              onClick={() => setActiveTab("tradeHistory")}
              className={`pb-3 text-lg font-medium transition-colors ${
                activeTab === "tradeHistory"
                  ? "text-[#8759ff] border-b-2 border-[#8759ff]"
                  : "text-[#b4b4b4] hover:text-white"
              }`}
            >
              Trade History
            </button>
          </div>
        </nav>

        {/* Tab Content */}
        <div className="space-y-4 pb-8">
          {activeTab === "tradeHistory" && (
            <div role="tabpanel" id="tradeHistory-panel" aria-labelledby="tradeHistory-tab">
              <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {currentCoin.icon}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="text-white font-semibold text-sm sm:text-base">BTC/USDC</span>
                        <span className="bg-red-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">SELL</span>
                      </div>
                      <p className="text-[#b4b4b4] text-xs sm:text-sm">50x Leverage</p>
                    </div>
                  </div>
                  <span className="bg-[#27c47d] text-white px-3 py-1 rounded-full text-sm whitespace-nowrap self-start sm:self-auto">
                    Open
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div>
                    <p className="text-[#b4b4b4]">PnL</p>
                    <p className="text-[#27c47d] font-semibold">+70%</p>
                    <p className="text-[#27c47d]">+23.34 USDC</p>
                  </div>
                  <div>
                    <p className="text-[#b4b4b4]">Position Size</p>
                    <p className="text-white font-semibold">2,450.11 USDC</p>
                  </div>
                  <div>
                    <p className="text-[#b4b4b4]">Collateral</p>
                    <p className="text-white">550 USDC</p>
                  </div>
                  <div>
                    <p className="text-[#b4b4b4]">Entry Price</p>
                    <p className="text-white">116,651.66</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[#b4b4b4]">Fees</p>
                    <p className="text-white">0.12 USDC</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "position" && (
            <div role="tabpanel" id="position-panel" aria-labelledby="position-tab">
              <div className="space-y-4">
                <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {currentCoin.icon}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="text-white font-semibold text-sm sm:text-base">BTC/USDC</span>
                          <span className="bg-red-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                            SELL
                          </span>
                        </div>
                        <p className="text-[#b4b4b4] text-xs sm:text-sm">{currentCoin.name} 50x Leverage</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#b4b4b4]">Position Size</span>
                      <span className="text-white font-semibold">2,450.11 USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#b4b4b4]">Collateral</span>
                      <span className="text-white">50 USDC</span>
                    </div>
                    <hr className="border-[#262626]" />
                    <div className="flex justify-between">
                      <span className="text-[#b4b4b4]">Entry Price</span>
                      <span className="text-white">$116,651.66</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#b4b4b4]">Liquidation Price</span>
                      <span className="text-red-500">$118,690.49</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#b4b4b4]">Stop Loss</span>
                      <span className="text-white">-</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#b4b4b4]">Take Profit</span>
                      <span className="text-[#27c47d]">$95,654.36</span>
                    </div>
                  </div>
                </Card>

                <Card className="bg-red-900/20 border-red-600/30 p-6 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Unrealized PnL</span>
                    <div className="text-right">
                      <p className="text-red-500 font-bold text-xl">-45%</p>
                      <p className="text-red-500">-12.34 USDC</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
