"use client";

import { useEffect } from 'react';
import { useBaseMiniApp } from '@/lib/hooks/useBaseMiniApp';

export function BaseMiniAppProvider({ children }: { children: React.ReactNode }) {
  const { isReady, error, isBaseContext } = useBaseMiniApp();

  // Show error if SDK initialization fails
  useEffect(() => {
    if (error) {
      console.error('Base Mini App SDK initialization error:', error);
    }
  }, [error]);

  // Show loading state while SDK initializes (only in Base app context)
  if (!isReady && isBaseContext) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8759ff] to-[#A855F7] flex items-center justify-center animate-spin">
          <div className="w-8 h-8 bg-white rounded-sm"></div>
        </div>
        <p className="mt-4 text-[#b4b4b4]">Initializing PrepX...</p>
      </div>
    );
  }

  return <>{children}</>;
}

