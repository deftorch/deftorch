import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Chat, Message, ModelConfig, Project, Artifact, ImageAttachment, DebugLog, StreamMetrics, Agent, CompositeModel, Workflow } from '@/types';
import { PRESET_AGENTS, PRESET_COMPOSITES, PRESET_WORKFLOWS } from '@/config/deftorch-presets';
import { DEFAULT_MODEL_CONFIG } from '@/config/constants';
import { generateId } from '@/lib/utils';
import { generateMessagesSummary, shouldUpdateSummary } from '@/lib/chat-summarizer';
import {
  syncUpsertChat,
  syncDeleteChat,
  syncUpsertMessage,
  syncDeleteMessage,
  syncUpsertProject,
  syncDeleteProject,
  pullChatsAndProjects,
} from '@/lib/sync/chat-sync';
import {
  syncUpsertAgent,
  syncDeleteAgent,
  syncUpsertCompositeModel,
  syncDeleteCompositeModel,
  syncUpsertWorkflow,
  syncDeleteWorkflow,
  pullLibrary,
} from '@/lib/sync/library-sync';

interface ChatStore {
  chats: Chat[];
  currentChatId: string | null;
  projects: Project[];
  artifacts: Artifact[];
  debugLogs: DebugLog[];
  currentMetrics: StreamMetrics | null;
  agents: Agent[];
  compositeModels: CompositeModel[];
  workflows: Workflow[];
  
  createChat: (title?: string) => string;
  deleteChat: (chatId: string) => void;
  renameChat: (chatId: string, title: string) => void;
  autoRenameChat: (chatId: string, firstMessage: string) => void;
  starChat: (chatId: string) => void;
  setCurrentChat: (chatId: string) => void;
  getCurrentChat: () => Chat | null;
  importChats: (chats: Chat[]) => void;
  
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (chatId: string, messageId: string, content: string, images?: ImageAttachment[]) => void;
  updateMessageContent: (chatId: string, messageId: string, content: string) => void;
  updateMessageTokens: (chatId: string, messageId: string, usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void;
  updateChatTokens: (chatId: string, tokens: number) => void;
  switchMessageVersion: (chatId: string, messageId: string, versionIdx: number) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  updateChatSummary: (chatId: string) => void;
  
  createProject: (name: string, description?: string) => string;
  deleteProject: (projectId: string) => void;
  moveToProject: (chatId: string, projectId: string | null) => void;
  renameProject: (projectId: string, name: string, description?: string) => void;
  
  updateModelConfig: (chatId: string, config: Partial<ModelConfig>) => void;
  
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, agent: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;

  addCompositeModel: (model: CompositeModel) => void;
  updateCompositeModel: (id: string, model: Partial<CompositeModel>) => void;
  deleteCompositeModel: (id: string) => void;

  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, workflow: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;

  searchChats: (query: string) => Chat[];
  pullFromSupabase: () => Promise<void>;
  pullLibraryFromSupabase: () => Promise<void>;
  applyRemoteChatUpsert: (row: any) => void;
  applyRemoteChatDelete: (chatId: string) => void;
  applyRemoteMessageUpsert: (row: any) => void;
  applyRemoteMessageDelete: (messageId: string) => void;
  applyRemoteMessageVersionUpsert: (row: any) => void;
  
  addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt'>) => void;
  deleteArtifact: (artifactId: string) => void;
  deleteArtifactsForChat: (chatId: string) => void;
  
  addDebugLog: (log: Omit<DebugLog, 'id' | 'timestamp'> & Partial<Pick<DebugLog, 'id' | 'timestamp'>>) => void;
  clearDebugLogs: () => void;
  setStreamMetrics: (metrics: StreamMetrics | null) => void;

  clearAll: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: [],
      currentChatId: null,
      projects: [],
      artifacts: [],
      debugLogs: [],
      currentMetrics: null,
      agents: PRESET_AGENTS,
      compositeModels: PRESET_COMPOSITES,
      workflows: PRESET_WORKFLOWS,

      createChat: (title = 'New Chat') => {
        const newChat: Chat = {
          id: generateId(),
          title,
          messages: [],
          modelConfig: { ...DEFAULT_MODEL_CONFIG },
          createdAt: new Date(),
          updatedAt: new Date(),
          isStarred: false,
          totalTokens: 0,
        };
        
        set((state: ChatStore) => ({
          chats: [newChat, ...state.chats],
          currentChatId: newChat.id,
        }));

        syncUpsertChat(newChat);

        return newChat.id;
      },

      deleteChat: (chatId: string) => {
        set((state: ChatStore) => ({
          chats: state.chats.filter((chat: Chat) => chat.id !== chatId),
          currentChatId: state.currentChatId === chatId ? null : state.currentChatId,
          projects: state.projects.map((p: Project) => ({
            ...p,
            chatIds: p.chatIds.filter((id: string) => id !== chatId),
          })),
          artifacts: state.artifacts.filter((a: Artifact) => a.chatId !== chatId),
        }));

        syncDeleteChat(chatId);
      },

      renameChat: (chatId: string, title: string) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId ? { ...chat, title, updatedAt: new Date() } : chat
          ),
          // Update chatTitle on matching artifacts
          artifacts: state.artifacts.map((a: Artifact) =>
            a.chatId === chatId ? { ...a, chatTitle: title } : a
          ),
        }));

        const chat = get().chats.find((c: Chat) => c.id === chatId);
        if (chat) syncUpsertChat(chat);
      },

      autoRenameChat: (chatId: string, firstMessage: string) => {
        const title = firstMessage.length > 50 
          ? firstMessage.substring(0, 50) + '...'
          : firstMessage;
        
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId ? { ...chat, title, updatedAt: new Date() } : chat
          ),
          // Update chatTitle on matching artifacts
          artifacts: state.artifacts.map((a: Artifact) =>
            a.chatId === chatId ? { ...a, chatTitle: title } : a
          ),
        }));

        const chat = get().chats.find((c: Chat) => c.id === chatId);
        if (chat) syncUpsertChat(chat);
      },

      starChat: (chatId: string) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId ? { ...chat, isStarred: !chat.isStarred } : chat
          ),
        }));

        const chat = get().chats.find((c: Chat) => c.id === chatId);
        if (chat) syncUpsertChat(chat);
      },

      setCurrentChat: (chatId: string) => {
        set({ currentChatId: chatId });
      },

      getCurrentChat: () => {
        const state = get();
        return state.chats.find((chat: Chat) => chat.id === state.currentChatId) || null;
      },

      importChats: (importedChats: Chat[]) => {
        set((state: ChatStore) => {
          const processedChats = importedChats.map((chat: any) => ({
            ...chat,
            id: chat.id || generateId(),
            projectId: chat.projectId || chat.folderId,
            createdAt: chat.createdAt instanceof Date ? chat.createdAt : new Date(chat.createdAt),
            updatedAt: chat.updatedAt instanceof Date ? chat.updatedAt : new Date(chat.updatedAt),
            messages: chat.messages.map((msg: any) => ({
              ...msg,
              id: msg.id || generateId(),
              timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
              versions: msg.versions || [msg.content],
              activeVersionIdx: msg.activeVersionIdx !== undefined ? msg.activeVersionIdx : 0,
            })),
          }));

          const existingIds = new Set(state.chats.map((c: Chat) => c.id));
          const newChats = processedChats.filter((c: Chat) => !existingIds.has(c.id));

          return {
            chats: [...newChats, ...state.chats],
          };
        });
      },

      addMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
        const newMessage: Message = {
          ...message,
          id: generateId(),
          timestamp: new Date(),
          versions: message.versions || [message.content],
          activeVersionIdx: message.activeVersionIdx !== undefined ? message.activeVersionIdx : 0,
        };

        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [...chat.messages, newMessage],
                  updatedAt: new Date(),
                  totalTokens: chat.totalTokens + (message.totalTokens || 0),
                }
              : chat
          ),
        }));

        // Auto-update summary jika perlu
        const chat = get().chats.find((c: Chat) => c.id === chatId);
        if (chat && shouldUpdateSummary(chat.messages.length, chat.lastSummarizedIndex)) {
          get().updateChatSummary(chatId);
        }

        if (chat) syncUpsertChat(chat);
        syncUpsertMessage(chatId, newMessage);

        return newMessage.id;
      },

      updateChatSummary: (chatId: string) => {
        set((state: ChatStore) => {
          const chat = state.chats.find((c: Chat) => c.id === chatId);
          if (!chat) return state;

          const summary = generateMessagesSummary(chat.messages);
          
          return {
            chats: state.chats.map((c: Chat) =>
              c.id === chatId
                ? {
                    ...c,
                    summary,
                    lastSummarizedIndex: c.messages.length - 1,
                    updatedAt: new Date(),
                  }
                : c
            ),
          };
        });
      },

      updateMessage: (chatId: string, messageId: string, content: string, images?: ImageAttachment[]) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg: Message) => {
                    if (msg.id === messageId) {
                      const versions = msg.versions && msg.versions.length > 0 ? msg.versions : [msg.content];
                      // Only add a new version if the content has actually changed
                      const hasChanged = versions[versions.length - 1] !== content;
                      const newVersions = hasChanged ? [...versions, content] : versions;
                      return {
                        ...msg,
                        content,
                        images: images !== undefined ? images : msg.images,
                        isEdited: true,
                        versions: newVersions,
                        activeVersionIdx: newVersions.length - 1,
                      };
                    }
                    return msg;
                  }),
                  updatedAt: new Date(),
                }
              : chat
          ),
        }));

        const updatedMsg = get().chats.find((c: Chat) => c.id === chatId)?.messages.find((m: Message) => m.id === messageId);
        if (updatedMsg) syncUpsertMessage(chatId, updatedMsg);
      },

      updateMessageContent: (chatId: string, messageId: string, content: string) => {
        // NOTE: intentionally no syncUpsertMessage() call here — this action
        // fires on every streamed token while a response is generating
        // (see hooks/useChatSubmit.ts), so syncing per-call would flood
        // Supabase with one write per chunk. The final content lands in
        // Supabase via updateMessage()/addMessage() once streaming finishes.
        // If a stream is interrupted mid-way, the last-synced version is
        // what other devices see until the next full sync — acceptable
        // for this slice, revisit with a debounced sync if it matters more.
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg: Message) => {
                    if (msg.id === messageId) {
                      const versions = msg.versions && msg.versions.length > 0 ? [...msg.versions] : [msg.content];
                      // Just replace the latest version content without creating a new version history entry
                      versions[versions.length - 1] = content;
                      return {
                        ...msg,
                        content,
                        versions,
                      };
                    }
                    return msg;
                  }),
                }
              : chat
          ),
        }));
      },

      updateMessageTokens: (chatId: string, messageId: string, usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => {
        // Was: `{ ...msg, tokens }` — writing a flat `tokens` field that
        // was never actually part of the Message type (types/index.ts
        // has always declared promptTokens/completionTokens/totalTokens,
        // never `tokens`). Every caller in useChatSubmit.ts wrote
        // `tokens` anyway, so it "worked" at the object level (extra
        // properties survive at runtime, TS just never checked it), but
        // lib/sync/chat-sync.ts and app/api/migrate/route.ts have always
        // read `message.promptTokens`/`completionTokens`/`totalTokens` —
        // fields that were consequently NEVER populated. Every message
        // synced to Supabase had its token columns silently stuck at 0,
        // regardless of real usage. This fixes the write side to match
        // what sync/migrate actually read.
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg: Message) =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          promptTokens: usage.promptTokens ?? msg.promptTokens ?? 0,
                          completionTokens: usage.completionTokens ?? msg.completionTokens ?? 0,
                          totalTokens: usage.totalTokens ?? msg.totalTokens ?? 0,
                        }
                      : msg
                  ),
                }
              : chat
          ),
        }));

        // Fires once per message when a stream finishes (see
        // hooks/useChatSubmit.ts) — the right checkpoint to push the
        // settled content, since updateMessageContent() intentionally
        // skips syncing on every streamed chunk.
        const finishedMsg = get().chats.find((c: Chat) => c.id === chatId)?.messages.find((m: Message) => m.id === messageId);
        if (finishedMsg) syncUpsertMessage(chatId, finishedMsg);
      },

      updateChatTokens: (chatId: string, tokens: number) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId
              ? { ...chat, totalTokens: chat.totalTokens + tokens }
              : chat
          ),
        }));
      },

      switchMessageVersion: (chatId: string, messageId: string, versionIdx: number) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg: Message) => {
                    if (msg.id === messageId && msg.versions && versionIdx >= 0 && versionIdx < msg.versions.length) {
                      return {
                        ...msg,
                        content: msg.versions[versionIdx],
                        activeVersionIdx: versionIdx,
                      };
                    }
                    return msg;
                  }),
                  updatedAt: new Date(),
                }
              : chat
          ),
        }));

        const switchedMsg = get().chats.find((c: Chat) => c.id === chatId)?.messages.find((m: Message) => m.id === messageId);
        if (switchedMsg) syncUpsertMessage(chatId, switchedMsg);
      },

      deleteMessage: (chatId: string, messageId: string) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.filter((msg: Message) => msg.id !== messageId),
                  updatedAt: new Date(),
                }
              : chat
          ),
        }));

        syncDeleteMessage(messageId);
      },

      createProject: (name: string, description = '') => {
        const id = generateId();
        const newProject: Project = {
          id,
          name,
          description,
          chatIds: [],
          createdAt: new Date(),
        };
        
        set((state: ChatStore) => ({
          projects: [...state.projects, newProject],
        }));

        syncUpsertProject(newProject);

        return id;
      },

      deleteProject: (projectId: string) => {
        set((state: ChatStore) => ({
          projects: state.projects.filter((p: Project) => p.id !== projectId),
          chats: state.chats.map((chat: Chat) =>
            chat.projectId === projectId ? { ...chat, projectId: undefined } : chat
          ),
        }));

        syncDeleteProject(projectId);
      },

      renameProject: (projectId: string, name: string, description = '') => {
        set((state: ChatStore) => ({
          projects: state.projects.map((p: Project) =>
            p.id === projectId ? { ...p, name, description } : p
          ),
        }));

        const project = get().projects.find((p: Project) => p.id === projectId);
        if (project) syncUpsertProject(project);
      },

      moveToProject: (chatId: string, projectId: string | null) => {
        set((state: ChatStore) => {
          // 1. Update chats to set the new projectId (or undefined if null)
          const updatedChats = state.chats.map((chat: Chat) =>
            chat.id === chatId ? { ...chat, projectId: projectId || undefined } : chat
          );

          // 2. Remove chatId from all projects' chatIds arrays, and add to new project's array if not null
          const updatedProjects = state.projects.map((p: Project) => {
            let chatIds = p.chatIds.filter(id => id !== chatId);
            if (projectId && p.id === projectId) {
              chatIds = [...chatIds, chatId];
            }
            return { ...p, chatIds };
          });

          return {
            chats: updatedChats,
            projects: updatedProjects,
          };
        });

        const movedChat = get().chats.find((c: Chat) => c.id === chatId);
        if (movedChat) syncUpsertChat(movedChat);
      },

      updateModelConfig: (chatId: string, config: Partial<ModelConfig>) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) =>
            chat.id === chatId
              ? { ...chat, modelConfig: { ...chat.modelConfig, ...config } }
              : chat
          ),
        }));

        const chat = get().chats.find((c: Chat) => c.id === chatId);
        if (chat) syncUpsertChat(chat);
      },

      searchChats: (query: string) => {
        const state = get();
        const lowerQuery = query.toLowerCase();
        
        return state.chats.filter(
          (chat: Chat) =>
            chat.title.toLowerCase().includes(lowerQuery) ||
            chat.messages.some((msg: Message) => msg.content.toLowerCase().includes(lowerQuery))
        );
      },

      pullFromSupabase: async () => {
        const result = await pullChatsAndProjects();
        if (!result) return; // not signed in, or the pull itself failed — keep local state as-is
        set({ chats: result.chats, projects: result.projects });
      },

      pullLibraryFromSupabase: async () => {
        const result = await pullLibrary();
        if (!result) return;

        set((state: ChatStore) => {
          // Merge: presets (and anything else already local that the pull
          // didn't return, e.g. offline-created items not yet synced) stay,
          // server rows with a matching id win, server-only rows get added.
          const mergeById = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
            const remoteIds = new Set(remote.map((r) => r.id));
            return [...local.filter((l) => !remoteIds.has(l.id)), ...remote];
          };

          return {
            agents: mergeById(state.agents, result.agents),
            compositeModels: mergeById(state.compositeModels, result.compositeModels),
            // Workflows have no preset/custom split (see library-sync.ts) —
            // server is authoritative for the whole array once signed in.
            workflows: result.workflows.length > 0 ? result.workflows : state.workflows,
          };
        });
      },

      // --- Realtime receivers (lib/sync/realtime.ts) ---
      // These NEVER call syncUpsert*/syncDelete* — they're applying a
      // change that already happened in Postgres (either from this
      // client's own write echoing back, or from another tab/device).
      // Re-syncing here would just write the same row back, or worse,
      // ping-pong between two tabs on every change.
      applyRemoteChatUpsert: (row: any) => {
        set((state: ChatStore) => {
          const exists = state.chats.some((c: Chat) => c.id === row.id);
          if (exists) {
            return {
              chats: state.chats.map((c: Chat) =>
                c.id === row.id
                  ? {
                      ...c,
                      title: row.title,
                      modelConfig: row.model_config ?? c.modelConfig,
                      summary: row.summary ?? undefined,
                      lastSummarizedIndex: row.last_summarized_index ?? undefined,
                      projectId: row.project_id ?? undefined,
                      agentId: row.agent_id ?? undefined,
                      compositeModelId: row.composite_model_id ?? undefined,
                      isStarred: row.is_starred,
                      totalTokens: row.total_tokens,
                      updatedAt: new Date(row.updated_at),
                      // messages intentionally left as-is — they sync via
                      // their own INSERT/UPDATE/DELETE events, not here.
                    }
                  : c
              ),
            };
          }
          // Chat created on another device: add it locally. Its messages
          // will arrive as separate INSERT events shortly after (or on
          // next full pullFromSupabase() if this client wasn't listening
          // yet when they were sent).
          const newChat: Chat = {
            id: row.id,
            title: row.title,
            messages: [],
            modelConfig: row.model_config ?? {},
            summary: row.summary ?? undefined,
            lastSummarizedIndex: row.last_summarized_index ?? undefined,
            projectId: row.project_id ?? undefined,
            agentId: row.agent_id ?? undefined,
            compositeModelId: row.composite_model_id ?? undefined,
            isStarred: row.is_starred ?? false,
            totalTokens: row.total_tokens ?? 0,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          };
          return { chats: [newChat, ...state.chats] };
        });
      },

      applyRemoteChatDelete: (chatId: string) => {
        set((state: ChatStore) => ({
          chats: state.chats.filter((c: Chat) => c.id !== chatId),
          currentChatId: state.currentChatId === chatId ? null : state.currentChatId,
        }));
      },

      applyRemoteMessageUpsert: (row: any) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) => {
            if (chat.id !== row.chat_id) return chat;
            const incoming: Message = {
              id: row.id,
              role: row.role,
              content: row.content,
              timestamp: row.created_at,
              isEdited: row.is_edited,
              versions: undefined, // version history arrives via message_versions, not this event
              activeVersionIdx: row.active_version_idx ?? 0,
              attachments: row.attachments ?? [],
              promptTokens: row.prompt_tokens ?? 0,
              completionTokens: row.completion_tokens ?? 0,
              totalTokens: row.total_tokens ?? 0,
              agentName: row.agent_name ?? undefined,
              agentAvatar: row.agent_avatar ?? undefined,
            };
            const exists = chat.messages.some((m: Message) => m.id === row.id);
            return {
              ...chat,
              messages: exists
                ? chat.messages.map((m: Message) =>
                    m.id === row.id
                      ? { ...m, ...incoming, versions: incoming.versions ?? m.versions }
                      : m
                  )
                : [...chat.messages, incoming],
            };
          }),
        }));
      },

      applyRemoteMessageDelete: (messageId: string) => {
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) => ({
            ...chat,
            messages: chat.messages.filter((m: Message) => m.id !== messageId),
          })),
        }));
      },

      applyRemoteMessageVersionUpsert: (row: any) => {
        // row: { message_id, version_index, content }. Patches directly
        // into whichever message's `versions` array matches — mirrors
        // the write path in switchMessageVersion/handleSaveMessageEdit
        // above, which also treats `versions` as a plain array indexed
        // by version_index (see the local edit/regenerate logic further
        // up in this file for the same shape).
        set((state: ChatStore) => ({
          chats: state.chats.map((chat: Chat) => ({
            ...chat,
            messages: chat.messages.map((m: Message) => {
              if (m.id !== row.message_id) return m;
              const versions = m.versions ? [...m.versions] : [m.content];
              // Grow the array if this version arrived out of order or a
              // gap exists (shouldn't normally happen, but a realtime
              // event arriving before an earlier one it depends on isn't
              // impossible under retries/reconnects).
              while (versions.length <= row.version_index) versions.push(versions[versions.length - 1] ?? '');
              versions[row.version_index] = row.content;
              return { ...m, versions };
            }),
          })),
        }));
      },

      addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt'>) => {
        const newArtifact: Artifact = {
          ...artifact,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state: ChatStore) => ({
          artifacts: [newArtifact, ...state.artifacts],
        }));
      },

      // --- Agent Actions ---
      addAgent: (agent: Agent) => {
        set((state: ChatStore) => ({
          agents: [...state.agents, agent],
        }));
        syncUpsertAgent(agent);
      },

      updateAgent: (id: string, agentData: Partial<Agent>) => {
        set((state: ChatStore) => ({
          agents: state.agents.map((a: Agent) =>
            a.id === id ? { ...a, ...agentData } : a
          ),
        }));
        const agent = get().agents.find((a: Agent) => a.id === id);
        if (agent) syncUpsertAgent(agent);
      },

      deleteAgent: (id: string) => {
        set((state: ChatStore) => ({
          agents: state.agents.filter((a: Agent) => a.id !== id),
          chats: state.chats.map((c: Chat) =>
            c.agentId === id ? { ...c, agentId: undefined } : c
          ),
        }));
        syncDeleteAgent(id);
      },

      // --- Composite Models Actions ---
      addCompositeModel: (model: CompositeModel) => {
        set((state: ChatStore) => ({
          compositeModels: [...state.compositeModels, model]
        }));
        syncUpsertCompositeModel(model);
      },

      updateCompositeModel: (id: string, modelData: Partial<CompositeModel>) => {
        set((state: ChatStore) => ({
          compositeModels: state.compositeModels.map((m: CompositeModel) =>
            m.id === id ? { ...m, ...modelData } : m
          )
        }));
        const model = get().compositeModels.find((m: CompositeModel) => m.id === id);
        if (model) syncUpsertCompositeModel(model);
      },

      deleteCompositeModel: (id: string) => {
        set((state: ChatStore) => ({
          compositeModels: state.compositeModels.filter((m: CompositeModel) => m.id !== id),
          chats: state.chats.map((c: Chat) =>
            c.compositeModelId === id ? { ...c, compositeModelId: undefined } : c
          )
        }));
        syncDeleteCompositeModel(id);
      },

      // --- Workflows Actions ---
      addWorkflow: (workflow: Workflow) => {
        set((state: ChatStore) => ({
          workflows: [...state.workflows, workflow]
        }));
        syncUpsertWorkflow(workflow);
      },

      updateWorkflow: (id: string, workflowData: Partial<Workflow>) => {
        set((state: ChatStore) => ({
          workflows: state.workflows.map((w: Workflow) =>
            w.id === id ? { ...w, ...workflowData, updatedAt: new Date() } : w
          )
        }));
        const workflow = get().workflows.find((w: Workflow) => w.id === id);
        if (workflow) syncUpsertWorkflow(workflow);
      },

      deleteWorkflow: (id: string) => {
        set((state: ChatStore) => ({
          workflows: state.workflows.filter((w: Workflow) => w.id !== id)
        }));
        syncDeleteWorkflow(id);
      },

      deleteArtifact: (artifactId: string) => {
        set((state: ChatStore) => ({
          artifacts: state.artifacts.filter((a: Artifact) => a.id !== artifactId),
        }));
      },

      deleteArtifactsForChat: (chatId: string) => {
        set((state: ChatStore) => ({
          artifacts: state.artifacts.filter((a: Artifact) => a.chatId !== chatId),
        }));
      },

      addDebugLog: (log: Omit<DebugLog, 'id' | 'timestamp'> & Partial<Pick<DebugLog, 'id' | 'timestamp'>>) => {
        // Every call site in hooks/useChatSubmit.ts only ever passed
        // {type, message} — DebugLog requires id+timestamp too, which
        // were silently `undefined` on every stored entry until now.
        // Auto-filling here (rather than fixing every call site
        // individually) means it's correct by construction going
        // forward, not just for the sites fixed today.
        const fullLog: DebugLog = {
          id: log.id ?? generateId(),
          timestamp: log.timestamp ?? new Date().toISOString(),
          type: log.type,
          message: log.message,
        };
        set((state: ChatStore) => ({
          debugLogs: [...state.debugLogs, fullLog],
        }));
      },

      clearDebugLogs: () => {
        set({ debugLogs: [] });
      },

      setStreamMetrics: (metrics: StreamMetrics | null) => {
        set({ currentMetrics: metrics });
      },

      clearAll: () => {
        set({ chats: [], currentChatId: null, projects: [], artifacts: [], debugLogs: [], currentMetrics: null });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        ...state,
        chats: state.chats.map((chat: Chat) => ({
          ...chat,
          createdAt: chat.createdAt instanceof Date ? chat.createdAt.toISOString() : chat.createdAt,
          updatedAt: chat.updatedAt instanceof Date ? chat.updatedAt.toISOString() : chat.updatedAt,
          messages: chat.messages.map((msg: Message) => ({
            ...msg,
            timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
          })),
        })),
        projects: state.projects.map((p: Project) => ({
          ...p,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        })),
        artifacts: state.artifacts.map((a: Artifact) => ({
          ...a,
          createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
        })),
      }),
      merge: (persistedState: any, currentState: any) => {
        if (!persistedState) return currentState;
        
        // Migrate chats folderId -> projectId if present
        const chats = (persistedState.chats || []).map((chat: any) => ({
          ...chat,
          projectId: chat.projectId || chat.folderId,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: (chat.messages || []).map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            versions: msg.versions || [msg.content],
            activeVersionIdx: msg.activeVersionIdx !== undefined ? msg.activeVersionIdx : 0,
          })),
        }));

        // Migrate folders -> projects if present
        const rawProjects = persistedState.projects || persistedState.folders || [];
        const projects = rawProjects.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          chatIds: p.chatIds || [],
          createdAt: new Date(p.createdAt),
        }));

        // Parse artifacts
        const artifacts = (persistedState.artifacts || []).map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
        }));
        
        // Parse agents (use preset if missing)
        const agents = persistedState.agents || PRESET_AGENTS;
        const compositeModels = persistedState.compositeModels || PRESET_COMPOSITES;
        const workflows = persistedState.workflows ? persistedState.workflows.map((w: any) => ({
          ...w,
          createdAt: new Date(w.createdAt),
          updatedAt: new Date(w.updatedAt),
        })) : PRESET_WORKFLOWS;

        return {
          ...currentState,
          ...persistedState,
          chats,
          projects,
          artifacts,
          agents,
          compositeModels,
          workflows,
        };
      },
    }
  )
);
