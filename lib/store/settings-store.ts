import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserPreferences, APIKeyConfig } from '@/types';
import { syncUpsertPreferences, pullPreferences } from '@/lib/sync/settings-sync';

interface SettingsStore {
  preferences: UserPreferences;
  apiKeys: APIKeyConfig[];
  
  // Preferences actions
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  pullPreferencesFromSupabase: () => Promise<void>;
  
  // API Keys actions
  addAPIKey: (config: APIKeyConfig) => void;
  updateAPIKey: (provider: string, config: Partial<APIKeyConfig>) => void;
  removeAPIKey: (provider: string) => void;
  getAPIKey: (provider: string) => APIKeyConfig | undefined;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  defaultModel: 'gemini-3-flash',
  defaultProvider: 'google',
  fontSize: 'medium',
  autoSave: true,
  showTokenCount: false,
  enableNotifications: true,
  developerMode: false,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,
      apiKeys: [],

      updatePreferences: (newPreferences) => {
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        }));

        syncUpsertPreferences(get().preferences);
      },

      setTheme: (theme) => {
        set((state) => ({
          preferences: { ...state.preferences, theme },
        }));
        
        // Apply theme to document
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        syncUpsertPreferences(get().preferences);
      },

      pullPreferencesFromSupabase: async () => {
        const remote = await pullPreferences();
        if (!remote) return;
        set((state) => ({ preferences: { ...state.preferences, ...remote } }));
      },

      addAPIKey: (config) => {
        set((state) => ({
          apiKeys: [...state.apiKeys.filter((k) => k.provider !== config.provider), config],
        }));
      },

      updateAPIKey: (provider, config) => {
        set((state) => ({
          apiKeys: state.apiKeys.map((key) =>
            key.provider === provider ? { ...key, ...config } : key
          ),
        }));
      },

      removeAPIKey: (provider) => {
        set((state) => ({
          apiKeys: state.apiKeys.filter((key) => key.provider !== provider),
        }));
      },

      getAPIKey: (provider) => {
        const state = get();
        return state.apiKeys.find((key) => key.provider === provider && key.isActive);
      },
    }),
    {
      name: 'settings-storage',
    }
  )
);
