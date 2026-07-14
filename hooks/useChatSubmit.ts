import { useState, useCallback, useRef } from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import { useUIStore } from '@/lib/store/ui-store';
import { extractAllCodes } from '@/lib/extract-code';
import { parseSSEStream } from '@/lib/sse-parser';
import { ImageAttachment, ModelConfig } from '@/types';
import { useSettingsStore } from '@/lib/store/settings-store';

interface UseChatSubmitOptions {
  chatId: string | null;
  selectedModel: string;
  selectedAgent?: string | null;
}

export function useChatSubmit({ chatId, selectedModel, selectedAgent }: UseChatSubmitOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatStore = useChatStore();
  const ui = useUIStore();

  // Build image payloads from data URLs (exactly as in page.tsx)
  const buildImagePayloads = useCallback((images: ImageAttachment[]) => {
    return images.map((img) => {
      // Fase D: R2-uploaded video/audio/document/large-image attachments
      // carry a Gemini File API fileUri and an empty `url` (the bytes
      // never round-tripped back to the browser — see
      // hooks/useMediaUpload.ts). Must be checked before the data: URL
      // parsing below, since `img.url` is intentionally blank for these.
      if (img.fileUri) {
        return { fileUri: img.fileUri, mimeType: img.mimeType || img.type };
      }
      const url = img.url;
      if (url.startsWith('data:')) {
        // Match any mime type: data:[<mediatype>];base64,<data>
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) return { mimeType: match[1], base64: match[2] };
      }
      return { url };
    });
  }, []);

  // Sync messages from store to local state (needed after updating store)
  const syncMessages = useCallback((targetChatId: string) => {
    const chat = chatStore.chats.find((c) => c.id === targetChatId);
    if (!chat) return [];
    return chat.messages.map((msg) => ({
      type: msg.role === 'user' ? 'user' : 'ai',
      content: msg.content,
    }));
  }, [chatStore.chats]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setRegeneratingId(null);
    }
  }, []);

  const submit = useCallback(async (
    messageToSend: string,
    currentMessages: { type: string; content: string; images?: string[] }[],
    images: ImageAttachment[] = [],
    activeChatId: string | null = chatId,
  ) => {
    if (!messageToSend.trim() && images.length === 0) return;

    const imagePreviewUrls = images.map((img) => img.preview || img.url);

    const newMessages = [
      ...currentMessages,
      {
        type: 'user',
        content: messageToSend,
        images: imagePreviewUrls.length > 0 ? imagePreviewUrls : undefined,
      },
    ];

    ui.setInputMessage('');
    setIsLoading(true);
    ui.setCurrentView('chat');
    ui.setShowArtifact(false);

    // Create a new chat if it doesn't exist
    let currentChatId = activeChatId;
    if (!currentChatId) {
      const title = messageToSend.length > 40
        ? messageToSend.substring(0, 40) + '...'
        : messageToSend;
      currentChatId = chatStore.createChat(title);
      chatStore.updateModelConfig(currentChatId, { model: selectedModel as any });
      
      // Also update agentId if provided
      if (selectedAgent) {
        useChatStore.setState(state => ({
          chats: state.chats.map(c => c.id === currentChatId ? { ...c, agentId: selectedAgent } : c)
        }));
      }

      ui.setActiveChatId(currentChatId);
    }

    chatStore.addMessage(currentChatId, {
      role: 'user',
      content: messageToSend,
      totalTokens: 0,
      images: images.length > 0 ? images : undefined,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const imagePayloads = buildImagePayloads(images);
      const { buildContextForAPI } = await import('@/lib/chat-summarizer');
      
      const latestChatStore = useChatStore.getState();
      const updatedChat = latestChatStore.chats.find(c => c.id === currentChatId);
      const apiMessages: { role: string; content: string; attachments?: { type: string; dataUrl: string }[] }[] = updatedChat
        ? buildContextForAPI(
            updatedChat.messages,
            updatedChat.summary,
            updatedChat.lastSummarizedIndex
          )
        : newMessages.map((msg) => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content,
          }));

      // Inject Agent System Instruction if selected
      let finalConfig = updatedChat?.modelConfig || { temperature: 0.7 };
      if (selectedAgent) {
        const agent = latestChatStore.agents.find(a => a.id === selectedAgent);
        if (agent) {
          // Prepend system instruction if not already there
          if (apiMessages.length === 0 || apiMessages[0].role !== 'system') {
            apiMessages.unshift({
              role: 'system',
              content: agent.systemInstruction,
            } as any);
          } else {
            apiMessages[0].content = agent.systemInstruction;
          }

          // Override config with agent parameters
          finalConfig = {
            ...finalConfig,
            temperature: agent.temperature,
            useCodeExecution: agent.useCodeExecution,
            useSearchGrounding: agent.useSearchGrounding,
            useStructuredOutputs: agent.useStructuredOutputs,
          };
        }
      }
      
      const settingsStore = useSettingsStore.getState();
      if (!selectedAgent && settingsStore.preferences.defaultSystemInstruction) {
        finalConfig = {
          ...finalConfig,
          systemInstruction: settingsStore.preferences.defaultSystemInstruction,
        };
      }

      // Check if selectedModel is a composite model or workflow
      const compositeModel = latestChatStore.compositeModels?.find(m => m.id === selectedModel);
      if (compositeModel) {
        finalConfig = {
          ...finalConfig,
          compositeModel,
        };
      } else {
        const workflow = latestChatStore.workflows?.find(w => w.id === selectedModel);
        if (workflow) {
          // Resolve agentId -> full Agent definition for every 'agent' node BEFORE
          // sending to the server. The API route has no access to the client-side
          // Zustand agent store (same reasoning as the BYOK key fix), so the client
          // must resolve and embed the agent config explicitly instead of sending
          // just an id the server can't look up.
          const resolvedNodes = workflow.nodes.map(node => {
            if (node.type === 'agent' && node.config?.agentId) {
              const agent = latestChatStore.agents.find(a => a.id === node.config.agentId);
              if (agent) {
                return {
                  ...node,
                  config: {
                    ...node.config,
                    resolvedAgent: {
                      name: agent.name,
                      systemInstruction: agent.systemInstruction,
                      modelId: agent.modelId,
                      temperature: agent.temperature,
                      useSearchGrounding: agent.useSearchGrounding,
                      useCodeExecution: agent.useCodeExecution,
                    },
                  },
                };
              }
            }
            return node;
          });

          finalConfig = {
            ...finalConfig,
            workflow: { ...workflow, nodes: resolvedNodes },
          };
        }
      }

      // Add image payloads back to messages if applicable
      if (imagePayloads.length > 0 && apiMessages.length > 0) {
        apiMessages[apiMessages.length - 1].attachments = imagePayloads.map(img => ({
          type: img.mimeType || 'image/jpeg',
          dataUrl: `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`
        }));
      }

      const settings = useSettingsStore.getState();
      const providersConfig = {
        google: { apiKey: settings.apiKeys.find(k => k.provider === 'google')?.key || '' },
        openai: { apiKey: settings.apiKeys.find(k => k.provider === 'openai')?.key || '' },
        anthropic: { apiKey: settings.apiKeys.find(k => k.provider === 'anthropic')?.key || '' },
        groq: { apiKey: settings.apiKeys.find(k => k.provider === 'groq')?.key || '' },
        deepseek: { apiKey: settings.apiKeys.find(k => k.provider === 'deepseek')?.key || '' },
        openrouter: { apiKey: settings.apiKeys.find(k => k.provider === 'openrouter')?.key || '' },
        ollama: { apiKey: settings.apiKeys.find(k => k.provider === 'ollama')?.key || '' },
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          modelId: selectedModel,
          messages: apiMessages,
          config: finalConfig,
          providersConfig,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      if (!response.body) throw new Error('ReadableStream not supported.');

      const reader = response.body.getReader();
      let aiContent = '';
      const messageId = chatStore.addMessage(currentChatId!, {
        role: 'assistant',
        content: '',
        totalTokens: 0,
      });

      let finalUsageMetadata: any = null;

      await parseSSEStream(
        reader,
        (textChunk) => {
          aiContent += textChunk;
          chatStore.updateMessageContent(currentChatId!, messageId, aiContent);
        },
        (metadata) => {
          if (metadata) {
            finalUsageMetadata = metadata as any;
          }
        },
        (eventData) => {
          // Handle custom events from Deftorch SSE
          if (eventData.type === 'debug') {
            chatStore.addDebugLog({
              type: 'info',
              message: eventData.message || '',
            });
          } else if (eventData.type === 'ttft' || eventData.type === 'finish') {
             chatStore.setStreamMetrics({
               ttft: eventData.type === 'ttft' ? eventData.latency : (chatStore.currentMetrics?.ttft || null),
               duration: eventData.duration || chatStore.currentMetrics?.duration || null,
               promptTokens: eventData.usage?.promptTokens || 0,
               completionTokens: eventData.usage?.completionTokens || 0,
               totalTokens: eventData.usage?.totalTokens || 0,
               tokensPerSecond: null
             });
          } else if (eventData.type === 'error') {
            chatStore.addDebugLog({
              type: 'error',
              message: eventData.error || 'Unknown error',
            });
          }
        }
      );

      if (finalUsageMetadata) {
        const promptTokens = finalUsageMetadata.promptTokenCount ?? 0;
        const completionTokens = finalUsageMetadata.candidatesTokenCount ?? 0;
        
        // Update assistant message tokens
        chatStore.updateMessageTokens(currentChatId!, messageId, {
          promptTokens,
          completionTokens,
          totalTokens: finalUsageMetadata.totalTokenCount ?? promptTokens + completionTokens,
        });
        
        // Find user message added just before
        const chat = chatStore.chats.find(c => c.id === currentChatId);
        if (chat && chat.messages.length >= 2) {
          const userMsg = chat.messages[chat.messages.length - 2];
          if (userMsg && userMsg.role === 'user') {
            chatStore.updateMessageTokens(currentChatId!, userMsg.id, promptTokens);
          }
        }
        
        chatStore.updateChatTokens(currentChatId!, promptTokens + completionTokens);
      }

      // Once done, extract code
      const allExtracted = extractAllCodes(aiContent);
      if (allExtracted.length > 0) {
        const firstExtracted = allExtracted[0];
        if (ui.p5Code) ui.setPreviousCode(ui.p5Code);
        ui.setP5Code(firstExtracted.code);
        ui.setEditableCode(firstExtracted.code);
        ui.setActiveRenderer(firstExtracted.renderer);
        ui.setActiveTab('preview');
        // ui.setShowArtifact(true); // User requested not to auto-open

        const chat = chatStore.chats.find((c) => c.id === currentChatId);
        allExtracted.forEach((ext) => {
          chatStore.addArtifact({
            chatId: currentChatId!,
            chatTitle: chat?.title || 'Untitled',
            code: ext.code,
            renderer: ext.renderer,
          });
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        chatStore.addMessage(currentChatId, {
          role: 'assistant',
          content: 'Generation stopped.',
          totalTokens: 0,
        });
      } else {
        chatStore.addMessage(currentChatId, {
          role: 'assistant',
          content: 'Failed to connect to AI service. Please try again.',
          totalTokens: 10,
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [chatId, selectedModel, ui, chatStore, buildImagePayloads]);

  const handleRegenerateFrom = useCallback(async (messageId: string, newContent?: string, newImages?: ImageAttachment[]) => {
    if (!chatId) return;
    const chat = chatStore.chats.find((c) => c.id === chatId);
    if (!chat) return;

    const messageIndex = chat.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    if (newContent !== undefined) {
      if (!newContent.trim() && (!newImages || newImages.length === 0)) return;
      chatStore.updateMessage(chatId, messageId, newContent, newImages);
    }

    const updatedChat = chatStore.chats.find((c) => c.id === chatId);
    if (!updatedChat) return;

    const message = updatedChat.messages[messageIndex];
    const isAssistant = message.role === 'assistant';

    let userMessageIndex = messageIndex;
    let assistantMessageId = '';

    if (isAssistant) {
      userMessageIndex = messageIndex - 1;
      assistantMessageId = messageId;
    } else {
      const assistantMessageIndex = messageIndex + 1;
      if (
        assistantMessageIndex < updatedChat.messages.length &&
        updatedChat.messages[assistantMessageIndex].role === 'assistant'
      ) {
        assistantMessageId = updatedChat.messages[assistantMessageIndex].id;
      }
    }

    if (userMessageIndex < 0) return;

    setRegeneratingId(messageId);
    ui.setShowArtifact(false);

    const history = updatedChat.messages.slice(0, userMessageIndex + 1).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const hasCodeContext = history.some((m) => m.content.includes('// renderer:'));
      
      const imagePayloads = newImages ? buildImagePayloads(newImages) : undefined;

      const settings = useSettingsStore.getState();
      const providersConfig = {
        google: { apiKey: settings.apiKeys.find(k => k.provider === 'google')?.key || '' },
        openai: { apiKey: settings.apiKeys.find(k => k.provider === 'openai')?.key || '' },
        anthropic: { apiKey: settings.apiKeys.find(k => k.provider === 'anthropic')?.key || '' },
        groq: { apiKey: settings.apiKeys.find(k => k.provider === 'groq')?.key || '' },
        deepseek: { apiKey: settings.apiKeys.find(k => k.provider === 'deepseek')?.key || '' },
        openrouter: { apiKey: settings.apiKeys.find(k => k.provider === 'openrouter')?.key || '' },
        ollama: { apiKey: settings.apiKeys.find(k => k.provider === 'ollama')?.key || '' },
      };

      if (imagePayloads && imagePayloads.length > 0 && history.length > 0) {
        (history[history.length - 1] as any).attachments = imagePayloads.map(img => ({
          type: img.mimeType || 'image/jpeg',
          dataUrl: `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`
        }));
      }

      // Inject Agent System Instruction if selected
      let finalConfig = chat.modelConfig || { temperature: 0.7 };
      if (selectedAgent) {
        const agent = chatStore.agents.find(a => a.id === selectedAgent);
        if (agent) {
          if (history.length === 0 || history[0].role !== 'system') {
            history.unshift({
              role: 'system',
              content: agent.systemInstruction,
            } as any);
          } else {
            history[0].content = agent.systemInstruction;
          }

          finalConfig = {
            ...finalConfig,
            temperature: agent.temperature,
            useCodeExecution: agent.useCodeExecution,
            useSearchGrounding: agent.useSearchGrounding,
            useStructuredOutputs: agent.useStructuredOutputs,
          };
        }
      }
      
      const settingsStore = useSettingsStore.getState();
      if (!selectedAgent && settingsStore.preferences.defaultSystemInstruction) {
        finalConfig = {
          ...finalConfig,
          systemInstruction: settingsStore.preferences.defaultSystemInstruction,
        };
      }

      const compositeModel = chatStore.compositeModels?.find(m => m.id === selectedModel);
      if (compositeModel) {
        finalConfig = {
          ...finalConfig,
          compositeModel,
        };
      } else {
        const workflow = chatStore.workflows?.find(w => w.id === selectedModel);
        if (workflow) {
          // Same agentId -> Agent resolution as the main submit path above.
          const resolvedNodes = workflow.nodes.map(node => {
            if (node.type === 'agent' && node.config?.agentId) {
              const agent = chatStore.agents.find(a => a.id === node.config.agentId);
              if (agent) {
                return {
                  ...node,
                  config: {
                    ...node.config,
                    resolvedAgent: {
                      name: agent.name,
                      systemInstruction: agent.systemInstruction,
                      modelId: agent.modelId,
                      temperature: agent.temperature,
                      useSearchGrounding: agent.useSearchGrounding,
                      useCodeExecution: agent.useCodeExecution,
                    },
                  },
                };
              }
            }
            return node;
          });

          finalConfig = {
            ...finalConfig,
            workflow: { ...workflow, nodes: resolvedNodes },
          };
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          modelId: selectedModel || 'gemini-3-flash',
          messages: history,
          config: finalConfig,
          providersConfig,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      if (!assistantMessageId) {
        assistantMessageId = chatStore.addMessage(chatId, { role: 'assistant', content: '', totalTokens: 0 });
      } else {
        chatStore.updateMessageContent(chatId, assistantMessageId, '');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported.');
      
      let aiContent = '';
      let finalUsageMetadata: any = null;

      await parseSSEStream(
        reader,
        (textChunk) => {
          aiContent += textChunk;
          chatStore.updateMessageContent(chatId, assistantMessageId, aiContent);
        },
        (metadata) => {
          if (metadata) {
            finalUsageMetadata = metadata;
          }
        },
        (eventData) => {
          if (eventData.type === 'debug') {
            chatStore.addDebugLog({
              type: 'info',
              message: eventData.message || '',
            });
          } else if (eventData.type === 'ttft' || eventData.type === 'finish') {
             chatStore.setStreamMetrics({
               ttft: eventData.type === 'ttft' ? eventData.latency : (chatStore.currentMetrics?.ttft || null),
               duration: eventData.duration || chatStore.currentMetrics?.duration || null,
               promptTokens: eventData.usage?.promptTokens || 0,
               completionTokens: eventData.usage?.completionTokens || 0,
               totalTokens: eventData.usage?.totalTokens || 0,
               tokensPerSecond: null
             });
          }
        }
      );

      if (finalUsageMetadata) {
        const promptTokens = finalUsageMetadata.promptTokenCount ?? 0;
        const completionTokens = finalUsageMetadata.candidatesTokenCount ?? 0;
        chatStore.updateMessageTokens(chatId, assistantMessageId, {
          promptTokens,
          completionTokens,
          totalTokens: finalUsageMetadata.totalTokenCount ?? promptTokens + completionTokens,
        });
        // The main submit path (line ~315) also rolls the new usage into
        // the chat-level aggregate via updateChatTokens — this regenerate
        // path never did, so chat.totalTokens silently under-counted any
        // chat with at least one regenerated message. Same fix, applied
        // to the path that was missing it.
        chatStore.updateChatTokens(chatId, promptTokens + completionTokens);
      }

      const allExtracted = extractAllCodes(aiContent);
      if (allExtracted.length > 0) {
        const firstExtracted = allExtracted[0];
        if (ui.p5Code) ui.setPreviousCode(ui.p5Code);
        ui.setP5Code(firstExtracted.code);
        ui.setEditableCode(firstExtracted.code);
        ui.setActiveRenderer(firstExtracted.renderer);
        ui.setActiveTab('preview');
        // ui.setShowArtifact(true); // User requested not to auto-open
        
        allExtracted.forEach((ext) => {
          chatStore.addArtifact({
            chatId: chatId,
            chatTitle: updatedChat.title || 'Untitled',
            code: ext.code,
            renderer: ext.renderer,
          });
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const stopMsg = 'Generation stopped.';
        if (assistantMessageId) {
          chatStore.updateMessage(chatId, assistantMessageId, stopMsg);
        } else {
          chatStore.addMessage(chatId, {
            role: 'assistant',
            content: stopMsg,
            totalTokens: 0,
          });
        }
      } else {
        const errMsg = 'Failed to connect to AI service. Please try again.';
        if (assistantMessageId) {
          chatStore.updateMessage(chatId, assistantMessageId, errMsg);
        } else {
          chatStore.addMessage(chatId, {
            role: 'assistant',
            content: errMsg,
            totalTokens: 10,
          });
        }
      }
    } finally {
      setRegeneratingId(null);
      abortControllerRef.current = null;
    }
  }, [chatId, selectedModel, ui, chatStore]);

  return { submit, isLoading, stopGeneration, regeneratingId, setRegeneratingId, syncMessages, handleRegenerateFrom };
}
