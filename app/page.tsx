"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useBaseMiniApp } from "@/lib/hooks/useBaseMiniApp"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function WelcomePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const { isBaseContext } = useBaseMiniApp()

  useEffect(() => {
    if (!isLoading && isAuthenticated && isBaseContext) {
      // User is authenticated, go to home
      router.push('/home')
    }
  }, [isAuthenticated, isLoading, isBaseContext, router])
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
        <div className="max-w-lg w-full space-y-8 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#8759ff] to-[#A855F7] bg-clip-text text-transparent">
              PrepX AI Trading
            </h1>
            <p className="text-gray-300 text-base sm:text-lg">
              You&apos;re viewing the PrepX web preview. Launch the app here to explore the dashboard,
              or open PrepX inside the Base app to unlock trading with your Base Account.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => router.push("/home")}
              className="w-full sm:w-auto bg-[#8759ff] hover:bg-[#7c4dff] text-white"
            >
              Launch Web Preview
            </Button>
            <Link
              href="https://apps.base.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto text-sm text-[#b4b4b4] hover:text-white underline underline-offset-4"
            >
              Open in Base App
            </Link>
          </div>

          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6 text-left space-y-2">
            <h2 className="text-lg font-semibold text-white">Why open in Base?</h2>
            <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
              <li>Authenticate with your Base Account (FID) securely.</li>
              <li>Access automated trading powered by PrepX.</li>
              <li>Tap into Base-native incentives and account orchestration.</li>
            </ul>
          </div>
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
