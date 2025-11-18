'use client'

import { useState, useMemo } from 'react'
import { ExternalLink, Coins, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getNetworkConfig } from '@/lib/config/network'
import { Button } from '@/components/ui/button'

interface FaucetState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'rate_limited'
  message?: string
  nextRequestTime?: Date
}

export function TestnetFaucet({ walletAddress }: { walletAddress?: string }) {
  const networkConfig = useMemo(() => getNetworkConfig(), [])
  const isTestnet = networkConfig.key === 'base-testnet'
  const [faucetState, setFaucetState] = useState<FaucetState>({ status: 'idle' })
  const [address, setAddress] = useState(walletAddress || '')

  // Don't show on mainnet
  if (!isTestnet) {
    return null
  }
  
  const circleFaucetUrl = `https://faucet.circle.com/?network=base-sepolia&token=usdc&address=${encodeURIComponent(
    address || walletAddress || ''
  )}`

  const handleOpenFaucet = () => {
    if (!address && !walletAddress) {
      setFaucetState({
        status: 'error',
        message: 'Please provide a wallet address'
      })
      return
    }

    setFaucetState({ status: 'loading' })
    
    // Open Circle faucet in new window
    window.open(circleFaucetUrl, '_blank', 'noopener,noreferrer')
    
    // Simulate loading state (Circle faucet handles the actual request)
    setTimeout(() => {
      setFaucetState({
        status: 'success',
        message: 'Faucet opened in new window. Request 10 USDC per hour.'
      })
      
      // Reset after 3 seconds
      setTimeout(() => {
        setFaucetState({ status: 'idle' })
      }, 3000)
    }, 1000)
  }

  return (
    <div className="border border-yellow-500/20 rounded-lg bg-yellow-500/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-yellow-500/10 rounded-lg">
          <Coins className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-sm text-yellow-900 dark:text-yellow-100">
              Get Testnet USDC
            </h3>
            <p className="text-xs text-yellow-700/80 dark:text-yellow-300/80 mt-0.5">
              Request 10 USDC per hour from Circle faucet for testing
            </p>
          </div>

          {!walletAddress && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wallet Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              />
            </div>
          )}

          {faucetState.status === 'error' && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span>{faucetState.message}</span>
            </div>
          )}

          {faucetState.status === 'success' && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>{faucetState.message}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleOpenFaucet}
              disabled={faucetState.status === 'loading' || (!address && !walletAddress)}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-4 py-2"
            >
              {faucetState.status === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4" />
                  Request 10 USDC
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://faucet.circle.com/', '_blank')}
              className="flex items-center gap-2 text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              Open Faucet
            </Button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-yellow-500/10 pt-2 mt-2">
            <p className="font-medium text-yellow-700 dark:text-yellow-300">⚠️ Base Sepolia Not in Circle Faucet?</p>
            <p className="text-yellow-600/80 dark:text-yellow-400/80">
              Circle faucet may not show Base Sepolia in dropdown. Try these alternatives:
            </p>
            <div className="space-y-1.5 mt-2">
              <p className="font-medium">Option 1: Try URL Parameters</p>
              <p className="text-xs">The URL may work even if not in dropdown. Click &quot;Request 10 USDC&quot; above to try.</p>
              
              <p className="font-medium mt-2">Option 2: Get Base Sepolia ETH First</p>
              <p className="text-xs">You need ETH for gas fees. Get testnet ETH from:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5 text-xs">
                <li><a href="https://www.alchemy.com/faucets/base-sepolia" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Alchemy Faucet</a> (0.1 ETH/day)</li>
                <li><a href="https://faucets.chain.link/base-sepolia" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Chainlink Faucet</a> (0.5 ETH/request)</li>
                <li><a href="https://faucet.quicknode.com/base/sepolia" target="_blank" rel="noopener" className="text-blue-400 hover:underline">QuickNode Faucet</a></li>
              </ul>
              
              <p className="font-medium mt-2">Option 3: Bridge from Another Testnet</p>
              <p className="text-xs">If Circle supports other testnets, get USDC there and bridge to Base Sepolia.</p>
              
              <p className="font-medium mt-2">Option 4: Manual Transfer</p>
              <p className="text-xs">If you have access to a Base Sepolia wallet with USDC, transfer manually.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

