"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBaseMiniApp } from "@/lib/hooks/useBaseMiniApp";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavigationHeaderProps {
  title: string;
  showBackButton?: boolean;
  backHref?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  actions?: React.ReactNode;
}

export function NavigationHeader({ 
  title, 
  showBackButton = false, 
  backHref = "/home",
  breadcrumbs = [],
  actions 
}: NavigationHeaderProps) {
  const { user, logout } = useAuth();
  const { isBaseContext } = useBaseMiniApp();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    // Redirect to auth page after logout
    router.push('/auth/web');
  };

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className="bg-[#0d0d0d] border-b border-[#262626] sticky top-0 z-50">
      {/* Main Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-md mx-auto">
        <div className="flex items-center space-x-3">
          {/* Back Button */}
          {showBackButton && (
            <Button
              onClick={handleBack}
              variant="outline"
              size="sm"
              className="bg-transparent border-[#444] text-[#e5e5e5] hover:bg-[#333] hover:text-white p-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          )}
          
          {/* Logo */}
          <div className="w-12 h-12 bg-[#4A2C7C] rounded-xl flex items-center justify-center shadow-lg">
            <Image src="/trading-bot-icon.svg" alt="Trading Bot" width={32} height={32} className="w-8 h-8" />
          </div>
        </div>
        
        {/* User info / Logout button */}
        <div className="text-right">
          {isBaseContext ? (
            // Farcaster mini-app: Show FID
            <>
              <p className="text-sm text-[#b4b4b4]">FID: {user?.fid || 'N/A'}</p>
              <p className="text-xs text-[#666]">Welcome back!</p>
            </>
          ) : (
            // Web version: Show logout button
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="bg-transparent border-[#444] text-[#e5e5e5] hover:bg-[#333] hover:text-white hover:border-[#555] px-3 py-1.5"
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="mr-1.5"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="text-sm">Logout</span>
            </Button>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="px-4 sm:px-6 max-w-md mx-auto pb-2">
          <nav className="flex items-center space-x-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#666]">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {crumb.href ? (
                  <Link href={crumb.href} className="text-[#9ca3af] hover:text-white transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>
      )}

      {/* Page Title */}
      <div className="px-4 sm:px-6 max-w-md mx-auto pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {actions && (
            <div className="flex items-center space-x-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
