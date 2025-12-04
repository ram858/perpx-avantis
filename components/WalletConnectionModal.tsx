"use client"

import { WalletConnection } from "@/components/WalletConnection"

interface WalletConnectionModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WalletConnectionModal({
  isOpen,
  onClose,
}: WalletConnectionModalProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-[#1a1a1a] border border-[#262626] p-4 sm:p-6 rounded-2xl max-w-md w-full mx-auto relative max-h-[90vh] overflow-y-auto my-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#9ca3af] hover:text-white transition-colors z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Wallet Connection Component */}
          <WalletConnection />
        </div>
      </div>
    </>
  )
}

