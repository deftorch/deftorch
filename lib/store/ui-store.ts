import { create } from 'zustand';
import { ViewSlice, createViewSlice } from './slices/viewSlice';
import { CanvasSlice, createCanvasSlice } from './slices/canvasSlice';
import { ModalSlice, createModalSlice } from './slices/modalSlice';
import { InputSlice, createInputSlice } from './slices/inputSlice';

export type UIState = ViewSlice & CanvasSlice & ModalSlice & InputSlice;

export const useUIStore = create<UIState>((...a) => ({
  ...createViewSlice(...a),
  ...createCanvasSlice(...a),
  ...createModalSlice(...a),
  ...createInputSlice(...a),
}));
