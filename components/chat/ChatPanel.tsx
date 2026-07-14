'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  ChevronDown,
  PanelLeft,
} from 'lucide-react';

import { MessageList } from '@/components/chat/MessageList';
import { ChatImagePreview } from '@/components/chat/ChatImagePreview';
import { HomeView } from '@/components/chat/views/HomeView';
import { ProjectsView } from '@/components/chat/views/ProjectsView';
import { ChatsView } from '@/components/chat/views/ChatsView';
import { GalleryView } from '@/components/chat/views/GalleryView';
import { ActiveChatView } from '@/components/chat/views/ActiveChatView';
import { AnalysisView } from '@/components/chat/views/AnalysisView';
import { DebugConsoleView } from '@/components/chat/views/DebugConsoleView';
import { AgentsView } from '@/components/chat/views/AgentsView';
import { ModelsView } from '@/components/chat/views/ModelsView';
import { WorkflowsView } from '@/components/chat/views/WorkflowsView';

import { useUIStore } from '@/lib/store/ui-store';
import { useChatStore } from '@/lib/store/chat-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { useToast } from '@/lib/store/toast-store';
import { formatDate, formatMessageTimestamp, formatTokenCount } from '@/lib/utils';
import { AIModel, ImageAttachment, RendererType } from '@/types';
import { FILE_UPLOAD_CONFIG, AI_MODELS } from '@/config/constants';

interface ChatPanelProps {
  messages: any[];
  isLoading: boolean;
  onSendMessage: (customPrompt?: string) => Promise<void>;
  onStopGeneration: () => void;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
  selectedAgent: string | null;
  setSelectedAgent: (agentId: string | null) => void;
  codeVersions: any[];
  regeneratingId: string | null;
  onRegenerate: (messageId: string) => void;
  onSwitchVersionIdx: (messageId: string, idx: number) => void;
  onSaveMessageEdit: (messageId: string, index: number, text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onStopGeneration,
  isUploading,
  fileInputRef,
  chatInputRef,
  selectedModel,
  setSelectedModel,
  selectedAgent,
  setSelectedAgent,
  codeVersions,
  regeneratingId,
  onRegenerate,
  onSwitchVersionIdx,
  onSaveMessageEdit,
}) => {
  const ui = useUIStore();
  const chatStore = useChatStore();
  const { preferences } = useSettingsStore();
  const { toast } = useToast();

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSidebarHint, setShowSidebarHint] = useState(false);

  useEffect(() => {
    if (!ui.sidebarOpen) {
      setShowSidebarHint(true);
      const timer = setTimeout(() => {
        setShowSidebarHint(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowSidebarHint(false);
    }
  }, [ui.sidebarOpen]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Click outside model dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const sortedChats = [...chatStore.chats].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div
      className={`flex-1 flex flex-col min-w-0 ${
        !ui.showArtifact ? 'w-full' : 
        ui.artifactMode === 'wide' ? 'hidden' : 
        'hidden md:flex md:w-[40%]'
      } bg-transparent transition-all duration-300`}
    >
      {/* Header */}
      <div className="border-b border-[#1e468c]/12 dark:border-white/10 p-4 flex items-center justify-between flex-shrink-0 bg-[#fffaf0]/28 dark:bg-transparent backdrop-blur-md dark:backdrop-blur-none">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Mobile Sidebar Toggle Button */}
          {!ui.sidebarOpen && (
            <button
              onClick={() => ui.setSidebarOpen(true)}
              className="flex md:hidden group w-10 h-10 rounded-lg items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all cursor-pointer relative flex-shrink-0"
              title="Expand sidebar"
            >
              <PanelLeft
                size={20}
                className={`absolute transition-all duration-300 ease-in-out ${showSidebarHint ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}
              />
              <div className={`w-7 h-7 absolute transition-all duration-300 ease-in-out flex items-center justify-center ${showSidebarHint ? 'opacity-0 scale-75' : 'opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75'}`}>
                <svg className="w-full h-full" viewBox="0 0 32 32" fill="none">
                  <defs>
                    <linearGradient id="genesisGradMobileLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#60aaff" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M26 16C26 21.5228 21.5228 26 16 26C10.4772 26 6 21.5228 6 16C6 10.4772 10.4772 6 16 6C19.3431 6 22.2868 7.6393 24.1002 10.1584"
                    stroke="url(#genesisGradMobileLogo)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path d="M16 16H25" stroke="url(#genesisGradMobileLogo)" strokeWidth="2.5" strokeLinecap="round" />
                  <path
                    d="M16 11L17.5 14.5L21 16L17.5 17.5L16 21L14.5 17.5L11 16L14.5 14.5L16 11Z"
                    fill="url(#genesisGradMobileLogo)"
                  />
                </svg>
              </div>
            </button>
          )}

          {ui.activeChatId && ui.currentView === 'chat' ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 max-w-[180px] sm:max-w-[280px] truncate select-none">
                {chatStore.chats.find((c) => c.id === ui.activeChatId)?.title || 'New Creation'}
              </span>
              {preferences.developerMode && preferences.showTokenCount && (
                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 select-none">
                  {formatTokenCount(chatStore.chats.find((c) => c.id === ui.activeChatId)?.totalTokens || 0)} tokens
                </span>
              )}
            </div>
          ) : (
            !ui.sidebarOpen && (
              <span className="text-lg font-semibold text-slate-800 dark:text-white select-none">
                Deftorch
              </span>
            )
          )}
          <div className="flex items-center gap-1.5 select-none flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 plan-badge-custom rounded-full px-3.5 py-1 text-xs font-medium">
              <span>Free Plan</span>
              <span className="opacity-60">·</span>
              <button
                onClick={() => ui.setIsUpgradeModalOpen(true)}
                className="text-[#1a5acc] dark:text-[#b8d4ff] hover:text-[#0a1628] dark:hover:text-white hover:underline transition-all font-semibold cursor-pointer"
              >
                Upgrade
              </button>
            </div>

            <button
              onClick={() => ui.setIsUpgradeModalOpen(true)}
              className="flex sm:hidden w-8 h-8 rounded-full items-center justify-center bg-gradient-to-r from-[#1a6adf] to-[#508cf0] dark:from-[#60aaff]/15 dark:to-[#60aaff]/30 text-white dark:text-[#60aaff] border border-[#1a6adf]/30 dark:border-[#60aaff]/30 shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              title="Upgrade Plan"
            >
              <Sparkles size={14} className="animate-pulse" fill="currentColor" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!ui.showArtifact && ui.p5Code && ui.currentView === 'chat' && (
            <button
              onClick={() => ui.setShowArtifact(true)}
              className="p-2 bg-[#fffaf0]/80 dark:bg-[#0f0a1e]/85 border border-[#1e468c]/12 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer shadow-sm backdrop-blur-sm"
              title="Open Preview Panel"
            >
              <ChevronRight size={17} />
            </button>
          )}
        </div>
      </div>

      {ui.currentView === 'home' ? (
        <HomeView
          chatInputRef={chatInputRef}
          attachedImages={ui.attachedImages}
          removeAttachedImage={ui.removeAttachedImage}
          isLoading={isLoading}
          onSendMessage={onSendMessage}
          onStopGeneration={onStopGeneration}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          modelDropdownRef={modelDropdownRef}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          isModelDropdownOpen={isModelDropdownOpen}
          setIsModelDropdownOpen={setIsModelDropdownOpen}
        />
      ) : ui.currentView === 'projects' ? (
        <ProjectsView
          setNewProjectName={setNewProjectName}
          setNewProjectDesc={setNewProjectDesc}
        />
      ) : ui.currentView === 'chats' ? (
        <ChatsView sortedChats={sortedChats} />
      ) : ui.currentView === 'gallery' ? (
        <GalleryView />
      ) : ui.currentView === 'analysis' ? (
        <AnalysisView />
      ) : ui.currentView === 'debug' ? (
        <DebugConsoleView />
      ) : ui.currentView === 'agents' ? (
        <AgentsView />
      ) : ui.currentView === 'models' ? (
        <ModelsView />
      ) : ui.currentView === 'workflows' ? (
        <WorkflowsView />
      ) : (
        /* Active Chat View */
        <ActiveChatView
          messages={messages}
          isLoading={isLoading}
          regeneratingId={regeneratingId}
          onRegenerate={onRegenerate}
          onSwitchVersionIdx={onSwitchVersionIdx}
          onSaveMessageEdit={onSaveMessageEdit}
          onStopGeneration={onStopGeneration}
          codeVersions={codeVersions}
          attachedImages={ui.attachedImages}
          removeAttachedImage={ui.removeAttachedImage}
          chatInputRef={chatInputRef}
          onSendMessage={onSendMessage}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          modelDropdownRef={modelDropdownRef}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          isModelDropdownOpen={isModelDropdownOpen}
          setIsModelDropdownOpen={setIsModelDropdownOpen}
        />
      )}
    </div>
  );
};
