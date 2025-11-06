"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp'

interface User {
  id: string
  fid: number // Farcaster ID for Base Account
  baseAccountAddress: string | null // User's Base Account address
  hasWallet: boolean
  createdAt: Date
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (token: string, userData: User) => void
  logout: () => void
  updateUser: (userData: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { isBaseContext, authenticate: authenticateBase, isReady: baseReady } = useBaseMiniApp()

  const isAuthenticated = !!user

  useEffect(() => {
    // Only authenticate if in Base context
    const checkAuth = async () => {
      if (!isBaseContext) {
        console.warn('⚠️ App is not running in Base app context. Base Account is required.')
        setIsLoading(false)
        return
      }

      // Wait for Base SDK to be ready
      if (!baseReady) {
        return
      }

      try {
        console.log('🔵 Base context detected, authenticating with Base Account...')
        const baseAuth = await authenticateBase()
        
        if (baseAuth) {
          // Base Account authentication successful
          const baseUser: User = {
            id: `fid_${baseAuth.fid}`,
            fid: baseAuth.fid,
            baseAccountAddress: baseAuth.address || null, // User's Base Account address
            hasWallet: !!baseAuth.address, // Has wallet if we have an address
            createdAt: new Date(),
          }
          
          setToken(baseAuth.token)
          setUser(baseUser)
          console.log('✅ Base Account authentication successful, FID:', baseAuth.fid, 'Address:', baseAuth.address)
        } else {
          console.error('❌ Base Account authentication failed')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setToken(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [isBaseContext, baseReady, authenticateBase])

  const login = (token: string, userData: User) => {
    console.log('🔐 Login called, setting user FID:', userData.fid)
    setToken(token)
    setUser(userData)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    // Note: In Base app, users typically can't "logout" - they're always authenticated
    console.log('Logged out')
  }

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData }
      setUser(updatedUser)
    }
  }

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
