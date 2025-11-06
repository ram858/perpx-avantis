"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";
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
  const router = useRouter();

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
        
        {/* User info and logout */}
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm text-[#b4b4b4]">FID: {user?.fid || 'N/A'}</p>
            <p className="text-xs text-[#666]">Welcome back!</p>
          </div>
          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="bg-transparent border-[#444] text-[#e5e5e5] hover:bg-[#333] hover:text-white"
          >
            Logout
          </Button>
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
