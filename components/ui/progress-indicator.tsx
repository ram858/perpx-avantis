'use client'

import React from 'react'
import * as Progress from '@radix-ui/react-progress'

interface ProgressIndicatorProps {
  progress?: number // 0-100
  isLoading?: boolean
  label?: string
  className?: string
}

export function ProgressIndicator({ 
  progress, 
  isLoading = false, 
  label,
  className = '' 
}: ProgressIndicatorProps) {
  const [internalProgress, setInternalProgress] = React.useState(0)

  React.useEffect(() => {
    if (isLoading) {
      // Animate from 0 to 80% when loading
      const interval = setInterval(() => {
        setInternalProgress(prev => {
          if (prev >= 80) return 80
          return prev + Math.random() * 10
        })
      }, 200)
      return () => clearInterval(interval)
    } else if (progress !== undefined) {
      setInternalProgress(progress)
    } else {
      setInternalProgress(0)
    }
  }, [isLoading, progress])

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-[#9ca3af]">{label}</span>
          {!isLoading && progress !== undefined && (
            <span className="text-sm text-white font-medium">{Math.round(internalProgress)}%</span>
          )}
        </div>
      )}
      <Progress.Root
        className="relative overflow-hidden bg-[#2a2a2a] rounded-full w-full h-2"
        value={internalProgress}
      >
        <Progress.Indicator
          className="bg-[#8759ff] w-full h-full transition-transform duration-300 ease-out rounded-full"
          style={{ transform: `translateX(-${100 - internalProgress}%)` }}
        />
      </Progress.Root>
    </div>
  )
}
