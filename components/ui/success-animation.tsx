'use client'

import React, { useEffect, useState } from 'react'

interface SuccessAnimationProps {
  show: boolean
  onComplete?: () => void
  children?: React.ReactNode
  className?: string
}

export function SuccessAnimation({ 
  show, 
  onComplete, 
  children,
  className = '' 
}: SuccessAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (show) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setIsAnimating(false)
        onComplete?.()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!show && !isAnimating) return null

  return (
    <div className={`relative ${className}`}>
      {isAnimating && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="relative">
            {/* Success checkmark animation */}
            <svg
              className="w-16 h-16 text-green-400 animate-scale-in"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5 }}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {/* Ripple effect */}
            <div className="absolute inset-0 rounded-full bg-green-400 opacity-20 animate-ping" />
          </div>
        </div>
      )}
      <div className={isAnimating ? 'opacity-30' : ''}>
        {children}
      </div>
    </div>
  )
}

// Simple CSS-based animation (no framer-motion dependency)
const motion = {
  path: ({ 
    initial, 
    animate, 
    transition, 
    ...props 
  }: any) => (
    <path
      style={{
        strokeDasharray: 24,
        strokeDashoffset: animate?.pathLength === 1 ? 0 : 24,
        transition: `stroke-dashoffset ${transition?.duration || 0.5}s ease-out`,
      }}
      {...props}
    />
  )
}
