import { StateCreator } from 'zustand';
import { ImageAttachment } from '@/types';
import { UIState } from '../ui-store';

export interface InputSlice {
  inputMessage: string;
  attachedImages: ImageAttachment[];

  setInputMessage: (msg: string) => void;
  setAttachedImages: (images: ImageAttachment[] | ((prev: ImageAttachment[]) => ImageAttachment[])) => void;
  removeAttachedImage: (id: string) => void;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  annotatingImage: ImageAttachment | null;
  setAnnotatingImage: (img: ImageAttachment | null) => void;
  updateAttachedImage: (id: string, updates: Partial<ImageAttachment>) => void;
}

export const createInputSlice: StateCreator<UIState, [], [], InputSlice> = (set) => ({
  inputMessage: '',
  attachedImages: [],
  editingMessageId: null,

  setInputMessage: (msg) => set({ inputMessage: msg }),
  setEditingMessageId: (id) => set({ editingMessageId: id }),
  setAttachedImages: (images) =>
    set((state) => ({
      attachedImages:
        typeof images === 'function' ? images(state.attachedImages) : images,
    })),
  removeAttachedImage: (id) =>
    set((state) => ({
      attachedImages: state.attachedImages.filter((img) => img.id !== id),
    })),
  annotatingImage: null,
  setAnnotatingImage: (img) => set({ annotatingImage: img }),
  updateAttachedImage: (id, updates) =>
    set((state) => ({
      attachedImages: state.attachedImages.map((img) =>
        img.id === id ? { ...img, ...updates } : img
      ),
    })),
});
