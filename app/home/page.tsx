"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useIntegratedWallet } from "@/lib/wallet/IntegratedWalletContext"
import { useAuth } from "@/lib/auth/AuthContext"
import { useTrading } from "@/lib/hooks/useTrading"
import { useTradingProfits } from "@/lib/hooks/useTradingProfits"
import { usePositions } from "@/lib/hooks/usePositions"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useState, useEffect, useMemo, useCallback } from "react"
import { NavigationHeader } from "@/components/NavigationHeader"
import Link from "next/link"
import { useRouter } from "next/navigation"

// Memoized components for better performance
const WalletSetupCard = ({ isLoading, error, onRetry }: { isLoading: boolean; error: string | null; onRetry?: () => void }) => (
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
          {error ? 'Failed to create wallet' : 'Creating your personal trading wallet...'}
        </p>
      </div>
      {isLoading && (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="text-white">Creating wallet...</span>
        </div>
      )}
      {error && (
        <div className="space-y-3">
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {!error && !isLoading && (
        <p className="text-[#6b7280] text-xs">
          Your wallet will be ready in a moment
        </p>
      )}
    </div>
  </Card>
)

const PortfolioBalanceCard = ({ 
  totalPortfolioValue, 
  totalProfits, 
  dailyChange, 
  dailyChangePercentage, 
  isBalanceVisible, 
  setIsBalanceVisible,
  isConnected,
  isTradingLoading,
  tradingError
}: {
  totalPortfolioValue: number
  totalProfits: number
  dailyChange: number
  dailyChangePercentage: number
  isBalanceVisible: boolean
  setIsBalanceVisible: (visible: boolean) => void
  isConnected: boolean
  isTradingLoading: boolean
  tradingError: string | null
}) => {
  const formatValue = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }, [])

  const toggleBalance = useCallback(() => setIsBalanceVisible(!isBalanceVisible), [isBalanceVisible, setIsBalanceVisible])

  return (
    <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
      <div className="space-y-2">
        <h2 className="text-[#b4b4b4] text-sm font-medium">Total Portfolio Balance</h2>
        <div className="flex items-center space-x-3">
          <span className="text-3xl sm:text-4xl font-bold text-white">
            {isBalanceVisible ? formatValue(totalPortfolioValue + totalProfits) : "••••••"}
          </span>
          <button
            onClick={toggleBalance}
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
  )
}

const TradingCard = ({ 
  targetProfit, 
  setTargetProfit, 
  investmentAmount,
  setInvestmentAmount, 
  primaryWallet, 
  avantisBalance 
}: {
  targetProfit: string
  setTargetProfit: (value: string) => void
  investmentAmount: string
  setInvestmentAmount: (value: string) => void
  primaryWallet: { address: string; privateKey?: string; chain: string } | null
  avantisBalance: number
}) => {
  const [isTrading, setIsTrading] = useState(false)
  const { positionData, isLoading: positionsLoading } = usePositions()

  const router = useRouter()

  // Check if there are active positions
  const hasActivePositions = positionData && positionData.openPositions > 0

  const handleStartTrading = async () => {
    // Redirect to chat page with trading parameters
    const params = new URLSearchParams({
      profit: targetProfit,
      investment: investmentAmount,
      mode: 'real' // Use real trading mode
    })
    
    router.push(`/chat?${params.toString()}`)
  }

  const handleViewTrades = async () => {
    // Redirect to chat page to view ongoing trades
    const params = new URLSearchParams({
      mode: 'real',
      view: 'positions' // Add a parameter to indicate we're viewing positions
    })
    
    router.push(`/chat?${params.toString()}`)
  }


  return (
    <div className="space-y-4">
      {/* Start Trading Card */}
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
        Your wallet is connected and ready for live trading on Avantis. Configure your trading parameters and start your first session.
      </p>
      
        <div className="space-y-3">
        {/* Only show input fields when no active positions */}
        {!hasActivePositions && (
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
        )}
        
        {/* Show active positions info when positions exist */}
        {hasActivePositions && (
          <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-medium">Active Positions</h3>
              <span className="text-[#27c47d] text-sm font-medium">
                {positionData.openPositions} position{positionData.openPositions !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9ca3af] text-sm">Total PnL:</span>
              <span className={`font-medium ${positionData.totalPnL >= 0 ? 'text-[#27c47d]' : 'text-[#ef4444]'}`}>
                ${positionData.totalPnL.toFixed(2)}
              </span>
            </div>
          </div>
        )}
        
        <Button 
          onClick={hasActivePositions ? handleViewTrades : handleStartTrading}
          disabled={isTrading || avantisBalance === 0 || positionsLoading}
          className="w-full bg-[#8759ff] hover:bg-[#7C3AED] text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {isTrading ? '🔄 Starting...' : hasActivePositions ? '👁️ View Trades' : '🚀 Start Trading'}
        </Button>
        
        {/* Show helpful message when no funds */}
        {avantisBalance === 0 && (
          <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500 rounded-xl">
            <h4 className="text-yellow-400 font-semibold mb-2">💰 Add Funds to Start Trading</h4>
            <p className="text-yellow-300 text-sm mb-3">
              Your trading balance is $0.00. Add funds to your wallet to start trading.
            </p>
            <Button
                  onClick={() => {
                    const isTestnet = process.env.NEXT_PUBLIC_AVANTIS_NETWORK === 'base-testnet';
                    const url = isTestnet ? 'https://testnet.avantis.finance' : 'https://avantis.finance';
                    window.open(url, '_blank');
                  }}
              className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm"
            >
                  🚀 Add Funds ({process.env.NEXT_PUBLIC_AVANTIS_NETWORK === 'base-testnet' ? 'Testnet' : 'Mainnet'})
            </Button>
          </div>
        )}
        
            {/* Trading Status */}
        <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9ca3af]">Trading Status:</span>
            <span className={`font-medium ${
              hasActivePositions 
                ? 'text-[#27c47d]' 
                : avantisBalance > 0 
                  ? 'text-[#27c47d]' 
                  : 'text-[#f59e0b]'
            }`}>
              {hasActivePositions 
                ? 'Trading Active' 
                : avantisBalance > 0 
                  ? 'Ready to Trade' 
                  : 'Add Funds to Start'
              }
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-[#9ca3af]">Platform:</span>
            <span className="text-white font-medium">Avantis</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-[#9ca3af]">Wallet:</span>
            <span className="text-white font-medium">
              {primaryWallet?.address.slice(0, 6)}...{primaryWallet?.address.slice(-4)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-[#9ca3af]">Trading Balance:</span>
            <span className="font-medium text-white">
              ${avantisBalance.toFixed(2)}
            </span>
          </div>
          {hasActivePositions && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-[#9ca3af]">Open Positions:</span>
              <span className="font-medium text-[#27c47d]">
                {positionData.openPositions}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  </Card>

    </div>
  )
}

const WalletInfoCard = ({ 
  primaryWallet, 
  ethBalanceFormatted, 
  avantisBalance
}: {
  primaryWallet: { address: string; privateKey?: string; chain: string } | null
  ethBalanceFormatted: string
  avantisBalance: number
}) => {
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedPrivateKey, setCopiedPrivateKey] = useState(false)

  const copyWalletAddress = useCallback(async () => {
    if (primaryWallet?.address) {
      try {
        await navigator.clipboard.writeText(primaryWallet.address)
        setCopiedAddress(true)
        setTimeout(() => setCopiedAddress(false), 2000)
      } catch (err) {
        console.error('Failed to copy address:', err)
      }
    }
  }, [primaryWallet?.address])

  const copyPrivateKey = useCallback(async () => {
    if (primaryWallet?.privateKey) {
      try {
        await navigator.clipboard.writeText(primaryWallet.privateKey)
        setCopiedPrivateKey(true)
        setTimeout(() => setCopiedPrivateKey(false), 2000)
      } catch (err) {
        console.error('Failed to copy private key:', err)
      }
    }
  }, [primaryWallet?.privateKey])

  return (
    <Card className="bg-[#1a1a1a] border-[#262626] p-4 sm:p-6 rounded-2xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-lg">
            Your Trading Wallet
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${avantisBalance > 0 ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
            <span className={`text-sm font-medium ${avantisBalance > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              {avantisBalance > 0 ? 'Ready to Trade' : 'Add Funds'}
            </span>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#9ca3af] text-sm">Wallet Address:</span>
            <div className="flex items-center space-x-2">
              <code className="text-white text-sm font-mono bg-[#374151] px-2 py-1 rounded">
                {primaryWallet?.address?.slice(0, 6)}...{primaryWallet?.address?.slice(-4)}
              </code>
              <button
                onClick={copyWalletAddress}
                className={`text-sm transition-all duration-200 flex items-center space-x-1 ${
                  copiedAddress 
                    ? 'text-green-400 hover:text-green-300' 
                    : 'text-[#7c3aed] hover:text-[#6d28d9]'
                }`}
              >
                {copiedAddress ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Private Key Section */}
          <div className="flex items-center justify-between">
            <span className="text-[#9ca3af] text-sm">Private Key:</span>
            <div className="flex items-center space-x-2">
              <code className="text-white text-sm font-mono bg-[#374151] px-2 py-1 rounded">
                {primaryWallet?.privateKey?.slice(0, 6)}...{primaryWallet?.privateKey?.slice(-4)}
              </code>
              <button
                onClick={copyPrivateKey}
                className={`text-sm transition-all duration-200 flex items-center space-x-1 ${
                  copiedPrivateKey 
                    ? 'text-green-400 hover:text-green-300' 
                    : 'text-[#7c3aed] hover:text-[#6d28d9]'
                }`}
              >
                {copiedPrivateKey ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[#9ca3af] text-sm">Chain:</span>
            <span className="text-white text-sm capitalize">{primaryWallet?.chain}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[#9ca3af] text-sm">ETH Balance:</span>
            <span className="text-white text-sm font-medium">{ethBalanceFormatted}</span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-[#374151]">
          <div className="space-y-3">
            <p className="text-[#9ca3af] text-xs">
              {avantisBalance > 0
                ? 'Your wallet is ready for trading with a balance of $' + avantisBalance.toFixed(2) + '.'
                : 'Your wallet is ready but has no funds. Add funds to start trading.'
              }
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

const HoldingsSection = ({ holdings }: { holdings: Array<{
  token: { symbol: string; name: string; address: string; decimals: number; price: number };
  balance: string;
  valueUSD: number;
  color: string;
  link: string;
}> }) => {
  const formatValue = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }, [])

  if (holdings.length === 0) return null

  return (
    <div className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
      <div className="flex items-center justify-between px-1 sm:px-2">
        <h3 className="text-lg sm:text-xl font-bold text-white">Your Holdings</h3>
      </div>

      <div className="space-y-5 sm:space-y-6 pb-6 sm:pb-8 px-0 sm:px-1">
        {holdings.map((holding, index) => (
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
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const [targetProfit, setTargetProfit] = useState("10")
  const [investmentAmount, setInvestmentAmount] = useState("50")

  // Optimized hook usage - only essential hooks
  const {
    primaryWallet,
    allWallets,
    totalPortfolioValue,
    ethBalanceFormatted,
    holdings,
    dailyChange,
    dailyChangePercentage,
    isLoading,
    isConnected,
    avantisBalance,
    error,
    createWallet,
    refreshBalances
  } = useIntegratedWallet()

  const { isLoading: isTradingLoading, error: tradingError } = useTrading()
  const { totalProfits } = useTradingProfits()

  // Auto-create wallet if user doesn't have one - optimized with useCallback
  const createWalletIfNeeded = useCallback(() => {
    // Only create wallet if:
    // 1. User is logged in
    // 2. Not currently loading
    // 3. No primary wallet is connected
    // 4. No wallets exist for this user
    if (user?.fid && !isLoading && !primaryWallet && allWallets && allWallets.length === 0) {
      console.log('Auto-creating wallet for FID:', user.fid)
      createWallet('ethereum')
    }
  }, [user?.fid, isLoading, primaryWallet, allWallets, createWallet])

  useEffect(() => {
    createWalletIfNeeded()
  }, [createWalletIfNeeded])

  // Memoized holdings calculation - only recalculate when dependencies change
  const realHoldings = useMemo(() => {
    if (!isConnected) return []

    return [
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
        token: {
          ...holding.token,
          price: holding.token.price || 0
        },
        balance: holding.balanceFormatted,
        valueUSD: holding.valueUSD,
        color: holding.token.symbol === 'WBTC' ? '#f7931a' : '#f4b731',
        link: `/detail/${holding.token.symbol.toLowerCase()}`,
      }))
    ]
  }, [isConnected, ethBalanceFormatted, totalPortfolioValue, holdings])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0d0d0d] text-white relative">
        <NavigationHeader
          title="Home"
          breadcrumbs={[{ label: 'Home' }]}
        />

        <div className="px-4 sm:px-6 space-y-6 max-w-md mx-auto">
          {/* Portfolio Balance Card */}
          {!isConnected ? (
            <WalletSetupCard 
              isLoading={isLoading} 
              error={error} 
              onRetry={() => createWallet('ethereum')}
            />
          ) : (
            <PortfolioBalanceCard
              totalPortfolioValue={totalPortfolioValue}
              totalProfits={totalProfits}
              dailyChange={dailyChange}
              dailyChangePercentage={dailyChangePercentage}
              isBalanceVisible={isBalanceVisible}
              setIsBalanceVisible={setIsBalanceVisible}
              isConnected={isConnected}
              isTradingLoading={isTradingLoading}
              tradingError={tradingError}
            />
          )}

          {/* Start Trading Card - Show when wallet is connected */}
          {isConnected && primaryWallet && (
            <TradingCard
              targetProfit={targetProfit}
              setTargetProfit={setTargetProfit}
              investmentAmount={investmentAmount}
              setInvestmentAmount={setInvestmentAmount}
              primaryWallet={primaryWallet}
              avantisBalance={avantisBalance}
            />
          )}

          {/* Wallet Info Section - Show when connected */}
          {isConnected && primaryWallet && (
            <WalletInfoCard
              primaryWallet={primaryWallet}
              ethBalanceFormatted={ethBalanceFormatted}
              avantisBalance={avantisBalance}
            />
          )}

          {/* Your Holdings - Only show when connected and has holdings */}
          <HoldingsSection holdings={realHoldings} />
        </div>
      </div>
    </ProtectedRoute>
  )
}