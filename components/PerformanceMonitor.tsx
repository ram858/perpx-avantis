"use client"

import { useEffect, useState } from 'react'

export function PerformanceMonitor() {
  const [loadTime, setLoadTime] = useState<number | null>(null)

  useEffect(() => {
    // Measure page load performance
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigation) {
        const loadTime = navigation.loadEventEnd - navigation.fetchStart
        setLoadTime(loadTime)
      }
    }
  }, [])

  // Only show in development
  if (process.env.NODE_ENV !== 'development' || !loadTime) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded z-50">
      Load: {loadTime.toFixed(0)}ms
    </div>
  )
}
