'use client';

import React from 'react';
import { Bot, User, Copy, Edit2, Trash2, RotateCw, ChevronLeft, ChevronRight, ArrowDown, Check } from 'lucide-react';
import { Message as MessageType, AIModel } from '@/types';
import { cn, formatDate, copyToClipboard, formatMessageTimestamp } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/store/toast-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getGroupedModels, getModelDisplayName } from '@/lib/model-utils';

interface ChatMessageProps {
  message: MessageType;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string, model?: AIModel) => void;
  onSwitchVersion?: (messageId: string, versionIdx: number) => void;
  currentModel?: AIModel;
}

interface CollapsibleContentProps {
  children: React.ReactNode;
  maxHeight?: number;
}

const CollapsibleContent: React.FC<CollapsibleContentProps> = ({ children, maxHeight = 240 }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkHeight = () => {
      if (containerRef.current) {
        setIsOverflowing(containerRef.current.scrollHeight > maxHeight);
      }
    };
    checkHeight();
    
    window.addEventListener('resize', checkHeight);
    return () => window.removeEventListener('resize', checkHeight);
  }, [children, maxHeight]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn(
          "overflow-hidden transition-all duration-300",
          !isExpanded && isOverflowing && "relative"
        )}
        style={{
          maxHeight: isExpanded || !isOverflowing ? 'none' : `${maxHeight}px`
        }}
      >
        {children}
        {!isExpanded && isOverflowing && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
        )}
      </div>
      {isOverflowing && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-primary hover:underline mt-2 flex items-center gap-1 select-none"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onEdit,
  onDelete,
  onRegenerate,
  onSwitchVersion,
  currentModel,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);
  const [showModelSelector, setShowModelSelector] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const { success, error } = useToast();
  const { preferences } = useSettingsStore();

  const groupedModels = getGroupedModels();

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const activeVersionIdx = message.activeVersionIdx !== undefined ? message.activeVersionIdx : 0;

  const handleCopy = async () => {
    try {
      await copyToClipboard(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success('Copied', 'Message copied to clipboard');
    } catch (err) {
      error('Error', 'Failed to copy message');
    }
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim()) {
      onEdit(message.id, editContent);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleRegenerateClick = () => {
    if (isAssistant) {
      setShowModelSelector(!showModelSelector);
    } else if (onRegenerate) {
      onRegenerate(message.id);
    }
  };

  return (
    <div
      className={cn(
        'group flex gap-4 px-4 py-6 hover:bg-muted/50 transition-colors relative',
        isUser && 'bg-muted/30'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full',
          isUser && 'bg-primary text-primary-foreground',
          isAssistant && 'bg-accent text-accent-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {isUser ? 'You' : 'AI Assistant'}
          </span>
          {message.isEdited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm resize-y"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <CollapsibleContent>
            <MarkdownRenderer content={message.content} />
          </CollapsibleContent>
        )}

        {/* Images */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.images.map((image) => (
              <img
                key={image.id}
                src={image.preview || image.url}
                alt={image.name}
                className="max-w-xs rounded-lg border"
              />
            ))}
          </div>
        )}

        {/* Token count */}
        {preferences.developerMode && preferences.showTokenCount && message.totalTokens && (
          <div className="text-xs text-muted-foreground font-mono">
            {message.totalTokens} tokens
          </div>
        )}

        {/* Bottom Bar: Pagination, Timestamp, and Actions */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-2 border-t border-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Left section: Timestamp details with hover tooltip */}
          <div className="relative group/tooltip flex items-center gap-1.5 cursor-default select-none">
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
              {isUser ? 'you' : 'assistant'}
            </span>
            <span>{formatMessageTimestamp(message.timestamp)}</span>
            
            {/* Tooltip content */}
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover/tooltip:block bg-popover border text-popover-foreground text-[10px] rounded px-2 py-1 shadow-md whitespace-nowrap z-50">
              {new Date(message.timestamp).toLocaleDateString('en-US', { dateStyle: 'medium' })}, {new Date(message.timestamp).toLocaleTimeString('en-US', { timeStyle: 'short' })} — {isUser ? 'you' : 'assistant'}
            </div>
          </div>

          {/* Right section: Pagination & Actions */}
          <div className="flex items-center gap-2">
            {/* Version Pagination */}
            {message.versions && message.versions.length > 1 && (
              <div className="flex items-center gap-1 bg-muted/55 border rounded px-1.5 py-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-muted"
                  disabled={activeVersionIdx === 0}
                  onClick={() => onSwitchVersion?.(message.id, activeVersionIdx - 1)}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-[10px] font-mono px-1 select-none">
                  {activeVersionIdx + 1} / {message.versions.length}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-muted"
                  disabled={activeVersionIdx === message.versions.length - 1}
                  onClick={() => onSwitchVersion?.(message.id, activeVersionIdx + 1)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-0.5 relative">
              {/* Scroll down button */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  const chatContainer = document.querySelector('.overflow-y-auto');
                  if (chatContainer) {
                    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
                  }
                }}
                title="Scroll to bottom"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>

              {/* Copy Message */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleCopy}
                title="Copy message"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>

              {/* Edit Message (User only) */}
              {onEdit && isUser && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setIsEditing(true)}
                  title="Edit message"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* Regenerate Message */}
              {onRegenerate && (
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleRegenerateClick}
                    title={isUser ? "Regenerate next response" : "Regenerate this response"}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                  
                  {showModelSelector && isAssistant && (
                    <div className="absolute right-0 bottom-8 z-50 min-w-[220px] max-w-[280px] rounded-md border bg-popover shadow-lg max-h-[300px] overflow-y-auto">
                      <div className="p-2">
                        <div className="text-xs font-semibold mb-2 px-2 text-muted-foreground">
                          Regenerate with:
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full justify-start text-left mb-2 text-xs"
                          onClick={() => {
                            onRegenerate(message.id);
                            setShowModelSelector(false);
                          }}
                        >
                          <RotateCw className="h-3 w-3 mr-2 shrink-0" />
                          <span className="truncate">
                            Current: {currentModel ? getModelDisplayName(currentModel) : 'Default'}
                          </span>
                        </Button>
                        
                        <div className="h-px bg-border my-2" />
                        
                        {groupedModels.map((group) => (
                          <div key={group.label} className="mt-1">
                            <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase tracking-wider">
                              {group.label}
                            </div>
                            {group.models
                              .filter(m => m.key !== currentModel)
                              .map((model) => (
                                <Button
                                  key={model.key}
                                  size="sm"
                                  variant="ghost"
                                  className="w-full justify-start text-left text-xs py-1 h-7"
                                  onClick={() => {
                                    onRegenerate(message.id, model.key);
                                    setShowModelSelector(false);
                                  }}
                                >
                                  <span className="truncate">{model.name}</span>
                                </Button>
                              ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Delete Message */}
              {onDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(message.id)}
                  title="Delete message"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
