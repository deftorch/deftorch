import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  RotateCw,
  ThumbsDown,
  ThumbsUp,
  Loader2,
  FileText,
  Maximize2,
} from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';
import { formatMessageTimestamp } from '@/lib/utils';
import { RendererType } from '@/types';

// Canvas imports removed

interface MessageItemProps {
  msg: any;
  index: number;
  isUser: boolean;
  storeMessage: any;
  activeVersionIdx: number;
  onSwitchVersionIdx: (messageId: string, idx: number) => void;
  handleCopyText: (text: string) => void;
  isLoading: boolean;
  onRegenerate: (messageId: string) => void;
  regeneratingId: string | null;
  codeVersions: any[];
}

const markdownComponents: any = {
  p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
  strong: ({ ...props }) => <strong className="font-bold text-gray-900 dark:text-white" {...props} />,
  em: ({ ...props }) => <em className="italic" {...props} />,
  ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-left" {...props} />,
  ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-left" {...props} />,
  li: ({ ...props }) => <li className="text-sm" {...props} />,
  code: ({ ...props }) => <code className="bg-gray-100 dark:bg-white/10 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
  table: ({ ...props }) => <div className="overflow-x-auto mb-4 w-full"><table className="w-full text-sm text-left text-gray-700 dark:text-gray-300 border-collapse border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden" {...props} /></div>,
  thead: ({ ...props }) => <thead className="bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white uppercase text-xs" {...props} />,
  th: ({ ...props }) => <th className="px-4 py-3 border border-gray-200 dark:border-white/10 font-bold whitespace-nowrap" {...props} />,
  td: ({ ...props }) => <td className="px-4 py-2 border border-gray-200 dark:border-white/10" {...props} />,
};

export const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  index,
  isUser,
  storeMessage,
  activeVersionIdx,
  onSwitchVersionIdx,
  handleCopyText,
  isLoading,
  onRegenerate,
  regeneratingId,
  codeVersions,
}) => {
  const ui = useUIStore();

  const [previewWidth, setPreviewWidth] = useState(368);
  const [previewNode, setPreviewNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!previewNode) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setPreviewWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(previewNode);
    return () => observer.disconnect();
  }, [previewNode]);

  // Pause inline canvases after they render their first frame to save CPU
  useEffect(() => {
    const timer = setInterval(() => {
      if (previewNode) {
        // Find all iframes within this message item's DOM tree
        const container = previewNode.closest('.flex-col') || document;
        const iframes = container.querySelectorAll('.preview-in-chat iframe');
        iframes.forEach((iframe: any) => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage('pauseCanvas', '*');
          }
        });
      }
    }, 500);
    
    const timeout = setTimeout(() => {
      clearInterval(timer);
    }, 2500);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [msg.content, previewNode]);

  const renderAiMessage = (content: string, messageIndex: number) => {
    const codeRegex = /```(?:javascript|js|html|svg|mermaid|p5|remotion|plan|markdown)?\n([\s\S]*?)```/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let blockCount = 0;

    while ((match = codeRegex.exec(content)) !== null) {
      const textBefore = content.substring(lastIndex, match.index);
      if (textBefore.trim()) {
        elements.push(
          <div key={`text-${lastIndex}`} className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-left mb-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {textBefore}
            </ReactMarkdown>
          </div>
        );
      }

      const code = match[1];
      let rType: RendererType = 'p5';
      if (code.includes('// renderer: d3')) {
        rType = 'd3';
      } else if (code.includes('// renderer: svg') || code.includes('<svg')) {
        rType = 'svg';
      } else if (
        code.includes('// renderer: mermaid') ||
        code.includes('graph ') ||
        code.includes('flowchart ')
      ) {
        rType = 'mermaid';
      } else if (code.includes('// renderer: twojs')) {
        rType = 'twojs';
      } else if (code.includes('// renderer: mojs')) {
        rType = 'mojs';
      } else if (code.includes('// renderer: pixi')) {
        rType = 'pixi';
      } else if (code.includes('// renderer: gsap')) {
        rType = 'gsap';
      } else if (code.includes('// renderer: anime')) {
        rType = 'anime';
      } else if (code.includes('// renderer: lottie')) {
        rType = 'lottie';
      } else if (code.includes('// renderer: matter')) {
        rType = 'matter';
      } else if (code.includes('// renderer: html') || code.trim().toLowerCase().startsWith('<!doctype html>')) {
        rType = 'html';
      } else if (code.includes('// renderer: remotion') || code.includes('@remotion')) {
        rType = 'remotion';
      } else if (code.includes('// renderer: plan')) {
        rType = 'plan';
      }

      const verObj = codeVersions.find((v) => v.messageIndex === messageIndex);

      elements.push(
        <div
          key={`canvas-${match.index}`}
          onClick={() => {
            ui.setShowArtifact(true);
            if (verObj && blockCount === 0) { // For simplicity, only use verObj for the first block
              ui.setActiveVersionNumber(verObj.versionNumber);
            } else {
              ui.setP5Code(code);
              ui.setEditableCode(code);
              ui.setActiveRenderer(rType);
            }
            ui.setActiveTab('preview');
          }}
          className={`border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#090514]/45 overflow-hidden text-gray-200 font-mono text-[12px] cursor-pointer hover:border-[#60aaff]/35 transition-all shadow-md group/card relative mb-3 ${
            !ui.showArtifact ? 'w-full' : 'max-w-full'
          }`}
        >
          <div 
            ref={blockCount === 0 ? setPreviewNode : undefined}
            className={`p-0 bg-white dark:bg-[#07030e]/30 rounded-xl overflow-hidden flex items-center justify-center relative select-none preview-in-chat pointer-events-none aspect-[8/5] ${
              !ui.showArtifact 
                ? 'w-full' 
                : 'w-[280px] sm:w-[368px] max-w-full'
            }`}
          >
            <div 
              className="absolute left-0 top-0 origin-top-left"
              style={{ 
                width: '800px', 
                height: '500px',
                transform: `scale(${previewWidth / 800})`
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-200 dark:bg-gray-800 rounded-lg">
                <p>Canvas components have been disabled in this UI preview.</p>
              </div>
            </div>
          </div>
        </div>
      );

      lastIndex = match.index + match[0].length;
      blockCount++;
    }

    const textAfter = content.substring(lastIndex);
    if (textAfter.trim()) {
      elements.push(
        <div key={`text-${lastIndex}`} className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-left">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {textAfter}
          </ReactMarkdown>
        </div>
      );
    }

    if (elements.length > 0) {
      return (
        <div className="flex flex-col">
          <style>{`
            .preview-in-chat button {
              display: none !important;
            }
          `}</style>
          {elements}
        </div>
      );
    }

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-left">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <div 
      className={`flex gap-3 ${isUser ? 'justify-end user-message-marker' : 'justify-start'} animate-fade-in w-full`}
      data-msg-id={storeMessage?.id || msg.id}
      data-msg-text={isUser ? (storeMessage?.content || msg.content) : ''}
    >
      <div className={`flex flex-col gap-1.5 group ${!isUser && !ui.showArtifact ? 'w-full max-w-full' : 'max-w-[92%] sm:max-w-[80%]'}`}>
        <div
          className={`p-4 rounded-xl shadow-sm border ${
            isUser
              ? 'bg-[#1a6adf] dark:bg-[#60aaff]/10 border-transparent dark:border-[#60aaff]/20 text-white dark:text-[#b8d4ff]'
              : 'glass-panel text-[#0a1628] dark:text-gray-100'
          }`}
        >
          {isUser ? (
              <div>
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-2 flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 custom-scrollbar">
                    {msg.images.map((img: any, imgIdx: number) => {
                      const isObject = typeof img === 'object';
                      const url = isObject ? (img.preview || img.url) : img;
                      const isImage = isObject ? img.type?.startsWith('image/') : true;
                      const name = isObject ? img.name : `Attached image ${imgIdx + 1}`;
                      
                      return isImage ? (
                        <div 
                          key={imgIdx} 
                          className="relative group/image shrink-0 cursor-pointer" 
                          onClick={() => {
                            if (isObject) {
                              ui.setAnnotatingImage(img);
                            } else {
                              ui.setAnnotatingImage({
                                id: `msg-img-${imgIdx}`,
                                url: url,
                                preview: url,
                                name: name,
                                type: 'image/png',
                                size: 0
                              });
                            }
                          }}
                        >
                          <img
                            src={url}
                            alt={name}
                            className="max-w-[260px] max-h-[200px] object-cover rounded-xl border border-white/20 shadow-sm bg-background"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                            <Maximize2 className="text-white w-6 h-6" />
                          </div>
                        </div>
                      ) : (
                        <div key={imgIdx} className="shrink-0 flex flex-col items-center justify-center bg-muted rounded-xl border border-white/20 shadow-sm overflow-hidden w-24 h-24">
                          <FileText className="h-8 w-8 text-muted-foreground mb-1" />
                          <span className="text-[10px] text-muted-foreground font-medium uppercase px-2 truncate w-full text-center">
                            {name.split('.').pop()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {msg.content && (
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-left">
                    {msg.content}
                  </div>
                )}
              </div>
          ) : (
            renderAiMessage(msg.content, index)
          )}
        </div>

        <div
          className={`flex items-center gap-2.5 px-1 mt-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none text-[11px] ${isUser ? 'justify-end' : 'justify-start'}`}
        >
          <div className="relative group/tooltip flex items-center gap-1 cursor-default text-[10px] text-gray-400 dark:text-gray-500">
            <span>
              {formatMessageTimestamp(storeMessage?.timestamp || new Date())}
            </span>
            <div
              className={`absolute bottom-full mb-1 hidden group-hover/tooltip:block bg-gray-900 dark:bg-popover border border-slate-700 dark:border-white/10 text-white dark:text-popover-foreground text-[10px] rounded px-2 py-1 shadow-md whitespace-nowrap z-50 ${isUser ? 'right-0' : 'left-0'}`}
            >
              {new Date(storeMessage?.timestamp || new Date()).toLocaleDateString('en-US', {
                dateStyle: 'medium',
              })}
              ,{' '}
              {new Date(storeMessage?.timestamp || new Date()).toLocaleTimeString('en-US', {
                timeStyle: 'short',
              })}{' '}
              — {isUser ? 'you' : 'assistant'}
            </div>
          </div>

          <span className="text-gray-300 dark:text-white/5 select-none">|</span>

          {storeMessage?.versions && storeMessage.versions.length > 1 && (
            <>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                <button
                  disabled={activeVersionIdx === 0}
                  onClick={() => onSwitchVersionIdx(storeMessage.id, activeVersionIdx - 1)}
                  className="hover:text-[#1a6adf] dark:hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft size={10} />
                </button>
                <span className="font-mono">
                  {activeVersionIdx + 1} / {storeMessage.versions.length}
                </span>
                <button
                  disabled={activeVersionIdx === storeMessage.versions.length - 1}
                  onClick={() => onSwitchVersionIdx(storeMessage.id, activeVersionIdx + 1)}
                  className="hover:text-[#1a6adf] dark:hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight size={10} />
                </button>
              </div>
              <span className="text-gray-300 dark:text-white/5 select-none">|</span>
            </>
          )}

          {!isUser && (
            <>
              <button
                className="hover:text-[#1a6adf] dark:hover:text-white transition-colors cursor-pointer"
                title="Like message"
              >
                <ThumbsUp size={11} />
              </button>
              <button
                className="hover:text-[#1a6adf] dark:hover:text-white transition-colors cursor-pointer"
                title="Dislike message"
              >
                <ThumbsDown size={11} />
              </button>
            </>
          )}
          <button
            onClick={() => handleCopyText(msg.content)}
            className="hover:text-[#1a6adf] dark:hover:text-white transition-colors cursor-pointer"
            title="Copy message"
          >
            <Copy size={11} />
          </button>
          {isUser && storeMessage && (
            <button
              onClick={() => {
                ui.setEditingMessageId(storeMessage.id);
                ui.setInputMessage(msg.content);
                if (storeMessage.images && Array.isArray(storeMessage.images)) {
                  ui.setAttachedImages(storeMessage.images);
                } else {
                  ui.setAttachedImages([]);
                }
                const input = document.getElementById('chat-input-textarea');
                if (input) input.focus();
              }}
              className="hover:text-[#1a6adf] dark:hover:text-white transition-colors cursor-pointer"
              title="Edit message"
            >
              <Pencil size={11} />
            </button>
          )}
          {storeMessage && (
            <button
              disabled={isLoading}
              onClick={() => onRegenerate(storeMessage.id)}
              className="hover:text-[#1a6adf] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Retry generation"
            >
              {regeneratingId === storeMessage.id ? (
                <Loader2 className="animate-spin" size={11} />
              ) : (
                <RotateCw size={11} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
