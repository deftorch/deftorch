import { StateCreator } from 'zustand';
import { UIState } from '../ui-store';

export interface ModalSlice {
  isMobileTemplatesOpen: boolean;
  showMobileChatInput: boolean;
  isSettingsOpen: boolean;
  isUpgradeModalOpen: boolean;
  isAuthModalOpen: boolean;
  isCreateProjectOpen: boolean;
  isMoveToProjectOpen: boolean;
  movingChatId: string | null;
  chatMenuOpenId: string | null;

  setIsMobileTemplatesOpen: (open: boolean) => void;
  setShowMobileChatInput: (show: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsUpgradeModalOpen: (open: boolean) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  setChatMenuOpenId: (id: string | null) => void;
  setMovingChatId: (id: string | null) => void;
  setIsMoveToProjectOpen: (open: boolean) => void;
  setIsCreateProjectOpen: (open: boolean) => void;
}

export const createModalSlice: StateCreator<UIState, [], [], ModalSlice> = (set) => ({
  isMobileTemplatesOpen: false,
  showMobileChatInput: false,
  isSettingsOpen: false,
  isUpgradeModalOpen: false,
  isAuthModalOpen: false,
  isCreateProjectOpen: false,
  isMoveToProjectOpen: false,
  movingChatId: null,
  chatMenuOpenId: null,

  setIsMobileTemplatesOpen: (open) => set({ isMobileTemplatesOpen: open }),
  setShowMobileChatInput: (show) => set({ showMobileChatInput: show }),
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setIsUpgradeModalOpen: (open) => set({ isUpgradeModalOpen: open }),
  setIsAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
  setChatMenuOpenId: (id) => set({ chatMenuOpenId: id }),
  setMovingChatId: (id) => set({ movingChatId: id }),
  setIsMoveToProjectOpen: (open) => set({ isMoveToProjectOpen: open }),
  setIsCreateProjectOpen: (open) => set({ isCreateProjectOpen: open }),
});
