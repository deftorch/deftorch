import React from 'react';
import { MessageSquare, Plus, Search } from 'lucide-react';
import { useChatStore } from '@/lib/store/chat-store';
import { getRelativeTimeString } from '@/components/chat/utils';

import { useChatNavigation } from '@/hooks/useChatNavigation';
import { useState } from 'react';

interface ChatsViewProps {
  sortedChats: any[];
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  sortedChats,
}) => {
  const { startNewChat: onStartNewChat, selectChat: onSelectChat } = useChatNavigation();
  const chatStore = useChatStore();
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isMultiSelectChats, setIsMultiSelectChats] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-fade-in bg-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <MessageSquare size={28} className="text-[#1a6adf] dark:text-[#60aaff]" />
              Chats
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage and search your visual chat history
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isMultiSelectChats && selectedChatIds.length > 0 && (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete the ${selectedChatIds.length} selected chat(s)?`)) {
                    selectedChatIds.forEach((id) => chatStore.deleteChat(id));
                    setSelectedChatIds([]);
                    setIsMultiSelectChats(false);
                  }
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Delete Selected
              </button>
            )}

            <button
              onClick={() => {
                setIsMultiSelectChats(!isMultiSelectChats);
                setSelectedChatIds([]);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                isMultiSelectChats
                  ? 'bg-[#1a6adf]/10 dark:bg-[#60aaff]/10 border-[#1a6adf] dark:border-[#60aaff] text-[#1a6adf] dark:text-[#60aaff]'
                  : 'bg-transparent border-slate-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
              }`}
            >
              {isMultiSelectChats ? 'Cancel' : 'Select chats'}
            </button>

            <button
              onClick={() => onStartNewChat()}
              className="px-4 py-2 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium shadow-sm"
            >
              <Plus size={18} /> New chat
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search chats..."
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            className="w-full bg-[#1e293b]/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6adf]/20 dark:focus:ring-white/20 text-[#0a1628] dark:text-white"
          />
          {chatSearchQuery && (
            <button
              onClick={() => setChatSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {sortedChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <MessageSquare size={64} className="text-gray-400 dark:text-gray-700 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-400 mb-2">
              No chats yet
            </h2>
            <p className="text-gray-500 dark:text-gray-500 text-sm max-w-sm">
              Start a conversation with AI and it will appear here.
            </p>
            <button
              onClick={() => onStartNewChat()}
              className="mt-6 px-6 py-3 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium"
            >
              <Plus size={18} /> Create First Chat
            </button>
          </div>
        ) : (
          (() => {
            const filtered = chatSearchQuery.trim()
              ? chatStore.searchChats(chatSearchQuery)
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              : sortedChats;

            if (filtered.length === 0) {
              return <div className="text-center py-10 text-gray-400">No chats match "{chatSearchQuery}"</div>;
            }

            return (
              <div className="flex flex-col">
                {filtered.map((chat) => {
                  const isSelected = selectedChatIds.includes(chat.id);
                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        if (isMultiSelectChats) {
                          if (isSelected) {
                            setSelectedChatIds(selectedChatIds.filter((id) => id !== chat.id));
                          } else {
                            setSelectedChatIds([...selectedChatIds, chat.id]);
                          }
                        } else {
                          onSelectChat(chat.id);
                        }
                      }}
                      className="w-full flex items-center justify-between py-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 px-2 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        {isMultiSelectChats && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-gray-300 text-[#1a6adf] focus:ring-[#1a6adf] dark:border-white/10 dark:bg-white/5 cursor-pointer"
                          />
                        )}
                        <span className="font-normal text-gray-800 dark:text-gray-200 group-hover:text-black dark:group-hover:text-white text-base">
                          {chat.title}
                        </span>
                      </div>
                      <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">
                        {getRelativeTimeString(chat.updatedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
