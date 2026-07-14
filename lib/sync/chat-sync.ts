import { supabase } from '@/lib/supabaseClient';
import type { Chat, Message, Project } from '@/types';
import { getSyncUserId, syncEnabled } from '@/lib/sync/sync-session';

// ============================================================
// Deftorch — Fase C slice 2: chat-store <-> Supabase sync
// ============================================================
// Scope of this module (deliberately limited — see FASE_C_PROGRESS.md):
//   - chats, messages, message_versions, projects
// NOT covered here: agents / composite_models / workflows CRUD sync.
// Those still only live in localStorage after this slice; presets are
// read-only anyway and custom ones are low-frequency writes, so they
// were left for a follow-up pass rather than growing this one further.
//
// Model: best-effort write-through + pull-on-login. Every write here is
// fire-and-forget from the caller's perspective — a failed sync call
// never throws into the UI and never blocks a local mutation, because
// localStorage remains the always-available fallback. There is no
// realtime subscription (multi-tab live updates) yet; a signed-in
// session picks up other devices' changes on next sign-in / page load,
// not instantly. Real Realtime channels are a reasonable next step but
// out of scope for this slice.
//
// RLS does the access-control work here: all calls go through the
// normal anon `supabase` client (not service-role), so a signed-out
// user's calls are simply rejected by Postgres — `enabled()` below is
// a client-side short-circuit to avoid pointless network calls, not
// the actual security boundary.

function enabled(): boolean {
  return syncEnabled();
}

function warn(action: string, error: unknown) {
  // Sync failures are expected occasionally (offline, RLS edge cases,
  // parent row not yet pushed) — log for debugging, never surface to UI.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[chat-sync] ${action} failed`, error);
  }
}

// ------------------------------------------------------------
// Chats
// ------------------------------------------------------------
export async function syncUpsertChat(chat: Chat) {
  if (!enabled()) return;
  try {
    const { error } = await supabase.from('chats').upsert({
      id: chat.id,
      user_id: getSyncUserId(),
      project_id: chat.projectId ?? null,
      agent_id: chat.agentId ?? null,
      composite_model_id: chat.compositeModelId ?? null,
      title: chat.title,
      model_config: chat.modelConfig ?? {},
      summary: chat.summary ?? null,
      last_summarized_index: chat.lastSummarizedIndex ?? null,
      is_starred: chat.isStarred,
      total_tokens: chat.totalTokens,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (error) {
    warn('syncUpsertChat', error);
  }
}

export async function syncDeleteChat(chatId: string) {
  if (!enabled()) return;
  try {
    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    if (error) throw error;
  } catch (error) {
    warn('syncDeleteChat', error);
  }
}

// ------------------------------------------------------------
// Messages (+ versions)
// ------------------------------------------------------------
export async function syncUpsertMessage(chatId: string, message: Message) {
  if (!enabled()) return;
  try {
    const { error } = await supabase.from('messages').upsert({
      id: message.id,
      chat_id: chatId,
      role: message.role,
      content: message.content,
      attachments: message.attachments ?? [],
      prompt_tokens: message.promptTokens ?? 0,
      completion_tokens: message.completionTokens ?? 0,
      total_tokens: message.totalTokens ?? 0,
      agent_name: message.agentName ?? null,
      agent_avatar: message.agentAvatar ?? null,
      is_edited: message.isEdited ?? false,
      active_version_idx: message.activeVersionIdx ?? 0,
    });
    if (error) throw error;

    if (message.versions && message.versions.length > 1) {
      const { error: vError } = await supabase.from('message_versions').upsert(
        message.versions.map((content, idx) => ({
          message_id: message.id,
          version_index: idx,
          content,
        }))
      );
      if (vError) throw vError;
    }
  } catch (error) {
    warn('syncUpsertMessage', error);
  }
}

export async function syncDeleteMessage(messageId: string) {
  if (!enabled()) return;
  try {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) throw error;
  } catch (error) {
    warn('syncDeleteMessage', error);
  }
}

// ------------------------------------------------------------
// Projects
// ------------------------------------------------------------
export async function syncUpsertProject(project: Project) {
  if (!enabled()) return;
  try {
    const { error } = await supabase.from('projects').upsert({
      id: project.id,
      user_id: getSyncUserId(),
      name: project.name,
      description: project.description ?? null,
    });
    if (error) throw error;
  } catch (error) {
    warn('syncUpsertProject', error);
  }
}

export async function syncDeleteProject(projectId: string) {
  if (!enabled()) return;
  try {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
  } catch (error) {
    warn('syncDeleteProject', error);
  }
}

// ------------------------------------------------------------
// Pull: hydrate local store from Supabase (server treated as source
// of truth once signed in — called once right after sign-in / after
// the one-time localStorage migration settles).
// ------------------------------------------------------------
export async function pullChatsAndProjects(): Promise<{ chats: Chat[]; projects: Project[] } | null> {
  if (!enabled()) return null;

  try {
    const [{ data: chatRows, error: chatError }, { data: projectRows, error: projectError }] = await Promise.all([
      supabase
        .from('chats')
        .select('*, messages(*, message_versions(*))')
        .order('updated_at', { ascending: false }),
      supabase.from('projects').select('*'),
    ]);
    if (chatError) throw chatError;
    if (projectError) throw projectError;

    const chats: Chat[] = (chatRows ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      messages: (row.messages ?? [])
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((m: any) => {
          const versions = (m.message_versions ?? [])
            .sort((a: any, b: any) => a.version_index - b.version_index)
            .map((v: any) => v.content);
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
            isEdited: m.is_edited,
            versions: versions.length > 0 ? versions : [m.content],
            activeVersionIdx: m.active_version_idx ?? 0,
            attachments: m.attachments ?? [],
            promptTokens: m.prompt_tokens ?? 0,
            completionTokens: m.completion_tokens ?? 0,
            totalTokens: m.total_tokens ?? 0,
            agentName: m.agent_name ?? undefined,
            agentAvatar: m.agent_avatar ?? undefined,
          } as Message;
        }),
      modelConfig: row.model_config ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      summary: row.summary ?? undefined,
      lastSummarizedIndex: row.last_summarized_index ?? undefined,
      projectId: row.project_id ?? undefined,
      isStarred: row.is_starred,
      totalTokens: row.total_tokens,
      agentId: row.agent_id ?? undefined,
      compositeModelId: row.composite_model_id ?? undefined,
    }));

    const chatIdsByProject = new Map<string, string[]>();
    chats.forEach((c) => {
      if (!c.projectId) return;
      chatIdsByProject.set(c.projectId, [...(chatIdsByProject.get(c.projectId) ?? []), c.id]);
    });

    const projects: Project[] = (projectRows ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      chatIds: chatIdsByProject.get(row.id) ?? [],
      createdAt: new Date(row.created_at),
    }));

    return { chats, projects };
  } catch (error) {
    warn('pullChatsAndProjects', error);
    return null;
  }
}
