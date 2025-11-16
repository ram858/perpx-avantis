"use client";

import { useUILogger } from '@/lib/hooks/useUILogger';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function UILogger() {
  const { logs, clearLogs, isVisible, toggleVisibility } = useUILogger();

  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        className="fixed bottom-4 right-4 z-50 bg-[#8759ff] hover:bg-[#7c4dff] text-white p-3 rounded-full shadow-lg transition-all"
        title="Show Logs"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
        </svg>
      </button>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400 bg-red-900/20 border-red-500/50';
      case 'warning':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/50';
      case 'success':
        return 'text-green-400 bg-green-900/20 border-green-500/50';
      default:
        return 'text-blue-400 bg-blue-900/20 border-blue-500/50';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] max-h-[600px] bg-[#1a1a1a] border-[#262626] shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#262626]">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <h3 className="text-white font-semibold text-sm">Debug Logs</h3>
          <span className="text-[#9ca3af] text-xs">({logs.length})</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={clearLogs}
            className="bg-[#374151] hover:bg-[#4b5563] text-white text-xs px-2 py-1 h-7"
            title="Clear Logs"
          >
            Clear
          </Button>
          <button
            onClick={toggleVisibility}
            className="text-[#9ca3af] hover:text-white transition-colors p-1"
            title="Hide Logs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-[#9ca3af] text-sm">
            No logs yet. Logs will appear here as the app runs.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-2 rounded-lg border text-xs ${getLevelColor(log.level)}`}
            >
              <div className="flex items-start space-x-2">
                <span className="text-base">{getLevelIcon(log.level)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{log.message}</span>
                    <span className="text-[#6b7280] text-[10px] ml-2">
                      {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  {log.details && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[#9ca3af] hover:text-white text-[10px]">
                        Details
                      </summary>
                      <pre className="mt-1 text-[10px] overflow-x-auto bg-black/30 p-2 rounded">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

