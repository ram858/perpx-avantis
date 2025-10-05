"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  phoneNumber: string
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
  const router = useRouter()

  const isAuthenticated = !!user

  useEffect(() => {
    // Check for existing authentication on mount
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('prepx_token')
        const userData = localStorage.getItem('prepx_user')

        if (token && userData) {
          setToken(token)
          // Check if it's a demo token (development mode)
          if (token.startsWith('dev_token_')) {
            console.log('Using demo token, skipping verification')
            const user = JSON.parse(userData)
            setUser(user)
          } else {
            // Verify real JWT token is still valid
            try {
              const response = await fetch('/api/auth/verify-token', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              })

              if (response.ok) {
                const user = JSON.parse(userData)
                console.log('✅ Authentication verified, user set:', user.phoneNumber)
                setUser(user)
              } else {
                console.log('❌ Token verification failed, clearing storage')
                // Token is invalid, clear storage
                localStorage.removeItem('prepx_token')
                localStorage.removeItem('prepx_user')
                localStorage.removeItem('prepx_authenticated')
                setToken(null)
              }
            } catch (fetchError) {
              console.error('Network error during token verification:', fetchError)
              // On network error, still set the user if we have valid data
              const user = JSON.parse(userData)
              console.log('⚠️ Network error, using cached user data:', user.phoneNumber)
              setUser(user)
            }
          }
        } else {
          console.log('No authentication data found')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        // Clear storage on error
        localStorage.removeItem('prepx_token')
        localStorage.removeItem('prepx_user')
        localStorage.removeItem('prepx_authenticated')
        setToken(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = (token: string, userData: User) => {
    console.log('🔐 Login called, setting user:', userData.phoneNumber)
    localStorage.setItem('prepx_token', token)
    localStorage.setItem('prepx_user', JSON.stringify(userData))
    localStorage.setItem('prepx_authenticated', 'true')
    setToken(token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('prepx_token')
    localStorage.removeItem('prepx_user')
    localStorage.removeItem('prepx_authenticated')
    localStorage.removeItem('prepx_phone')
    setToken(null)
    setUser(null)
    router.push('/login')
  }

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData }
      setUser(updatedUser)
      localStorage.setItem('prepx_user', JSON.stringify(updatedUser))
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
