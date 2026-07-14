'use client';

import React from 'react';
import { X, Settings2, Key, Palette, Shield, Download, Upload, Sparkles, Sun, Moon, Laptop, AlertTriangle, Bot, Brain, Cpu, Zap, Waves, Globe, Home } from 'lucide-react';
import { Modal, ModalHeader, ModalContent } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useSettingsStore } from '@/lib/store/settings-store';
import { useChatStore } from '@/lib/store/chat-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useToast } from '@/lib/store/toast-store';
import { cn } from '@/lib/utils';
import { PRESET_PROVIDERS } from '@/config/deftorch-presets';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'general' | 'appearance' | 'privacy' | 'developer';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = React.useState<TabType>('general');
  const [clearDataModalOpen, setClearDataModalOpen] = React.useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [importData, setImportData] = React.useState<any>(null);
  const [providerInputs, setProviderInputs] = React.useState<Record<string, string>>({});
  const { preferences, apiKeys, updatePreferences, setTheme, addAPIKey, removeAPIKey, getAPIKey } = useSettingsStore();
  const { chats, importChats } = useChatStore();
  const { session, signOut } = useAuthStore();
  const { success, error } = useToast();

  const tabs = [
    { id: 'general' as TabType, label: 'General', icon: Settings2 },
    { id: 'appearance' as TabType, label: 'Appearance', icon: Palette },
    { id: 'privacy' as TabType, label: 'Data & Privacy', icon: Shield },
    { id: 'developer' as TabType, label: 'Developer', icon: Key },
  ];

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setTheme(theme);
    success('Theme Updated', `Theme changed to ${theme}`);
  };

  const handleDeleteAccount = async () => {
    if (!session?.access_token) return;
    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        error('Gagal menghapus akun', body.error || `Server merespons ${res.status}`);
        return;
      }
      if (body.warning) {
        // Account is already gone at this point — surface the storage
        // cleanup warning but don't block sign-out on it.
        error('Sebagian pembersihan gagal', body.warning);
      }
      // Cloud data + auth.users row are gone server-side. Local
      // localStorage state (chats/settings the client hasn't synced, or
      // deliberately kept offline) is a separate concern from account
      // deletion — mirrors "Clear All Data" above, which is its own
      // explicit action, not bundled silently into this one.
      await signOut();
      window.location.reload();
    } catch (err) {
      error('Gagal menghapus akun', err instanceof Error ? err.message : 'Terjadi kesalahan tak terduga.');
    } finally {
      setIsDeletingAccount(false);
      setDeleteAccountModalOpen(false);
    }
  };

  const handleExportData = () => {
    try {
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        chats: chats,
        settings: preferences,
        apiKeys: apiKeys.map(key => ({ ...key, key: '***REDACTED***' })), // Don't export actual keys
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `chatbot-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Data Exported', 'Your data has been downloaded successfully');
    } catch (err) {
      error('Export Failed', 'Failed to export your data. Please try again.');
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validate data structure
        if (!data.version || !data.chats || !data.settings) {
          error('Invalid File', 'The file format is not recognized. Please use a valid backup file.');
          return;
        }

        // Store data and show confirmation modal
        setImportData(data);
        setImportModalOpen(true);
      } catch (err) {
        error('Import Failed', 'Failed to read the file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const handleConfirmImport = () => {
    try {
      if (!importData) return;

      // Import chats
      if (importData.chats && Array.isArray(importData.chats)) {
        importChats(importData.chats);
      }

      // Import settings (excluding API keys for security)
      if (importData.settings) {
        const { theme, autoSave, showTokenCount, enableNotifications } = importData.settings;
        updatePreferences({
          theme: theme || 'system',
          autoSave: autoSave !== undefined ? autoSave : true,
          showTokenCount: showTokenCount !== undefined ? showTokenCount : false,
          enableNotifications: enableNotifications !== undefined ? enableNotifications : true,
        });
      }

      setImportModalOpen(false);
      setImportData(null);
      success('Import Successful', `Imported ${importData.chats?.length || 0} chat(s) successfully!`);
      
      // Reload to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      error('Import Failed', 'An error occurred during import. Please try again.');
    }
  };

  const handleSaveApiKey = (providerId: string) => {
    const key = providerInputs[providerId];
    if (!key || !key.trim()) {
      error('Invalid Key', 'Please enter a valid API key.');
      return;
    }
    addAPIKey({
      provider: providerId,
      key: key.trim(),
      isActive: true
    });
    setProviderInputs(prev => ({ ...prev, [providerId]: '' }));
    success('API Key Saved', `${PRESET_PROVIDERS.find(p => p.id === providerId)?.name} API Key has been configured successfully.`);
  };

  const handleDeleteApiKey = (providerId: string) => {
    removeAPIKey(providerId);
    setProviderInputs(prev => ({ ...prev, [providerId]: '' }));
    success('API Key Removed', `${PRESET_PROVIDERS.find(p => p.id === providerId)?.name} API Key has been removed.`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-full max-w-4xl">
      <ModalHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
      </ModalHeader>

      <div className="flex flex-col md:flex-row min-h-[500px]">
        {/* Tabs Sidebar */}
        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r p-4 flex md:flex-col gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                activeTab === tab.id ? 'bg-accent' : 'hover:bg-muted',
                'md:w-full'
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">General Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto-save chats</div>
                      <div className="text-sm text-muted-foreground">
                        Automatically save your chat history
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.autoSave}
                        onChange={(e) =>
                          updatePreferences({ autoSave: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>



                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Enable notifications</div>
                      <div className="text-sm text-muted-foreground">
                        Get notified about important updates
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.enableNotifications}
                        onChange={(e) =>
                          updatePreferences({ enableNotifications: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Default System Instruction
                    </label>
                    <textarea
                      value={preferences.defaultSystemInstruction || ''}
                      onChange={(e) => updatePreferences({ defaultSystemInstruction: e.target.value })}
                      placeholder="You are Deftorch, a powerful agentic orchestration AI..."
                      className="w-full h-32 px-4 py-3 bg-white dark:bg-[#1a1b2e] text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-700 resize-y"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      This instruction acts as the base persona/rules for all chats unless a specific Agent with its own instruction is selected. Leave empty to use the built-in defaults.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Appearance</h3>
                
                <div className="space-y-6">
                  {/* Theme Selection */}
                  <div>
                    <label className="font-medium block mb-3">Theme</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      {(['light', 'dark', 'system'] as const).map((theme) => (
                        <button
                          key={theme}
                          onClick={() => handleThemeChange(theme)}
                          className={cn(
                            'p-3 border-2 rounded-lg capitalize transition-all',
                            'hover:scale-105 active:scale-95',
                            preferences.theme === theme
                              ? 'border-primary bg-primary/10 shadow-md'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-all duration-300",
                              theme === 'light' && "bg-white border border-gray-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
                              theme === 'dark' && "bg-[#0b0c14] border border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]",
                              theme === 'system' && "bg-gradient-to-b from-[#4a5568] to-[#1a202c] border border-gray-700/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                            )}>
                              {theme === 'light' && <Sun className="h-5 w-5 text-amber-500 fill-amber-400 animate-[spin_24s_linear_infinite]" strokeWidth={2.2} />}
                              {theme === 'dark' && <Moon className="h-5 w-5 text-amber-400 fill-amber-300 -rotate-12 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]" strokeWidth={2.2} />}
                              {theme === 'system' && <Laptop className="h-5 w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" strokeWidth={2.2} />}
                            </div>
                            <span className="text-xs font-medium">{theme}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="font-medium block mb-3">Font Size</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => {
                            updatePreferences({ fontSize: size });
                            success('Font Size Updated', `Font size changed to ${size}`);
                          }}
                          className={cn(
                            'p-4 border-2 rounded-lg capitalize transition-all',
                            'hover:scale-105 active:scale-95',
                            preferences.fontSize === size
                              ? 'border-primary bg-primary/10 shadow-md'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className={cn(
                              "font-bold",
                              size === 'small' && "text-sm",
                              size === 'medium' && "text-base",
                              size === 'large' && "text-lg"
                            )}>
                              Aa
                            </div>
                            <span className="text-xs font-medium">{size}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Changes apply immediately to all text in the application
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Data & Privacy</h3>
                
                <div className="space-y-4">
                  {/* Storage Info */}
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="font-medium mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Local Storage
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      All your chats, settings, and API keys are stored locally in your browser.
                      No data is sent to external servers except AI API calls.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Encrypted</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Private</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span>Offline Ready</span>
                      </div>
                    </div>
                  </div>

                  {/* Export & Import Data */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <div className="font-medium mb-2 flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export Your Data
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Download all your chats and settings as a JSON file. API keys will be redacted for security.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleExportData}>
                          <Download className="h-4 w-4 mr-2" />
                          Export Data
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {chats.length} chat{chats.length !== 1 ? 's' : ''} ready
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="font-medium mb-2 flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Import Data
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Restore your chats and settings from a backup file.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => document.getElementById('import-file')?.click()}>
                          <Upload className="h-4 w-4 mr-2" />
                          Import Data
                        </Button>
                        <input
                          id="import-file"
                          type="file"
                          accept=".json"
                          onChange={handleImportData}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="border-2 border-destructive/20 rounded-lg p-4 bg-destructive/5">
                    <div className="font-medium mb-2 text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Danger Zone
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will permanently delete all your chats, settings, and API keys.
                      This action cannot be undone.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={() => setClearDataModalOpen(true)}
                    >
                      Clear All Data
                    </Button>

                    {session && (
                      <div className="mt-4 pt-4 border-t border-destructive/20">
                        <p className="text-sm text-muted-foreground mb-3">
                          Menghapus akun juga menghapus seluruh data cloud kamu secara permanen:
                          chat, agent custom, workflow, dan file yang sudah diupload (video/audio/dokumen).
                          Aksi ini tidak bisa dibatalkan.
                        </p>
                        <Button
                          variant="destructive"
                          onClick={() => setDeleteAccountModalOpen(true)}
                        >
                          Delete My Account
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Developer Tab */}
          {activeTab === 'developer' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Developer Settings</h3>
                
                <div className="space-y-6">
                  {/* Developer Mode Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Developer Mode</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Unlock model selection, custom API keys, and code inspection tools.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.developerMode || false}
                        onChange={(e) => {
                          updatePreferences({ developerMode: e.target.checked });
                          success(
                            e.target.checked ? 'Developer Mode Enabled' : 'Developer Mode Disabled',
                            e.target.checked ? 'Advanced features unlocked.' : 'Simplified mode activated.'
                          );
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* API Key Configurations */}
                  {(preferences.developerMode) && (
                    <div className="space-y-4">
                      {PRESET_PROVIDERS.map((provider) => {
                        const activeKey = getAPIKey(provider.id)?.key;
                        
                        return (
                          <div key={provider.id} className="border rounded-xl p-4 bg-muted/20 border-gray-200 dark:border-white/10">
                            <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white mb-2">
                              <span>
                                {provider.id === 'google' && <Sparkles className="h-5 w-5 text-blue-500" />}
                                {provider.id === 'openai' && <Brain className="h-5 w-5 text-green-500" />}
                                {provider.id === 'anthropic' && <Cpu className="h-5 w-5 text-purple-500" />}
                                {provider.id === 'groq' && <Zap className="h-5 w-5 text-orange-500" />}
                                {provider.id === 'deepseek' && <Waves className="h-5 w-5 text-blue-400" />}
                                {provider.id === 'openrouter' && <Globe className="h-5 w-5 text-indigo-400" />}
                                {provider.id === 'ollama' && <Home className="h-5 w-5 text-gray-500" />}
                                {['google', 'openai', 'anthropic', 'groq', 'deepseek', 'openrouter', 'ollama'].indexOf(provider.id) === -1 && <Bot className="h-5 w-5 text-gray-400" />}
                              </span>
                              {provider.name} API Key
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                              {provider.description}. This key will be stored locally.
                            </p>
                            
                            <div className="flex gap-2">
                              <Input
                                type="password"
                                placeholder={
                                  activeKey
                                    ? "••••••••••••••••••••••••••••••••••••" 
                                    : `Enter ${provider.name} API Key`
                                }
                                value={providerInputs[provider.id] || ''}
                                onChange={(e) => setProviderInputs(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                className="font-mono text-sm"
                              />
                              <Button 
                                onClick={() => handleSaveApiKey(provider.id)}
                                className="bg-[#1a6adf] hover:bg-[#1a6adf]/90 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100"
                              >
                                Save
                              </Button>
                              {activeKey && (
                                <Button 
                                  variant="destructive" 
                                  onClick={() => handleDeleteApiKey(provider.id)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                            
                            {activeKey && (
                              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 mt-3">
                                <span className="font-mono truncate mr-2">
                                  Active Key: {activeKey.slice(0, 4)}...{activeKey.slice(-4)}
                                </span>
                                <span className="flex items-center gap-1 font-semibold flex-shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                  Active
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      <div className="flex items-center justify-between border-t border-gray-200 dark:border-white/10 pt-4 mt-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Show Token Count</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Display exact token usage per message to monitor API consumption.
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences.showTokenCount || false}
                            onChange={(e) =>
                              updatePreferences({ showTokenCount: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clear Data Confirmation Modal */}
      <ConfirmModal
        isOpen={clearDataModalOpen}
        onClose={() => setClearDataModalOpen(false)}
        onConfirm={() => {
          localStorage.clear();
          window.location.reload();
        }}
        title="Clear All Data"
        message="Are you sure you want to delete all your chats, settings, and API keys? This action cannot be undone and you will lose all your data permanently."
        confirmText="Yes, Delete Everything"
        cancelText="Cancel"
        variant="danger"
        icon="warning"
      />

      {/* Delete Account Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete My Account"
        message={
          isDeletingAccount
            ? 'Menghapus akun...'
            : 'Ini akan menghapus akun kamu dan SELURUH data cloud (chat, agent, workflow, file upload) secara permanen. Tindakan ini tidak bisa dibatalkan. Lanjutkan?'
        }
        confirmText={isDeletingAccount ? 'Menghapus...' : 'Ya, Hapus Akun Saya'}
        cancelText="Batal"
        variant="danger"
        icon="delete"
      />

      {/* Import Data Confirmation Modal */}
      <ConfirmModal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportData(null);
        }}
        onConfirm={handleConfirmImport}
        title="Import Data"
        message={`You are about to import ${importData?.chats?.length || 0} chat(s) and settings. This will merge with your existing data. Do you want to continue?`}
        confirmText="Yes, Import Data"
        cancelText="Cancel"
        variant="info"
        icon="info"
      />
    </Modal>
  );
};
