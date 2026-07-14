'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from '@/components/ui/toast';
import { useToastStore } from '@/lib/store/toast-store';
import { useSettingsStore } from '@/lib/store/settings-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const { preferences } = useSettingsStore();

  // Apply theme changes
  React.useEffect(() => {
    const theme = preferences.theme;
    const root = document.documentElement;

    // Remove all theme classes first
    root.classList.remove('dark');

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = () => {
        root.classList.toggle('dark', mediaQuery.matches);
      };
      updateTheme();
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    } else if (theme === 'dark') {
      root.classList.add('dark');
    }
  }, [preferences.theme]);

  // Apply font size changes
  React.useEffect(() => {
    const root = document.documentElement;
    // Remove all font size classes
    root.classList.remove('font-small', 'font-medium', 'font-large');
    // Add selected font size class
    root.classList.add(`font-${preferences.fontSize}`);
  }, [preferences.fontSize]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastContainer
        toasts={toasts.map((toast) => ({
          ...toast,
          onClose: () => removeToast(toast.id),
        }))}
      />
    </QueryClientProvider>
  );
}
