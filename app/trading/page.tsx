"use client"

import { TradingDashboard } from "@/components/TradingDashboard"
import { ProtectedRoute } from "@/components/ProtectedRoute"

export default function TradingPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0d0d0d] p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <TradingDashboard />
        </div>
      </div>
    </ProtectedRoute>
  )
}