"use client";

import { useEffect, useState } from 'react';

interface BuildInfo {
  timestamp: string;
  buildTime: string;
  commitHash: string;
  buildNumber: string;
}

export function BuildTimestamp() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch build info from public JSON file
    fetch('/build-info.json')
      .then(res => res.json())
      .then((data: BuildInfo) => {
        setBuildInfo(data);
        setIsLoading(false);
      })
      .catch(() => {
        // If build info doesn't exist, use current time as fallback
        setBuildInfo({
          timestamp: new Date().toISOString(),
          buildTime: new Date().toLocaleString('en-US', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }),
          commitHash: 'dev',
          buildNumber: 'local'
        });
        setIsLoading(false);
      });
  }, []);

  if (isLoading || !buildInfo) {
    return null;
  }

  // Format relative time
  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const buildDate = new Date(timestamp);
    const diffMs = now.getTime() - buildDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return buildInfo.buildTime;
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-[#1a1a1a]/50 border border-[#262626]/50 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        {/* Animated dot indicator */}
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-[#27c47d] animate-pulse"></div>
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#27c47d] opacity-75 animate-ping"></div>
        </div>
        
        {/* Build time text */}
        <div className="flex flex-col">
          <span className="text-[10px] text-[#9ca3af] leading-tight">
            Deployed
          </span>
          <span className="text-[11px] text-[#27c47d] font-medium leading-tight">
            {getRelativeTime(buildInfo.timestamp)}
          </span>
        </div>
      </div>
      
      {/* Build number badge */}
      <div className="hidden sm:flex items-center">
        <span className="text-[9px] text-[#666] px-1.5 py-0.5 rounded bg-[#0d0d0d] border border-[#262626]">
          #{buildInfo.buildNumber.slice(-6)}
        </span>
      </div>
    </div>
  );
}

