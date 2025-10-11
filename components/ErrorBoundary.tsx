"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-red-500">
                  <path 
                    d="M12 9V11M12 15H12.01M5.07 19H18.93C20.6 19 21.5 17.1 20.7 15.6L13.77 3.6C12.97 2.1 11.03 2.1 10.23 3.6L3.3 15.6C2.5 17.1 3.4 19 5.07 19Z" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Something went wrong</h2>
                <p className="text-[#b4b4b4] text-sm">An unexpected error occurred</p>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 p-3 bg-[#262626] rounded-lg">
                <p className="text-red-400 text-xs font-mono break-words">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-[#b4b4b4] text-xs cursor-pointer hover:text-white">
                      Stack trace
                    </summary>
                    <pre className="text-[#b4b4b4] text-xs mt-2 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={this.handleReset}
                className="w-full bg-[#8759ff] hover:bg-[#7c4dff] text-white rounded-lg py-3 font-semibold transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/home'}
                className="w-full bg-[#262626] hover:bg-[#333333] text-white rounded-lg py-3 font-semibold transition-colors"
              >
                Go to Home
              </button>
            </div>

            <p className="text-[#696969] text-xs text-center mt-4">
              If the problem persists, please refresh the page or contact support
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components to handle async errors
export function useErrorHandler() {
  const [, setError] = React.useState();
  
  return React.useCallback(
    (error: Error) => {
      setError(() => {
        throw error;
      });
    },
    [setError]
  );
}

