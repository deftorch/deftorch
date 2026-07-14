'use client';

import React, { useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Maximize,
  Minimize,
  X,
  Code,
  Check,
  Copy,
  Download,
  ChevronDown
} from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';
import { useChatStore } from '@/lib/store/chat-store';
import { CodeEditor } from './CodeEditor';

interface ArtifactPanelProps {
  onSendMessage: (customPrompt?: string) => Promise<void>;
  isLoading: boolean;
  onStopGeneration: () => void;
  codeVersions: any[];
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  codeVersions,
}) => {
  const ui = useUIStore();
  const chatStore = useChatStore();

  const [localVersionDropdownOpen, setLocalVersionDropdownOpen] = useState(false);
  const [copiedLocal, setCopiedLocal] = useState(false);

  const toggleTrueFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  const handleDownloadCode = () => {
    const element = document.createElement('a');
    const file = new Blob([ui.editableCode || ui.p5Code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `snippet.js`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ui.editableCode || ui.p5Code);
    setCopiedLocal(true);
    setTimeout(() => setCopiedLocal(false), 2000);
  };

  const getFriendlyTitle = () => {
    const activeChat = chatStore.chats.find((c) => c.id === ui.activeChatId);
    if (activeChat && activeChat.title && activeChat.title !== 'New Chat') {
      return activeChat.title;
    }
    return 'Code Viewer';
  };

  return (
    <div
      className={`${
        ui.artifactMode === 'wide' ? 'fixed inset-0 z-40 w-screen h-screen' : 
        'w-full md:w-[60%] h-full border-l border-[#1e468c]/12 dark:border-white/10'
      } flex flex-col overflow-hidden bg-white/90 dark:bg-[#070214]/92 backdrop-blur-xl transition-all duration-300 relative`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e468c]/10 dark:border-white/10 select-none">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Code size={12} />
            <span>Code</span>
          </span>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white truncate max-w-[150px] sm:max-w-[280px]">
            {getFriendlyTitle()}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => ui.setArtifactMode(ui.artifactMode === 'wide' ? 'standard' : 'wide')}
            className="hidden sm:block p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            {ui.artifactMode === 'wide' ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            onClick={toggleTrueFullscreen}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            {ui.isTrueFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
          <button
            onClick={() => ui.setShowArtifact(false)}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e468c]/10 dark:border-white/10 bg-transparent select-none">
        <div className="flex items-center gap-3">
          {/* Version System Dropdown */}
          <div className="flex items-center gap-2 text-xs relative text-gray-600 dark:text-gray-300">
            <div
              onClick={() => setLocalVersionDropdownOpen(!localVersionDropdownOpen)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#1e468c]/15 dark:border-white/15 cursor-pointer bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <span className="font-semibold">v{ui.activeVersionNumber || 1}</span>
              <ChevronDown
                size={10}
                className={`transition-transform duration-200 ${localVersionDropdownOpen ? 'rotate-180' : ''}`}
              />
            </div>

            {localVersionDropdownOpen && codeVersions.length > 0 && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setLocalVersionDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-[#151121] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg py-1.5 z-40 max-h-60 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1">
                    Version History
                  </div>
                  {codeVersions.map((v) => (
                    <button
                      key={v.versionNumber}
                      onClick={() => {
                        ui.setActiveVersionNumber(v.versionNumber);
                        setLocalVersionDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-between text-xs ${v.versionNumber === ui.activeVersionNumber ? 'text-[#1a6adf] font-medium bg-[#1a6adf]/5' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      <span>Version {v.versionNumber}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            
            <span className="hidden sm:inline">·</span>
            <span className="font-mono text-[11px] hidden sm:inline">
              {(ui.editableCode || ui.p5Code)?.split('\n').length || 0} lines
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <button
            onClick={handleCopyCode}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer hover:text-gray-900 dark:hover:text-white"
            title="Copy code"
          >
            {copiedLocal ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <button
            onClick={handleDownloadCode}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer hover:text-gray-900 dark:hover:text-white"
            title="Download source"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Editor View */}
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          value={ui.editableCode || ui.p5Code || ''}
          onChange={(code) => {
            ui.setEditableCode(code);
            ui.setP5Code(code);
          }}
        />
      </div>
    </div>
  );
};
