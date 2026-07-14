import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useToast } from '@/lib/store/toast-store';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: any[];
  isLoading: boolean;
  regeneratingId: string | null;
  onRegenerate: (messageId: string) => void;
  onSwitchVersionIdx: (messageId: string, idx: number) => void;
  codeVersions: any[];
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  regeneratingId,
  onRegenerate,
  onSwitchVersionIdx,
  codeVersions,
}) => {

  const chatStore = useChatStore();
  const ui = useUIStore();
  const { toast } = useToast();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to Clipboard',
      description: 'Text copied successfully.',
    });
  };


  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Start creating</h2>
          <p className="text-gray-600">Describe what you want to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto w-full">
      {messages.map((msg, index) => {
        const isUser = msg.type === 'user';
        const currentChat = ui.activeChatId
          ? chatStore.chats.find((c) => c.id === ui.activeChatId)
          : null;
        // activeChatId is stored in useUIStore, not chatStore
        const storeMessage = currentChat?.messages[index];
        const activeVersionIdx = storeMessage?.activeVersionIdx !== undefined ? storeMessage.activeVersionIdx : 0;
        
        return (
          <MessageItem
            key={index}
            msg={msg}
            index={index}
            isUser={isUser}
            storeMessage={storeMessage}
            activeVersionIdx={activeVersionIdx}
            onSwitchVersionIdx={onSwitchVersionIdx}
            handleCopyText={handleCopyText}
            isLoading={isLoading}
            onRegenerate={onRegenerate}
            regeneratingId={regeneratingId}
            codeVersions={codeVersions}
          />
        );
      })}
      
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-1">
                <div className="w-2 h-2 bg-[#1a6adf] dark:bg-[#60aaff] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-[#1a6adf] dark:bg-[#60aaff] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-[#1a6adf] dark:bg-[#60aaff] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <LoadingPhrase />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

const loadingPhrases = [
  'Analyzing request...',
  'Gathering context...',
  'Formulating solution...',
  'Writing code...',
  'Rendering visuals...',
  'Finalizing details...'
];

const LoadingPhrase = () => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % loadingPhrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-5 overflow-hidden w-40">
      {loadingPhrases.map((phrase, i) => (
        <span
          key={i}
          className={`absolute top-0 left-0 text-gray-600 dark:text-gray-400 text-sm font-medium transition-all duration-500 w-full whitespace-nowrap ${
            i === idx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {phrase}
        </span>
      ))}
    </div>
  );
};
