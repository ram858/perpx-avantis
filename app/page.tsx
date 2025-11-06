"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useBaseMiniApp } from "@/lib/hooks/useBaseMiniApp"

export default function WelcomePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const { isBaseContext } = useBaseMiniApp()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // User is authenticated, go to home
      router.push('/home')
    }
  }, [isAuthenticated, isLoading, router])
  // Show loading while authenticating
  if (isLoading) {
    return (
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
            <p className="text-[#b4b4b4] text-sm animate-pulse">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // If not in Base context, show message
  if (!isBaseContext) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6">
        <div className="max-w-md text-center space-y-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#8759ff] to-[#A855F7] bg-clip-text text-transparent">
            PrepX AI Trading
          </h1>
          <p className="text-gray-400 text-lg">
            This app is designed to run in the Base app.
          </p>
          <p className="text-gray-500 text-sm">
            Please launch PrepX from Base to start trading.
          </p>
        </div>
      </div>
    )
  }

  // Show loading while waiting for redirect
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-white">Redirecting...</h1>
        <p className="text-gray-400">Preparing your dashboard</p>
      </div>
    </div>
  )
}
