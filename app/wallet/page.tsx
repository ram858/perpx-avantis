"use client";

import { WalletDashboard } from '@/components/WalletDashboard';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function WalletPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#111827] py-8">
        <div className="max-w-4xl mx-auto px-4">
          <WalletDashboard />
        </div>
      </div>
    </ProtectedRoute>
  );
}
