"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

interface DepositModalProps {
  isOpen: boolean
  onClose: () => void
  onDeposit: (params: { amount: string; asset: 'USDC' | 'ETH' }) => Promise<void>
  isDepositing: boolean
  depositError: string | null
  recentDepositHash: string | null
  baseAccountAddress: string | null
  tradingWalletAddress: string | null
}

export function DepositModal({
  isOpen,
  onClose,
  onDeposit,
  isDepositing,
  depositError,
  recentDepositHash,
  baseAccountAddress,
  tradingWalletAddress
}: DepositModalProps) {
  const [depositAsset, setDepositAsset] = useState<'USDC' | 'ETH'>('USDC')
  const [depositAmount, setDepositAmount] = useState('')
  const [hasSuccessfulDeposit, setHasSuccessfulDeposit] = useState(false)

  const explorerBaseUrl = process.env.NEXT_PUBLIC_AVANTIS_NETWORK === 'base-testnet'
    ? 'https://sepolia.basescan.org'
    : 'https://basescan.org'

  useEffect(() => {
    if (recentDepositHash) {
      setHasSuccessfulDeposit(true)
    }
  }, [recentDepositHash])

  useEffect(() => {
    if (depositError) {
      setHasSuccessfulDeposit(false)
    }
  }, [depositError])

  const handleDeposit = async () => {
    if (!depositAmount) return
    try {
      await onDeposit({ amount: depositAmount, asset: depositAsset })
      setHasSuccessfulDeposit(true)
      setDepositAmount('')
    } catch (error) {
      setHasSuccessfulDeposit(false)
    }
  }

  const handleClose = () => {
    setDepositAmount('')
    setHasSuccessfulDeposit(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card className="bg-[#1a1a1a] border-[#262626] p-6 rounded-2xl max-w-md w-full mx-auto relative">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-[#9ca3af] hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-[#8759ff] rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-xl">Deposit Funds</h3>
            </div>

            <p className="text-[#9ca3af] text-sm">
              Transfer {depositAsset} from your Base wallet to your trading vault to fund your automated trading.
            </p>

            {/* Asset Selection */}
            <div className="space-y-2">
              <label className="block text-sm text-white font-medium">Select Asset</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDepositAsset('USDC')}
                  className={`flex-1 px-4 py-2.5 text-sm rounded-lg border-2 transition-all ${
                    depositAsset === 'USDC' 
                      ? 'bg-[#8759ff] text-white border-[#8759ff] shadow-lg' 
                      : 'border-[#374151] text-[#9ca3af] hover:border-[#4b5563] hover:text-white'
                  }`}
                >
                  💵 USDC
                </button>
                <button
                  onClick={() => setDepositAsset('ETH')}
                  className={`flex-1 px-4 py-2.5 text-sm rounded-lg border-2 transition-all ${
                    depositAsset === 'ETH' 
                      ? 'bg-[#8759ff] text-white border-[#8759ff] shadow-lg' 
                      : 'border-[#374151] text-[#9ca3af] hover:border-[#4b5563] hover:text-white'
                  }`}
                >
                  ⟠ ETH
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="block text-sm text-white font-medium">
                Amount ({depositAsset})
              </label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-[#2a2a2a] border-[#374151] text-white placeholder:text-[#6b7280]"
                placeholder={depositAsset === 'USDC' ? 'Enter USDC amount' : 'Enter ETH amount'}
              />
            </div>

            {/* Wallet Addresses */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#9ca3af]">From (Base wallet):</span>
                <span className="text-white font-mono">
                  {baseAccountAddress ? `${baseAccountAddress.slice(0, 6)}...${baseAccountAddress.slice(-4)}` : '—'}
                </span>
              </div>
              {tradingWalletAddress && (
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">To (Trading vault):</span>
                  <span className="text-white font-mono">
                    {tradingWalletAddress.slice(0, 6)}...{tradingWalletAddress.slice(-4)}
                  </span>
                </div>
              )}
            </div>

            {/* Deposit Button */}
            <Button
              disabled={isDepositing || !depositAmount || Number(depositAmount) <= 0}
              onClick={handleDeposit}
              className="w-full bg-[#8759ff] hover:bg-[#7c4dff] text-white font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDepositing ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </span>
              ) : (
                `⚡ Deposit ${depositAmount || '—'} ${depositAsset}`
              )}
            </Button>

            {/* Success Message */}
            {hasSuccessfulDeposit && recentDepositHash && (
              <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-3 space-y-2">
                <p className="text-green-400 text-sm font-semibold">✅ Deposit Successful!</p>
                <p className="text-green-300 text-xs">
                  Your deposit has been initiated. Funds will appear once the transaction confirms.
                </p>
                <a
                  className="text-green-400 hover:text-green-300 text-xs underline block"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`${explorerBaseUrl}/tx/${recentDepositHash}`}
                >
                  View transaction on BaseScan →
                </a>
              </div>
            )}

            {/* Error Message */}
            {depositError && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm font-semibold">❌ Deposit Failed</p>
                <p className="text-red-300 text-xs mt-1">{depositError}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

