import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from './button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId?: string
}

export class ErrorBoundaryEnhanced extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    const errorId = Math.random().toString(36).substr(2, 9)
    return { 
      hasError: true, 
      error, 
      errorId 
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
    
    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo })
    }
    
    this.setState({ errorInfo })
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: undefined })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center p-6">
          <div className="text-center max-w-lg">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold mb-4 text-white">Something went wrong</h1>
            
            <p className="text-[#b4b4b4] mb-6 leading-relaxed">
              We&apos;re sorry, but something unexpected happened. Our team has been notified and we&apos;re working to fix it.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-[#9ca3af] hover:text-white transition-colors mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4 text-xs">
                  <div className="mb-2">
                    <strong className="text-red-400">Error ID:</strong> {this.state.errorId}
                  </div>
                  <div className="mb-2">
                    <strong className="text-red-400">Message:</strong> {this.state.error.message}
                  </div>
                  <div className="mb-2">
                    <strong className="text-red-400">Stack:</strong>
                    <pre className="mt-1 text-[#9ca3af] overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong className="text-red-400">Component Stack:</strong>
                      <pre className="mt-1 text-[#9ca3af] overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={this.handleRetry}
                className="bg-[#8759ff] hover:bg-[#7C3AED] text-white"
              >
                Try Again
              </Button>
              <Button 
                onClick={this.handleReload}
                variant="outline"
                className="border-[#444] text-gray-300 hover:bg-[#333] hover:text-white"
              >
                Reload Page
              </Button>
            </div>

            <div className="mt-6 text-xs text-[#666]">
              Error ID: {this.state.errorId}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
