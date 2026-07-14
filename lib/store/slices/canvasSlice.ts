import { StateCreator } from 'zustand';
import { RendererType } from '@/types';
import { UIState } from '../ui-store';

export interface CanvasSlice {
  showArtifact: boolean;
  isArtifactFullscreen: boolean;
  artifactMode: 'standard' | 'wide';
  p5Code: string;
  editableCode: string;
  activeRenderer: RendererType;
  activeTab: 'preview' | 'code' | 'diff';
  previousCode: string;
  copied: boolean;
  activeVersionNumber: number | null;
  isVersionDropdownOpen: boolean;
  zoom: number;
  pan: { x: number; y: number };
  panMode: boolean;
  isTrueFullscreen: boolean;
  isPlaying: boolean;

  setShowArtifact: (show: boolean) => void;
  setIsArtifactFullscreen: (fs: boolean) => void;
  setArtifactMode: (mode: CanvasSlice['artifactMode']) => void;
  setP5Code: (code: string) => void;
  setEditableCode: (code: string) => void;
  setActiveRenderer: (renderer: RendererType) => void;
  setActiveTab: (tab: CanvasSlice['activeTab']) => void;
  setPreviousCode: (code: string) => void;
  setActiveVersionNumber: (n: number | null) => void;
  setZoom: (updater: ((prev: number) => number) | number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setPanMode: (mode: boolean) => void;
  setIsTrueFullscreen: (fs: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
}

export const createCanvasSlice: StateCreator<UIState, [], [], CanvasSlice> = (set) => ({
  showArtifact: false,
  isArtifactFullscreen: false,
  artifactMode: 'standard',
  p5Code: '',
  editableCode: '',
  activeRenderer: 'p5',
  activeTab: 'preview',
  previousCode: '',
  copied: false,
  activeVersionNumber: null,
  isVersionDropdownOpen: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  panMode: false,
  isTrueFullscreen: false,
  isPlaying: false,

  setShowArtifact: (show) => set({ showArtifact: show }),
  setIsArtifactFullscreen: (fs) => set({ isArtifactFullscreen: fs, artifactMode: fs ? 'wide' : 'standard' }),
  setArtifactMode: (mode) => set({ artifactMode: mode, isArtifactFullscreen: mode === 'wide' }),
  setP5Code: (code) => set({ p5Code: code }),
  setEditableCode: (code) => set({ editableCode: code }),
  setActiveRenderer: (renderer) => set({ activeRenderer: renderer }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPreviousCode: (code) => set({ previousCode: code }),
  setActiveVersionNumber: (n) => set({ activeVersionNumber: n }),
  setZoom: (updater) =>
    set((s) => ({
      zoom: typeof updater === 'function'
        ? Math.max(0.25, Math.min(updater(s.zoom), 4))
        : Math.max(0.25, Math.min(updater, 4)),
    })),
  setPan: (pan) => set({ pan }),
  setPanMode: (mode) => set({ panMode: mode }),
  setIsTrueFullscreen: (fs) => set({ isTrueFullscreen: fs }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
});
