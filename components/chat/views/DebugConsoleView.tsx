import React, { useRef, useEffect } from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import { Terminal, Trash2, Info, AlertTriangle, Bug } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const DebugConsoleView = () => {
  const { debugLogs, clearDebugLogs } = useChatStore();
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [debugLogs]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />;
      default: return <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />;
    }
  };

  const getTextColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent p-8 animate-fade-in">
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <Terminal size={28} className="text-[#1a6adf] dark:text-[#60aaff]" />
              Debug Console
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Live orchestration and API event stream logs.
            </p>
          </div>
          
          <button
            onClick={clearDebugLogs}
            disabled={debugLogs.length === 0}
            className="px-4 py-2 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={18} />
            Clear
          </button>
        </div>

        <div className="flex-1 glass-panel rounded-2xl p-6 overflow-y-auto custom-scrollbar font-mono text-[13px]">
          {debugLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <Bug size={48} className="mb-4 opacity-50 text-[#1a6adf] dark:text-[#60aaff]" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No debug logs yet.</p>
              <p className="mt-2 text-sm">Start a conversation to see real-time events.</p>
            </div>
          ) : (
          <div className="space-y-1.5 pb-8">
            {debugLogs.map((log, index) => (
              <div 
                key={index} 
                className={`flex gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors border-l-2 ${
                  log.type === 'error' ? 'border-red-500 bg-red-500/5' :
                  log.type === 'warn' ? 'border-yellow-500 bg-yellow-500/5' :
                  'border-blue-500/30'
                }`}
              >
                <div className="text-gray-500 flex-shrink-0 whitespace-nowrap opacity-70">
                  {log.timestamp ? formatDate(log.timestamp) : new Date().toLocaleTimeString()}
                </div>
                {getIcon(log.type)}
                <div className={`${getTextColor(log.type)} break-words leading-relaxed`}>
                  {log.message}
                </div>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
