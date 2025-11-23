"use client"

import { useAuth } from '@/lib/auth/AuthContext'
import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps): JSX.Element | null {
  const { isAuthenticated, isLoading } = useAuth()
  const { isBaseContext } = useBaseMiniApp()
  const isWebFallbackEnabled = process.env.NEXT_PUBLIC_ENABLE_WEB_MODE !== "false"

  // Allow access to auth pages without authentication
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/')) {
    return <>{children}</>
  }

  // Show loading state
  if (isLoading) {
    return (
      (fallback as JSX.Element) || (
        <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-80 h-80 rounded-full bg-gradient-to-br from-[#8759ff]/20 to-[#2c2146]/30 blur-xl animate-pulse"></div>
          </div>
          <div className="relative z-10 flex flex-col items-center text-center space-y-8">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8759ff] to-[#A855F7] flex items-center justify-center animate-spin">
                <div className="w-8 h-8 bg-white rounded-sm"></div>
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-[#8759ff]/30 animate-ping"></div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8759ff] to-[#A855F7] bg-clip-text text-transparent">
                PrepX AI
              </h1>
              <p className="text-[#b4b4b4] text-sm animate-pulse">Authenticating...</p>
            </div>
          </div>
        </div>
      )
    )
  }

  // Allow read-only web access when Base context isn't available
  if (!isBaseContext && isWebFallbackEnabled) {
    return (
      <>
        <div className="bg-[#1a1a1a] border-b border-[#2f2f2f] text-[#d1d5db] px-4 py-3 text-sm">
          <p className="max-w-3xl mx-auto text-center">
            You are viewing the PrepX web preview. Connect through the Base app to unlock trading and Base Account features.
          </p>
        </div>
        {children}
      </>
    )
  }

  // If not in Base context, show error
  if (!isBaseContext) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Base App Required</h1>
          <p className="text-gray-400">
            This app is designed to run in the Base app. Please launch it from Base to continue.
          </p>
        </div>
      </div>
    )
  }

  // If not authenticated in Base context, show error
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Authentication Failed</h1>
          <p className="text-gray-400">
            Unable to authenticate with Base Account. Please try again.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
