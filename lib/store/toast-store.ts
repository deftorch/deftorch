import { create } from 'zustand';

interface ToastStore {
  toasts: Array<{
    id: string;
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }>;
  
  addToast: (toast: Omit<ToastStore['toasts'][0], 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  
  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Hook untuk memudahkan penggunaan
export const useToast = () => {
  const { addToast } = useToastStore();
  
  return {
    toast: addToast,
    success: (title: string, description?: string) =>
      addToast({ title, description, variant: 'default' }),
    error: (title: string, description?: string) =>
      addToast({ title, description, variant: 'destructive' }),
  };
};
