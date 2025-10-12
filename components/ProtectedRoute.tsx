"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps): JSX.Element | null {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      (fallback as JSX.Element) || (
        <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6 relative overflow-hidden">
          {/* Background gradient circles */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-80 h-80 rounded-full bg-gradient-to-br from-[#8759ff]/20 to-[#2c2146]/30 blur-xl animate-pulse"></div>
          </div>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-8">
            {/* Logo/Icon */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8759ff] to-[#A855F7] flex items-center justify-center animate-spin">
                <div className="w-8 h-8 bg-white rounded-sm"></div>
              </div>
              {/* Pulsing ring */}
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-[#8759ff]/30 animate-ping"></div>
            </div>

            {/* PrepX Title */}
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

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return <>{children}</>
}
