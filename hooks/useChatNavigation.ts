import { useUIStore } from '@/lib/store/ui-store';
import { useChatStore } from '@/lib/store/chat-store';
import { extractCode } from '@/lib/extract-code';

export function useChatNavigation() {
  const ui = useUIStore();
  const chatStore = useChatStore();

  const startNewChat = (chatInputRef?: React.RefObject<HTMLTextAreaElement | null>) => {
    ui.resetForNewChat();
    setTimeout(() => chatInputRef?.current?.focus(), 50);
  };

  const selectChat = (chatId: string, shouldShowArtifact = false) => {
    const chat = chatStore.chats.find((c) => c.id === chatId);
    if (!chat) return;

    ui.setActiveChatId(chatId);
    ui.setCurrentView('chat');

    let hasCode = false;
    for (const msg of chat.messages) {
      if (msg.role === 'assistant' && extractCode(msg.content)) {
        hasCode = true;
        break;
      }
    }

    ui.setShowArtifact(hasCode ? shouldShowArtifact : false);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      ui.setSidebarOpen(false);
    }
  };

  const loadArtifactCode = (artifact: any) => {
    selectChat(artifact.chatId, true);
    ui.setActiveTab('preview');
  };

  const openGallery = () => {
    ui.setCurrentView('gallery');
    ui.setShowArtifact(false);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      ui.setSidebarOpen(false);
    }
  };

  const deleteChat = (chatId: string) => {
    chatStore.deleteChat(chatId);
    if (ui.activeChatId === chatId) {
      startNewChat();
    }
  };

  return {
    startNewChat,
    selectChat,
    loadArtifactCode,
    openGallery,
    deleteChat,
  };
}
