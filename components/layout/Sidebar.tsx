'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  FolderOpen,
  Images,
  PanelLeft,
  SquarePen,
  Clock,
  Check,
  Pencil,
  Trash2,
  Settings,
  MoreHorizontal,
  Star,
  ChevronDown,
  ChevronRight,
  Users,
  GitBranch,
  Box,
  LineChart,
  Terminal,
  MoreVertical,
} from 'lucide-react';

import { useUIStore } from '@/lib/store/ui-store';
import { useChatStore } from '@/lib/store/chat-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatDate } from '@/lib/utils';

import { useChatNavigation } from '@/hooks/useChatNavigation';

interface SidebarProps {
  hydrated: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  hydrated,
}) => {
  const nav = useChatNavigation();
  const onSelectChat = nav.selectChat;
  const onStartNewChat = () => nav.startNewChat();
  const onDeleteChat = nav.deleteChat;
  const onOpenGallery = nav.openGallery;
  const ui = useUIStore();
  const chatStore = useChatStore();
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const signOut = useAuthStore((s) => s.signOut);

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const startRename = (chatId: string, currentTitle: string) => {
    setRenamingChatId(chatId);
    setRenameValue(currentTitle);
  };

  const confirmRename = () => {
    if (renamingChatId && renameValue.trim()) {
      chatStore.renameChat(renamingChatId, renameValue.trim());
      setRenamingChatId(null);
      setRenameValue('');
    }
  };

  const sortedChats = hydrated
    ? [...chatStore.chats].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    : [];

  const starredChats = sortedChats.filter(c => c.isStarred);
  const unstarredChats = sortedChats.filter(c => !c.isStarred);
  const lastTwoUnstarredIds = unstarredChats.slice(-2).map(c => c.id);

  const renderChatItem = (chat: any, isNearBottom: boolean = false) => (
    <div
      key={chat.id}
      className={`group flex items-center gap-1 px-2 py-2 rounded-lg transition-colors cursor-pointer ${ui.activeChatId === chat.id && ui.currentView === 'chat' ? 'bg-[#1a6adf]/18 dark:bg-white/10 text-[#0a1628] dark:text-white shadow-sm' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'}`}
    >
      {renamingChatId === chat.id ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
            className="flex-1 text-xs px-2 py-1 bg-white dark:bg-[#1a1525] border border-gray-300 dark:border-white/10 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#60aaff]"
            autoFocus
          />
          <button
            onClick={confirmRename}
            className="p-1 hover:bg-gray-300 dark:hover:bg-white/10 rounded"
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0" onClick={() => onSelectChat(chat.id)}>
            <div className="text-sm font-medium truncate">{chat.title}</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1 truncate">
              {formatDate(chat.updatedAt)} · {chat.messages.length} msgs
              {chat.projectId &&
                (() => {
                  const p = chatStore.projects.find((proj) => proj.id === chat.projectId);
                  return p ? (
                    <>
                      ·{' '}
                      <span className="text-[#1a6adf] dark:text-[#60aaff] truncate font-medium">
                        #{p.name}
                      </span>
                    </>
                  ) : null;
                })()}
            </div>
          </div>
          <div className="flex-shrink-0 relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                ui.setChatMenuOpenId(ui.chatMenuOpenId === chat.id ? null : chat.id);
              }}
              className={`p-1 rounded transition-colors cursor-pointer ${ui.chatMenuOpenId === chat.id ? 'bg-gray-200 dark:bg-white/15 text-gray-700 dark:text-white' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10'}`}
            >
              <MoreHorizontal size={14} />
            </button>

            {ui.chatMenuOpenId === chat.id && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => ui.setChatMenuOpenId(null)} />
                <div className={`absolute right-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-7'} z-50 w-44 bg-white dark:bg-[#1a1525] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-fade-in text-gray-900 dark:text-white`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      ui.setChatMenuOpenId(null);
                      ui.setMovingChatId(chat.id);
                      ui.setIsMoveToProjectOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-left text-gray-700 dark:text-gray-300"
                  >
                    <FolderOpen size={13} /> Move to project
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      ui.setChatMenuOpenId(null);
                      chatStore.starChat(chat.id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-left text-gray-700 dark:text-gray-300"
                  >
                    <Star size={13} className={chat.isStarred ? 'text-amber-400 fill-amber-400' : ''} />
                    {chat.isStarred ? 'Unstar' : 'Star'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      ui.setChatMenuOpenId(null);
                      startRename(chat.id, chat.title);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-left text-gray-700 dark:text-gray-300"
                  >
                    <Pencil size={13} /> Rename
                  </button>
                  <div className="border-t border-gray-100 dark:border-white/5" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      ui.setChatMenuOpenId(null);
                      onDeleteChat(chat.id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer text-left font-medium"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Sidebar Overlay Backdrop for Mobile */}
      {ui.sidebarOpen && (
        <div
          onClick={() => ui.setSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-20 animate-fade-in"
        />
      )}

      {/* Sidebar */}
      <div
        className={`${ui.sidebarOpen ? 'w-64 absolute md:relative z-30 shadow-2xl md:shadow-none h-full' : 'hidden md:flex w-14 z-20'} transition-all duration-300 sidebar-panel overflow-hidden flex-shrink-0 flex flex-col`}
      >
        {ui.sidebarOpen ? (
          /* Expanded Sidebar */
          <div className="p-4 w-64 flex flex-col h-full animate-fade-in select-none">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 32 32" fill="none">
                    <defs>
                      <linearGradient id="genesisGradSidebar" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="50%" stopColor="#60aaff" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M26 16C26 21.5228 21.5228 26 16 26C10.4772 26 6 21.5228 6 16C6 10.4772 10.4772 6 16 6C19.3431 6 22.2868 7.6393 24.1002 10.1584"
                      stroke="url(#genesisGradSidebar)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path d="M16 16H25" stroke="url(#genesisGradSidebar)" strokeWidth="2.5" strokeLinecap="round" />
                    <path
                      d="M16 11L17.5 14.5L21 16L17.5 17.5L16 21L14.5 17.5L11 16L14.5 14.5L16 11Z"
                      fill="url(#genesisGradSidebar)"
                    />
                  </svg>
                </div>
                <span className="font-semibold text-lg text-gray-900 dark:text-white">
                  Deftorch
                </span>
              </div>
              <button
                onClick={() => ui.setSidebarOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <PanelLeft size={18} />
              </button>
            </div>

            {/* Navigation */}
            <div className="space-y-1 mb-4">
              <button
                onClick={onStartNewChat}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1a6adf] hover:bg-[#1a6adf]/90 dark:bg-white text-white dark:text-black dark:hover:bg-gray-100 transition-colors text-sm font-medium shadow-sm cursor-pointer"
              >
                <SquarePen size={18} />
                <span>New chat</span>
              </button>

              <button
                onClick={() => {
                  ui.setCurrentView('chats');
                  ui.setActiveChatId(null);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    ui.setSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer ${ui.currentView === 'chats' || ui.currentView === 'chat' ? 'bg-[#1a6adf]/18 dark:bg-white/10 font-medium text-[#0a1628] dark:text-white shadow-sm' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/5'}`}
              >
                <MessageSquare size={18} />
                <span>Chats</span>
              </button>

              <button
                onClick={() => {
                  ui.setCurrentView('projects');
                  ui.setActiveProjectId(null);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    ui.setSidebarOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer ${ui.currentView === 'projects' ? 'bg-[#1a6adf]/18 dark:bg-white/10 font-medium text-[#0a1628] dark:text-white shadow-sm' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/5'}`}
              >
                <FolderOpen size={18} />
                <span>Projects</span>
                {hydrated && chatStore.projects.length > 0 && (
                  <span className="ml-auto text-xs bg-gray-300/60 dark:bg-white/15 text-[#1a3a6b] dark:text-gray-300 px-1.5 py-0.5 rounded-full font-mono">
                    {chatStore.projects.length}
                  </span>
                )}
              </button>

              <button
                onClick={onOpenGallery}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer ${ui.currentView === 'gallery' ? 'bg-[#1a6adf]/18 dark:bg-white/10 font-medium text-[#0a1628] dark:text-white shadow-sm' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/5'}`}
              >
                <Images size={18} />
                <span>Gallery</span>
                {chatStore.artifacts.length > 0 && (
                  <span className="ml-auto text-xs bg-gray-300/60 dark:bg-white/15 text-[#1a3a6b] dark:text-gray-300 px-1.5 py-0.5 rounded-full font-mono">
                    {chatStore.artifacts.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  ui.setCurrentView('agents');
                  if (typeof window !== 'undefined' && window.innerWidth < 768) ui.setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer ${ui.currentView === 'agents' ? 'bg-[#1a6adf]/18 dark:bg-white/10 font-medium text-[#0a1628] dark:text-white shadow-sm' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/5'}`}
              >
                <Users size={18} />
                <span>Agents</span>
              </button>

              <button
                onClick={() => {
                  ui.setCurrentView('workflows');
                  if (typeof window !== 'undefined' && window.innerWidth < 768) ui.setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer ${ui.currentView === 'workflows' ? 'bg-[#1a6adf]/18 dark:bg-white/10 font-medium text-[#0a1628] dark:text-white shadow-sm' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/5'}`}
              >
                <GitBranch size={18} />
                <span>Workflows</span>
              </button>

              <button
                onClick={() => {
                  ui.setCurrentView('models');
                  if (typeof window !== 'undefined' && window.innerWidth < 768) ui.setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer ${ui.currentView === 'models' ? 'bg-[#1a6adf]/18 dark:bg-white/10 font-medium text-[#0a1628] dark:text-white shadow-sm' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/5'}`}
              >
                <Box size={18} />
                <span>Models</span>
              </button>
            </div>

            {/* Sidebar Content - Always show chat history */}
            <div className="border-t border-[#1e468c]/12 dark:border-white/10 pt-4 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="space-y-1 overflow-y-auto flex-1 pr-1 pb-4">
                {!hydrated ? (
                  <div className="text-sm text-[#3a6aaa] dark:text-gray-400 px-3 py-2">
                    Loading...
                  </div>
                ) : sortedChats.length === 0 ? (
                  <div className="text-sm text-[#3a6aaa] dark:text-gray-400 px-3 py-6 text-center">
                    <MessageSquare size={20} className="mx-auto mb-2 opacity-30" />
                    <p>No chats yet</p>
                    <p className="text-xs mt-1">Start a new workspace!</p>
                  </div>
                ) : (
                  <>
                    {/* Favorites Section */}
                    {starredChats.length > 0 && (
                      <div className="mb-4">
                        <button
                          onClick={() => setIsFavoritesOpen(!isFavoritesOpen)}
                          className="w-full flex items-center gap-1 text-xs font-semibold text-[#3a6aaa] dark:text-gray-500 mb-1 px-3 hover:text-gray-900 dark:hover:text-gray-300 transition-colors cursor-pointer group"
                        >
                          <Star size={12} /> FAVORITES
                          <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                            {isFavoritesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        </button>
                        {isFavoritesOpen && (
                          <div className="space-y-1">
                            {starredChats.map(c => renderChatItem(c, false))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Creations Section */}
                    {unstarredChats.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-[#3a6aaa] dark:text-gray-500 mb-2 px-3 flex items-center gap-1">
                          <Clock size={12} /> RECENT WORKSPACES
                        </h3>
                        <div className="space-y-1">
                          {unstarredChats.map(c => renderChatItem(c, lastTwoUnstarredIds.includes(c.id)))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer - Account & Settings */}
            <div className="border-t border-gray-200 dark:border-white/10 pt-3 mt-auto relative">
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-white dark:bg-[#1a1525] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-fade-in p-1">
                    <button
                      onClick={() => {
                        ui.setCurrentView('analysis');
                        setIsUserMenuOpen(false);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) ui.setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer ${ui.currentView === 'analysis' ? 'bg-[#1a6adf]/10 dark:bg-white/10 font-medium text-[#1a6adf] dark:text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}`}
                    >
                      <LineChart size={16} />
                      <span>Analysis</span>
                    </button>
                    <button
                      onClick={() => {
                        ui.setCurrentView('debug');
                        setIsUserMenuOpen(false);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) ui.setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer ${ui.currentView === 'debug' ? 'bg-[#1a6adf]/10 dark:bg-white/10 font-medium text-[#1a6adf] dark:text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}`}
                    >
                      <Terminal size={16} />
                      <span>Debug Console</span>
                    </button>
                    <div className="my-1 border-t border-gray-100 dark:border-white/10" />
                    <button
                      onClick={() => {
                        ui.setIsSettingsOpen(true);
                        setIsUserMenuOpen(false);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) ui.setSidebarOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>
                    <div className="my-1 border-t border-gray-100 dark:border-white/10" />
                    {authStatus === 'authenticated' ? (
                      <button
                        onClick={async () => {
                          await signOut();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                      >
                        <Users size={16} />
                        <span>Keluar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          ui.setIsAuthModalOpen(true);
                          setIsUserMenuOpen(false);
                          if (typeof window !== 'undefined' && window.innerWidth < 768) ui.setSidebarOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                      >
                        <Users size={16} />
                        <span>Masuk / Daftar</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#1a6adf]/10 text-[#1a6adf] dark:bg-[#60aaff]/20 dark:text-[#60aaff] border border-[#1a6adf]/20 dark:border-[#60aaff]/40 flex items-center justify-center text-xs font-bold flex-shrink-0 select-none">
                    {authUser?.email ? authUser.email[0].toUpperCase() : 'G'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                      {authUser?.email || 'Local User'}
                    </p>
                    <span className="text-[10px] text-gray-400 block text-left">
                      {authStatus === 'authenticated' ? 'Tersinkron' : 'Hanya lokal'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer flex-shrink-0 ${isUserMenuOpen ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  title="More Options"
                >
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Collapsed Icon-Only Sidebar (Width 56px) */
          <div className="p-3 w-14 flex flex-col items-center h-full gap-4 animate-fade-in z-20">
            {/* Panel toggle */}
            <button
              onClick={() => ui.setSidebarOpen(true)}
              className="group w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-[#60aaff]/15 transition-all cursor-pointer relative"
              title="Expand sidebar"
            >
              <PanelLeft
                size={18}
                className="absolute opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out"
              />
              <div className="w-5.5 h-5.5 absolute opacity-100 group-hover:opacity-0 transition-all duration-300 ease-in-out flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 32 32" fill="none">
                  <defs>
                    <linearGradient id="genesisGradSidebarCollapsed" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#60aaff" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M26 16C26 21.5228 21.5228 26 16 26C10.4772 26 6 21.5228 6 16C6 10.4772 10.4772 6 16 6C19.3431 6 22.2868 7.6393 24.1002 10.1584"
                    stroke="url(#genesisGradSidebarCollapsed)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path d="M16 16H25" stroke="url(#genesisGradSidebarCollapsed)" strokeWidth="2.5" strokeLinecap="round" />
                  <path
                    d="M16 11L17.5 14.5L21 16L17.5 17.5L16 21L14.5 17.5L11 16L14.5 14.5L16 11Z"
                    fill="url(#genesisGradSidebarCollapsed)"
                  />
                </svg>
              </div>
            </button>

            {/* Collapsed Sidebar Items (Hidden on Mobile) */}
            <div className="hidden md:flex flex-col items-center gap-4 flex-1 w-full">
              {/* New chat */}
              <button
                onClick={onStartNewChat}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10"
                title="New chat"
              >
                <SquarePen size={18} />
              </button>

              {/* Chat History Icon */}
              <button
                onClick={() => {
                  ui.setCurrentView('chats');
                  ui.setActiveChatId(null);
                }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${ui.currentView === 'chats' || ui.currentView === 'chat' ? 'bg-[#1a6adf]/18 text-[#0a1628] border border-[#1a6adf]/30 dark:bg-[#60aaff]/15 dark:text-[#60aaff] dark:border-[#60aaff]/20' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10'}`}
                title="Chats"
              >
                <MessageSquare size={18} />
                {hydrated && sortedChats.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#1a6adf] dark:bg-[#60aaff] rounded-full" />
                )}
              </button>

              {/* Projects Icon */}
              <button
                onClick={() => {
                  ui.setCurrentView('projects');
                  ui.setActiveProjectId(null);
                }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${ui.currentView === 'projects' ? 'bg-[#1a6adf]/18 text-[#0a1628] border border-[#1a6adf]/30 dark:bg-[#60aaff]/15 dark:text-[#60aaff] dark:border-[#60aaff]/20' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10'}`}
                title="Projects"
              >
                <FolderOpen size={18} />
              </button>

              {/* Gallery */}
              <button
                onClick={onOpenGallery}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${ui.currentView === 'gallery' ? 'bg-[#1a6adf]/18 text-[#0a1628] border border-[#1a6adf]/30 dark:bg-[#60aaff]/15 dark:text-[#60aaff] dark:border-[#60aaff]/20' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10'}`}
                title="Gallery"
              >
                <Images size={18} />
              </button>

              {/* Agents */}
              <button
                onClick={() => ui.setCurrentView('agents')}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${ui.currentView === 'agents' ? 'bg-[#1a6adf]/18 text-[#0a1628] border border-[#1a6adf]/30 dark:bg-[#60aaff]/15 dark:text-[#60aaff] dark:border-[#60aaff]/20' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10'}`}
                title="Agents"
              >
                <Users size={18} />
              </button>

              {/* Workflows */}
              <button
                onClick={() => ui.setCurrentView('workflows')}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${ui.currentView === 'workflows' ? 'bg-[#1a6adf]/18 text-[#0a1628] border border-[#1a6adf]/30 dark:bg-[#60aaff]/15 dark:text-[#60aaff] dark:border-[#60aaff]/20' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10'}`}
                title="Workflows"
              >
                <GitBranch size={18} />
              </button>

              {/* Models */}
              <button
                onClick={() => ui.setCurrentView('models')}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${ui.currentView === 'models' ? 'bg-[#1a6adf]/18 text-[#0a1628] border border-[#1a6adf]/30 dark:bg-[#60aaff]/15 dark:text-[#60aaff] dark:border-[#60aaff]/20' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10'}`}
                title="Models"
              >
                <Box size={18} />
              </button>

              <div className="flex-1" />

              {/* Analysis */}
              <button
                onClick={() => ui.setCurrentView('analysis')}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${ui.currentView === 'analysis' ? 'bg-[#1a6adf]/18 text-[#0a1628] border border-[#1a6adf]/30 dark:bg-[#60aaff]/15 dark:text-[#60aaff] dark:border-[#60aaff]/20' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10'}`}
                title="Analysis"
              >
                <LineChart size={18} />
              </button>

              {/* Debug Console */}
              <button
                onClick={() => ui.setCurrentView('debug')}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${ui.currentView === 'debug' ? 'bg-[#1a6adf]/18 text-[#0a1628] border border-[#1a6adf]/30 dark:bg-[#60aaff]/15 dark:text-[#60aaff] dark:border-[#60aaff]/20' : 'text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10'}`}
                title="Debug Console"
              >
                <Terminal size={18} />
              </button>

              {/* Settings */}
              <button
                onClick={() => ui.setIsSettingsOpen(true)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#3a6aaa] hover:text-[#0a1628] hover:bg-[#1a6adf]/14 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer"
                title="Settings"
              >
                <Settings size={18} />
              </button>

              {/* Avatar */}
              <div
                onClick={() => ui.setIsSettingsOpen(true)}
                className="w-8 h-8 rounded-full bg-[#0a1628] dark:bg-[#60aaff]/20 border border-[#0a1628]/20 dark:border-[#60aaff]/40 flex items-center justify-center text-xs font-bold text-white dark:text-[#60aaff] cursor-pointer select-none"
                title="Settings"
              >
                G
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
