'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import { useChatStore } from '@/lib/store/chat-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { useToast } from '@/lib/store/toast-store';
import { useUIStore } from '@/lib/store/ui-store';

import { AppShell } from '@/components/layout/AppShell';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ArtifactPanel } from '@/components/artifact/ArtifactPanel';

import { SettingsModal } from '@/components/settings/SettingsModal';
import { UpgradeModal } from '@/components/settings/UpgradeModal';
import { AuthModal } from '@/components/settings/AuthModal';
import { ImageAnnotator } from '@/components/image/ImageAnnotator';
import { useAuthStore } from '@/lib/store/auth-store';
import { startRealtimeSync, stopRealtimeSync } from '@/lib/sync/realtime';

import { useChatSubmit } from '@/hooks/useChatSubmit';
import { useVersionHistory } from '@/hooks/useVersionHistory';
import { useArtifactManager } from '@/hooks/useArtifactManager';

import { extractCode } from '@/lib/extract-code';
import { parseSSEStream } from '@/lib/sse-parser';
import { AIModel, ImageAttachment, RendererType } from '@/types';
import { FILE_UPLOAD_CONFIG, MEDIA_LIMITS } from '@/config/constants';
import { useMediaUpload, MediaUploadAuthRequiredError } from '@/hooks/useMediaUpload';

const GenesisApp = () => {
  const chatStore = useChatStore();
  const ui = useUIStore();
  const { preferences, pullPreferencesFromSupabase } = useSettingsStore();
  const { toast } = useToast();
  const authInit = useAuthStore((s) => s.init);
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const authSession = useAuthStore((s) => s.session);

  const [messages, setMessages] = useState<
    { type: string; content: string; images?: string[] }[]
  >([]);

  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini-3-flash');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { uploadFile } = useMediaUpload();
  const [isUploading, setIsUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);



  // Subscribe to Supabase auth state for the lifetime of the app shell.
  useEffect(() => {
    const unsubscribe = authInit();
    return unsubscribe;
  }, [authInit]);

  // One-time localStorage -> Supabase migration (first sign-in only),
  // then always pull server state so chats/projects reflect what's on
  // the account — covers both "just migrated" and "signed in on a
  // browser that already has server data from another device".
  useEffect(() => {
    if (authStatus !== 'authenticated' || !authUser) return;
    if (typeof window === 'undefined') return;

    (async () => {
      const alreadyMigrated = localStorage.getItem('deftorch-migrated') === 'true';

      if (!alreadyMigrated) {
        try {
          const payload = {
            chats: chatStore.chats,
            projects: chatStore.projects,
            agents: chatStore.agents.filter((a) => a.isCustom),
            compositeModels: chatStore.compositeModels.filter((m) => m.isCustom),
            workflows: chatStore.workflows,
            preferences,
          };
          const res = await fetch('/api/migrate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authSession?.access_token
                ? { Authorization: `Bearer ${authSession.access_token}` }
                : {}),
            },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            localStorage.setItem('deftorch-migrated', 'true');
            toast({ title: 'Tersinkron', description: 'Data lokal berhasil disinkronkan ke akunmu.' });
          }
        } catch {
          // Migration is best-effort; local data stays intact either way,
          // so a failed attempt just gets retried on next sign-in.
        }
      }

      // Pull after migrate (or immediately if already migrated) so this
      // browser reflects the account's current server-side state —
      // including chats created from other devices.
      await chatStore.pullFromSupabase();
      await chatStore.pullLibraryFromSupabase();
      await pullPreferencesFromSupabase();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, authUser, authSession]);

  // Realtime: live chat/message updates from other tabs/devices while
  // signed in. Started only after the initial pull above has a chance to
  // run (same authStatus/authUser deps) — starting earlier would just
  // mean a few missed events before the first pull catches up anyway, so
  // ordering here isn't strict, but doing it after keeps startRealtimeSync
  // conceptually a "keep me in sync going forward" step rather than the
  // thing responsible for the initial data load too.
  useEffect(() => {
    if (authStatus === 'authenticated' && authUser) {
      startRealtimeSync(authUser.id);
    } else {
      stopRealtimeSync();
    }
    return () => stopRealtimeSync();
  }, [authStatus, authUser]);

  // Hydration guard + seed dummy data / migration logic on mount
  useEffect(() => {
    setHydrated(true);

    if (typeof window !== 'undefined') {
      try {
        const oldStored = localStorage.getItem('genesis-artifacts');
        if (oldStored) {
          const parsed = JSON.parse(oldStored);
          if (parsed && parsed.length > 0) {
            parsed.forEach((art: any) => {
              const exists = chatStore.artifacts.some(
                (a) => a.chatId === art.chatId && a.renderer === art.renderer
              );
              if (!exists) {
                chatStore.addArtifact({
                  chatId: art.chatId,
                  chatTitle: art.chatTitle,
                  code: art.code,
                  renderer: art.renderer,
                });
              }
            });
            localStorage.removeItem('genesis-artifacts');
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }, [chatStore]);

  // Synchronize local messages state automatically when activeChatId or chatStore.chats change
  useEffect(() => {
    if (ui.activeChatId) {
      const chat = chatStore.chats.find((c) => c.id === ui.activeChatId);
      if (chat) {
        const loaded = chat.messages.map((msg) => ({
          type: msg.role === 'user' ? 'user' : 'ai',
          content: msg.content,
          images: msg.images?.map((img) => img.url),
        }));
        setMessages(loaded);

        if (chat.modelConfig?.model) {
          setSelectedModel(chat.modelConfig.model as AIModel);
        }
        setSelectedAgent(chat.agentId || null);
      } else {
        setMessages([]);
        setSelectedAgent(null);
      }
    } else {
      setMessages([]);
      setSelectedAgent(null);
    }
  }, [ui.activeChatId, chatStore.chats]);

  // Track code versions from history
  const { codeVersions } = useVersionHistory(messages);



  // Chat Submission hooks
  const { submit: chatSubmit, isLoading, stopGeneration, regeneratingId, handleRegenerateFrom } = useChatSubmit({
    chatId: ui.activeChatId,
    selectedModel,
    selectedAgent,
  });

  const onSendMessage = async (customPrompt?: string) => {
    const text = customPrompt || ui.inputMessage;
    if (!text.trim() && ui.attachedImages.length === 0) return;

    const stillUploading = ui.attachedImages.some((img) => img.uploadStatus === 'uploading');
    if (stillUploading) {
      toast({
        title: 'Tunggu sebentar',
        description: 'Masih ada file yang sedang diunggah.',
        variant: 'destructive',
      });
      return;
    }
    const failedUploads = ui.attachedImages.filter((img) => img.uploadStatus === 'error');
    if (failedUploads.length > 0) {
      toast({
        title: 'Ada upload yang gagal',
        description: `Hapus atau coba ulang: ${failedUploads.map((f) => f.name).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    if (ui.editingMessageId) {
      await handleSaveMessageEdit(ui.editingMessageId, 0, text, ui.attachedImages);
      ui.setEditingMessageId(null);
      ui.setInputMessage('');
      ui.setAttachedImages([]);
      return;
    }

    const prevActiveChatId = ui.activeChatId;
    const currentImages = [...ui.attachedImages];
    ui.setAttachedImages([]);

    await chatSubmit(text, messages, currentImages, prevActiveChatId);
  };

  const handleSaveMessageEdit = async (messageId: string, index: number, text: string, images?: ImageAttachment[]) => {
    if (handleRegenerateFrom) {
      await handleRegenerateFrom(messageId, text, images);
    }
  };

  const handleRegenerateMessage = async (messageId: string) => {
    if (handleRegenerateFrom) {
      await handleRegenerateFrom(messageId);
    }
  };

  const handleSwitchVersionIdx = (messageId: string, idx: number) => {
    if (ui.activeChatId) {
      chatStore.switchMessageVersion(ui.activeChatId, messageId, idx);
    }
  };

  const processFiles = async (files: File[]) => {
    // Category-aware validation instead of the old flat 10MB /
    // acceptedTypes-only check — video/audio can legitimately be much
    // larger than an image, per MEDIA_LIMITS in config/constants.ts
    // (which mirrors what magic-bytes.ts on the server actually
    // enforces — see the comment there for why these numbers exist).
    const validFiles = files.filter((file) => {
      if (!FILE_UPLOAD_CONFIG.acceptedTypes.includes(file.type)) {
        toast({
          title: 'Unsupported format',
          description: `${file.name} is not a supported file format`,
          variant: 'destructive',
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;
    if (ui.attachedImages.length + validFiles.length > FILE_UPLOAD_CONFIG.maxFiles) {
      toast({
        title: 'Limit reached',
        description: `You can only upload up to ${FILE_UPLOAD_CONFIG.maxFiles} files`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Each file is uploaded independently and appended to
      // attachedImages as soon as its own upload resolves — a fast
      // small image doesn't wait behind a slow video in the same batch.
      await Promise.allSettled(
        validFiles.map((file) =>
          uploadFile(file, ui.activeChatId ?? undefined, (attachment) => {
            ui.setAttachedImages((prev) => {
              const exists = prev.some((img) => img.id === attachment.id);
              return exists
                ? prev.map((img) => (img.id === attachment.id ? attachment : img))
                : [...prev, attachment];
            });
          }).catch((err) => {
            if (err instanceof MediaUploadAuthRequiredError) {
              toast({ title: 'Login diperlukan', description: err.message, variant: 'destructive' });
            } else {
              toast({
                title: 'Upload gagal',
                description: err instanceof Error ? err.message : `${file.name} gagal diunggah`,
                variant: 'destructive',
              });
            }
          })
        )
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files);
        processFiles(files);
      }
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        processFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.attachedImages.length]); // Re-bind when attached images change to keep limit check accurate



  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 flex items-center justify-center animate-pulse">
            <svg className="w-full h-full" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient id="genesisGradLoading" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#60aaff" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <path
                d="M26 16C26 21.5228 21.5228 26 16 26C10.4772 26 6 21.5228 6 16C6 10.4772 10.4772 6 16 6C19.3431 6 22.2868 7.6393 24.1002 10.1584"
                stroke="url(#genesisGradLoading)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path d="M16 16H25" stroke="url(#genesisGradLoading)" strokeWidth="2.5" strokeLinecap="round" />
              <path
                d="M16 11L17.5 14.5L21 16L17.5 17.5L16 21L14.5 17.5L11 16L14.5 14.5L16 11Z"
                fill="url(#genesisGradLoading)"
              />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
            Loading workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell
        sidebar={<Sidebar hydrated={hydrated} />}
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
      >
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSendMessage={onSendMessage}
          onStopGeneration={stopGeneration}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          chatInputRef={chatInputRef}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          codeVersions={codeVersions}
          regeneratingId={regeneratingId}
          onRegenerate={handleRegenerateMessage}
          onSwitchVersionIdx={handleSwitchVersionIdx}
          onSaveMessageEdit={handleSaveMessageEdit}
        />

        {ui.showArtifact && (
          <ArtifactPanel
            onSendMessage={onSendMessage}
            isLoading={isLoading}
            onStopGeneration={stopGeneration}
            codeVersions={codeVersions}
          />
        )}
      </AppShell>

      {/* Settings Modal */}
      <SettingsModal isOpen={ui.isSettingsOpen} onClose={() => ui.setIsSettingsOpen(false)} />

      {/* Upgrade Modal */}
      {ui.isUpgradeModalOpen && <UpgradeModal />}

      {/* Auth Modal */}
      {ui.isAuthModalOpen && <AuthModal />}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 pointer-events-none animate-in fade-in duration-200">
          <div className="absolute inset-4 border-2 border-dashed border-[#60aaff] rounded-2xl bg-[#1a6adf]/10 flex flex-col items-center justify-center">
            <UploadCloud size={32} className="text-[#60aaff] mb-3 animate-bounce" />
            <span className="text-xl font-medium text-white">Drop files to upload</span>
          </div>
        </div>
      )}

      {/* Image Annotator */}
      {ui.annotatingImage && <ImageAnnotator />}
    </>
  );
};

export default GenesisApp;
