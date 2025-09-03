"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-[#b4b4b4] mb-6">
              We&apos;re sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <Button onClick={() => window.location.reload()} className="bg-[#8759ff] hover:bg-[#7C3AED] text-white">
              Refresh Page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
