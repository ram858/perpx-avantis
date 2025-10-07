"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WalletCreation } from './WalletCreation';
import { WalletManagement } from './WalletManagement';
import { NavigationHeader } from './NavigationHeader';

interface WalletDashboardProps {
  className?: string;
}

export function WalletDashboard({ className = "" }: WalletDashboardProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleWalletCreated = () => {
    // Refresh the wallet management component when a new wallet is created
    setRefreshKey(prev => prev + 1);
    // Switch to manage tab to show the new wallet
    setActiveTab('manage');
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <NavigationHeader
        title="Wallet Dashboard"
        showBackButton={true}
        backHref="/home"
        breadcrumbs={[
          { label: 'Home', href: '/home' },
          { label: 'Wallet Dashboard' }
        ]}
      />
      
      <div className={`space-y-6 max-w-md mx-auto px-4 sm:px-6 py-6 ${className}`}>
        <div className="text-center">
          <p className="text-[#9ca3af]">
            Create and manage your blockchain wallets
          </p>
        </div>

      {/* Tab Navigation */}
      <Card className="p-1 bg-[#1f2937] border-[#374151]">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'create'
                ? 'bg-[#7c3aed] text-white'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#374151]'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="text-current"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Create Wallet</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'manage'
                ? 'bg-[#7c3aed] text-white'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#374151]'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="text-current"
              >
                <path
                  d="M3 7V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 7H21V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 11H16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 15H12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>My Wallets</span>
            </div>
          </button>
        </div>
      </Card>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'create' ? (
          <WalletCreation onWalletCreated={handleWalletCreated} />
        ) : (
          <WalletManagement key={refreshKey} />
        )}
      </div>

      {/* Quick Actions */}
      <Card className="p-6 bg-[#1f2937] border-[#374151]">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => setActiveTab('create')}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
          >
            <div className="flex items-center space-x-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="text-current"
              >
                <path
                  d="M12 5V19M5 12H19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Create New Wallet</span>
            </div>
          </Button>
          <Button
            onClick={() => setActiveTab('manage')}
            className="bg-[#374151] hover:bg-[#4b5563] text-white"
          >
            <div className="flex items-center space-x-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="text-current"
              >
                <path
                  d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M22 6L12 13L2 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>View All Wallets</span>
            </div>
          </Button>
          <Button
            onClick={() => window.open('https://faucets.chain.link/', '_blank')}
            className="bg-[#059669] hover:bg-[#047857] text-white"
          >
            <div className="flex items-center space-x-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="text-current"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Get Test Tokens</span>
            </div>
          </Button>
        </div>
      </Card>
      </div>
    </div>
  );
}
