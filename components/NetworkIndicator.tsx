'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getNetworkConfig } from '@/lib/config/network'

export function NetworkIndicator() {
  const networkConfig = useMemo(() => getNetworkConfig(), [])
  const isTestnet = networkConfig.key === 'base-testnet'

  if (!isTestnet) {
    // Don't show indicator on mainnet (cleaner UI)
    return null
  }

  return (
    <div className="w-full bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
      <div className="flex items-center justify-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <span className="font-medium text-yellow-600 dark:text-yellow-400">
          TESTNET MODE
        </span>
        <span className="text-yellow-600/80 dark:text-yellow-400/80">
          - {networkConfig.name} - No real funds
        </span>
      </div>
    </div>
  )
}

export function NetworkBadge({ className = '' }: { className?: string }) {
  const networkConfig = useMemo(() => getNetworkConfig(), [])
  const isTestnet = networkConfig.key === 'base-testnet'

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isTestnet
          ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'
          : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
      } ${className}`}
    >
      {isTestnet ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <CheckCircle2 className="h-3 w-3" />
      )}
      <span>{networkConfig.name}</span>
    </div>
  )
}

