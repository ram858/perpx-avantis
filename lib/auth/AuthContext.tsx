"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp'

interface User {
  id: string
  fid: number // Farcaster ID for Base Account (0 for web users)
  webUserId?: number // Web user ID (for web users)
  baseAccountAddress: string | null // User's Base Account address or trading wallet address
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
  const isWebFallbackEnabled = process.env.NEXT_PUBLIC_ENABLE_WEB_MODE !== "false"

  const isAuthenticated = !!user

  useEffect(() => {
    // Only authenticate if in Base context
    const checkAuth = async () => {
      if (!isBaseContext) {
        if (isWebFallbackEnabled) {
          // Check for existing session in localStorage first
          if (typeof window !== 'undefined') {
            const storedToken = localStorage.getItem('web_auth_token');
            const storedUser = localStorage.getItem('web_user');

            if (storedToken && storedUser) {
              try {
                // Verify token is still valid by checking user info
                const baseUrl = window.location.origin;
                const response = await fetch(`${baseUrl}/api/auth/web`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${storedToken}`,
                  },
                });

                if (response.ok) {
                  const data = await response.json();
                  if (data.success && data.user) {
                    const webUser: User = {
                      id: `web_${data.user.id}`,
                      fid: 0,
                      webUserId: data.user.id,
                      baseAccountAddress: data.wallet?.address || null,
                      hasWallet: !!data.wallet,
                      createdAt: new Date(data.user.created_at),
                    };

                    setToken(storedToken);
                    setUser(webUser);
                    console.log('✅ Restored web session, User ID:', data.user.id);
                    setIsLoading(false);
                    return;
                  }
                }
              } catch (error) {
                console.error('Failed to verify stored token:', error);
                // Clear invalid session
                localStorage.removeItem('web_auth_token');
                localStorage.removeItem('web_user');
              }
            }
          }

          // No valid session found - redirect to auth page
          console.log('🌐 Web mode detected, no session found. Redirecting to auth...');
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/web')) {
            window.location.href = '/auth/web';
          }
        } else {
          console.warn('⚠️ App is not running in Base app context. Base Account is required.')
          setToken(previous => (previous === null ? previous : null))
          setUser(previous => (previous === null ? previous : null))
        }
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
  }, [isBaseContext, baseReady, authenticateBase, isWebFallbackEnabled])

  const login = (token: string, userData: User) => {
    console.log('🔐 Login called, setting user FID:', userData.fid)
    setToken(token)
    setUser(userData)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    // Clear web session from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('web_auth_token')
      localStorage.removeItem('web_user')
    }
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
