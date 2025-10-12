import React, { useEffect, useState } from 'react'

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage: number
  networkRequests: number
  errors: number
}

interface PerformanceMonitorProps {
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void
  enableLogging?: boolean
}

export function PerformanceMonitor({ onMetricsUpdate, enableLogging = false }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    networkRequests: 0,
    errors: 0
  })

  useEffect(() => {
    const startTime = performance.now()
    
    // Monitor page load time
    const handleLoad = () => {
      const loadTime = performance.now() - startTime
      updateMetrics({ loadTime })
    }

    // Monitor memory usage
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory
        if (memory && memory.usedJSHeapSize) {
          const memoryUsage = memory.usedJSHeapSize / 1024 / 1024 // MB
          updateMetrics({ memoryUsage })
        }
      }
    }

    // Monitor network requests
    let networkRequests = 0
    const originalFetch = window.fetch
    window.fetch = (...args) => {
      networkRequests++
      updateMetrics({ networkRequests })
      return originalFetch(...args)
    }

    // Monitor errors
    let errorCount = 0
    const handleError = () => {
      errorCount++
      updateMetrics({ errors: errorCount })
    }

    // Monitor render performance
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          updateMetrics({ renderTime: entry.duration })
        }
      })
    })

    observer.observe({ entryTypes: ['measure'] })

    // Set up event listeners
    window.addEventListener('load', handleLoad)
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleError)

    // Update memory usage periodically
    const memoryInterval = setInterval(updateMemoryUsage, 5000)

    // Cleanup
    return () => {
      window.removeEventListener('load', handleLoad)
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleError)
      observer.disconnect()
      clearInterval(memoryInterval)
      window.fetch = originalFetch
    }
  }, [])

  const updateMetrics = (newMetrics: Partial<PerformanceMetrics>) => {
    setMetrics(prev => {
      const updated = { ...prev, ...newMetrics }
      
      if (enableLogging) {
        console.log('Performance Metrics:', updated)
      }
      
      onMetricsUpdate?.(updated)
      return updated
    })
  }

  // Don't render anything in production
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50">
      <div>Load: {metrics.loadTime.toFixed(0)}ms</div>
      <div>Memory: {metrics.memoryUsage.toFixed(1)}MB</div>
      <div>Network: {metrics.networkRequests}</div>
      <div>Errors: {metrics.errors}</div>
    </div>
  )
}

// Hook for monitoring component performance
export function usePerformanceMonitor(componentName: string) {
  const [renderTime, setRenderTime] = useState(0)

  useEffect(() => {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      setRenderTime(duration)
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`${componentName} render time: ${duration.toFixed(2)}ms`)
      }
    }
  }, [componentName])

  return renderTime
}

// Hook for monitoring API performance
export function useApiPerformance() {
  const [metrics, setMetrics] = useState<{
    requestCount: number
    averageResponseTime: number
    errorCount: number
  }>({
    requestCount: 0,
    averageResponseTime: 0,
    errorCount: 0
  })

  const trackRequest = async <T,>(request: Promise<T>): Promise<T> => {
    const startTime = performance.now()
    
    try {
      const result = await request
      const responseTime = performance.now() - startTime
      
      setMetrics(prev => ({
        requestCount: prev.requestCount + 1,
        averageResponseTime: (prev.averageResponseTime + responseTime) / 2,
        errorCount: prev.errorCount
      }))
      
      return result
    } catch (error) {
      setMetrics(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1
      }))
      throw error
    }
  }

  return { metrics, trackRequest }
}
