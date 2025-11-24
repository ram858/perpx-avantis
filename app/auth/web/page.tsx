"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function WebAuthPage() {
  const router = useRouter()
  const { isAuthenticated, login } = useAuth()
  const { isBaseContext } = useBaseMiniApp()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // CRITICAL: Don't show phone login in Farcaster mini-app
  // Redirect to home if in Base context (Farcaster users authenticate via Base SDK)
  useEffect(() => {
    if (isBaseContext) {
      // In Farcaster/Base context - redirect to home (Base SDK handles auth)
      router.push('/home')
      return
    }
  }, [isBaseContext, router])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/home')
    }
  }, [isAuthenticated, router])

  // Don't render phone login if in Farcaster context
  if (isBaseContext) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Redirecting...</h1>
          <p className="text-gray-400">Farcaster authentication in progress</p>
        </div>
      </div>
    )
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/web/phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStep('otp')
      } else {
        setError(data.error || 'Failed to send OTP')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/web/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, otp }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Store token and user in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('web_auth_token', data.token)
          localStorage.setItem('web_user', JSON.stringify(data.user))
        }

        // Login user
        login(data.token, {
          id: `web_${data.user.id}`,
          fid: 0,
          webUserId: data.user.id,
          baseAccountAddress: data.wallet?.address || null,
          hasWallet: !!data.wallet,
          createdAt: new Date(data.user.created_at),
        })

        // Redirect to home
        router.push('/home')
      } else {
        setError(data.error || 'Invalid OTP')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-80 h-80 rounded-full bg-gradient-to-br from-[#8759ff]/20 to-[#2c2146]/30 blur-xl animate-pulse"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-[#1a1a1a] border-[#2f2f2f]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#8759ff] to-[#A855F7] bg-clip-text text-transparent">
              PrepX AI
            </CardTitle>
            <CardDescription className="text-[#b4b4b4]">
              {step === 'phone' ? 'Enter your mobile number' : 'Enter OTP sent to your phone'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'phone' ? (
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div>
                  <Input
                    type="tel"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-[#0d0d0d] border-[#2f2f2f] text-white"
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-[#b4b4b4] mt-2">
                    For testing, use OTP: <span className="font-mono font-bold text-[#8759ff]">123456</span>
                  </p>
                </div>
                {error && (
                  <div className="text-red-500 text-sm">{error}</div>
                )}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#8759ff] to-[#A855F7] hover:from-[#7648cc] hover:to-[#8f4dd4]"
                  disabled={isLoading || !phoneNumber}
                >
                  {isLoading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="bg-[#0d0d0d] border-[#2f2f2f] text-white text-center text-2xl tracking-widest"
                    maxLength={6}
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-[#b4b4b4] mt-2 text-center">
                    Enter the 6-digit OTP (Default: 123456)
                  </p>
                </div>
                {error && (
                  <div className="text-red-500 text-sm">{error}</div>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-[#2f2f2f] text-[#b4b4b4] hover:bg-[#2f2f2f]"
                    onClick={() => {
                      setStep('phone')
                      setOtp('')
                      setError(null)
                    }}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-[#8759ff] to-[#A855F7] hover:from-[#7648cc] hover:to-[#8f4dd4]"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? 'Verifying...' : 'Verify OTP'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

