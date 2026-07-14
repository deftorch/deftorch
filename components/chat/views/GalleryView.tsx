import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ImageIcon, Plus, Play, Trash2 } from 'lucide-react';
import { useChatStore } from '@/lib/store/chat-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { formatDate } from '@/lib/utils';
import { getCategoryInfo } from '@/components/chat/utils';
import { Artifact } from '@/types';

// Canvas imports removed

import { useChatNavigation } from '@/hooks/useChatNavigation';
import { useArtifactManager } from '@/hooks/useArtifactManager';

interface GalleryViewProps {}

export const GalleryView: React.FC<GalleryViewProps> = () => {
  const { startNewChat: onStartNewChat, loadArtifactCode: onLoadArtifactCode } = useChatNavigation();
  const { deleteArtifact: onDeleteArtifact } = useArtifactManager();
  const chatStore = useChatStore();
  const { preferences } = useSettingsStore();

  useEffect(() => {
    const timer = setInterval(() => {
      const iframes = document.querySelectorAll('.gallery-canvas-container iframe');
      iframes.forEach((iframe: any) => {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage('pauseCanvas', '*');
        }
      });
    }, 500);
    
    const timeout = setTimeout(() => {
      clearInterval(timer);
    }, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [chatStore.artifacts]);

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <ImageIcon size={28} className="text-[#1a6adf] dark:text-[#60aaff]" />
              Gallery
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {chatStore.artifacts.length} creation{chatStore.artifacts.length !== 1 ? 's' : ''} saved
            </p>
          </div>
        </div>

        {chatStore.artifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <ImageIcon size={64} className="text-gray-400 dark:text-gray-700 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-400 mb-2">
              No creations yet
            </h2>
            <p className="text-gray-500 dark:text-gray-500 text-sm max-w-sm">
              Start creating with AI and your visual creations will appear here.
            </p>
            <button
              onClick={() => onStartNewChat()}
              className="mt-6 px-6 py-3 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium"
            >
              <Plus size={18} /> Create First Creation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {chatStore.artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="group glass-panel glass-panel-hover rounded-2xl overflow-hidden cursor-pointer flex flex-col animate-fade-in"
                onClick={() => onLoadArtifactCode(artifact)}
              >
                <div className="aspect-square bg-gray-900 relative overflow-hidden flex items-center justify-center">
                  <style>{`
                    .preview-in-gallery button {
                      display: none !important;
                    }
                  `}</style>
                  <div className="preview-in-gallery gallery-canvas-container w-full h-full flex items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-200 dark:bg-gray-800 rounded-lg text-center p-4">
                      <p className="text-xs">Canvas preview disabled in UI template.</p>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center z-10">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadArtifactCode(artifact);
                        }}
                        className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center gap-1 cursor-pointer"
                      >
                        <Play size={14} /> Open
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteArtifact(artifact.id);
                        }}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-transparent border-t border-[#1e468c]/10 dark:border-white/5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm truncate flex-1 text-gray-800 dark:text-gray-200">
                      {artifact.chatTitle}
                    </h3>
                    {preferences.developerMode ? (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium select-none ${(artifact.renderer || 'p5') === 'd3' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' : (artifact.renderer || 'p5') === 'svg' ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400' : (artifact.renderer || 'p5') === 'mermaid' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : (artifact.renderer || 'p5') === 'twojs' ? 'bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400' : (artifact.renderer || 'p5') === 'mojs' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'}`}
                      >
                        {(artifact.renderer || 'p5') === 'd3'
                          ? 'D3.js'
                          : (artifact.renderer || 'p5') === 'svg'
                            ? 'SVG'
                            : (artifact.renderer || 'p5') === 'mermaid'
                              ? 'Mermaid'
                              : (artifact.renderer || 'p5') === 'twojs'
                                ? 'Two.js'
                                : (artifact.renderer || 'p5') === 'mojs'
                                  ? 'Mo.js'
                                  : 'p5.js'}
                      </span>
                    ) : (
                      (() => {
                        const category = getCategoryInfo(
                          artifact.renderer || 'p5',
                          artifact.code,
                          artifact.chatTitle
                        );
                        const CategoryIcon = category.icon;
                        return (
                          <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium select-none ${category.colorClass}`}>
                            <CategoryIcon size={10} />
                            <span>{category.name}</span>
                          </span>
                        );
                      })()
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(artifact.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
