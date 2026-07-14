import { StateCreator } from 'zustand';
import { UIState } from '../ui-store';

export interface ViewSlice {
  sidebarOpen: boolean;
  currentView: 'home' | 'chat' | 'chats' | 'gallery' | 'projects' | 'agents' | 'workflows' | 'models' | 'analysis' | 'debug';
  activeChatId: string | null;
  activeProjectId: string | null;

  setSidebarOpen: (open: boolean) => void;
  setCurrentView: (view: ViewSlice['currentView']) => void;
  setActiveChatId: (id: string | null) => void;
  setActiveProjectId: (id: string | null) => void;

  resetForNewChat: () => void;
}

export const createViewSlice: StateCreator<UIState, [], [], ViewSlice> = (set) => ({
  sidebarOpen: false,
  currentView: 'home',
  activeChatId: null,
  activeProjectId: null,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCurrentView: (view) => set({ currentView: view }),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),

  resetForNewChat: () =>
    set({
      currentView: 'home',
      activeChatId: null,
      p5Code: '',
      editableCode: '',
      previousCode: '',
      showArtifact: false,
      isArtifactFullscreen: false,
      artifactMode: 'standard',
      activeVersionNumber: null,
      inputMessage: '',
      attachedImages: [],
    }),
});
