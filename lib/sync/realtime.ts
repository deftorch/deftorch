import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useChatStore } from '@/lib/store/chat-store';

// ============================================================
// Deftorch — Fase C slice 4 (+follow-up): Realtime
// ============================================================
// chats + messages + message_versions: fine-grained, patched directly into
// the store (see applyRemoteChatUpsert/Delete, applyRemoteMessageUpsert/
// Delete, applyRemoteMessageVersionUpsert) — these change often enough
// (every token during streaming settles into one write, every new chat,
// every edit/regenerate) that patching beats re-fetching everything.
//
// agents / composite_models / composite_steps / composite_router_rules /
// workflows / workflow_nodes: coarse-grained. These change rarely (a
// user edits an agent maybe a few times a session, not every second),
// and a single "save" in the UI touches 2-3 of these tables at once
// (e.g. saving a composite model = one row in composite_models + a
// delete+reinsert of composite_steps — see library-sync.ts), which would
// otherwise fire 3+ separate fine-grained patches to reconcile. Simplest
// correct approach: any change on any of these tables triggers one
// debounced pullLibraryFromSupabase() that re-fetches the lot. Given how
// infrequently these tables change, the extra round trip is a non-issue.
//
// Requires supabase/migrations/0004_realtime.sql (chats/messages),
// 0005_composite_step_temperature_and_library_realtime.sql (the rest),
// and 0007_message_versions_realtime.sql (message_versions) to all be
// applied — Realtime does nothing for a table left out of the
// `supabase_realtime` publication, regardless of RLS.

let activeChannel: RealtimeChannel | null = null;
let activeUserId: string | null = null;
let libraryRefetchTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleLibraryRefetch() {
  if (libraryRefetchTimer) clearTimeout(libraryRefetchTimer);
  // 500ms: long enough to coalesce the handful of table writes a single
  // "save composite model" or "save workflow" click produces, short
  // enough that it still feels live to whoever's watching the other tab.
  libraryRefetchTimer = setTimeout(() => {
    useChatStore.getState().pullLibraryFromSupabase();
  }, 500);
}

export function startRealtimeSync(userId: string) {
  if (activeChannel && activeUserId === userId) return; // already subscribed for this user
  stopRealtimeSync();

  activeChannel = supabase
    .channel(`deftorch-sync-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chats', filter: `user_id=eq.${userId}` },
      (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
        if (payload.eventType === 'DELETE') {
          // DELETE payloads only reliably carry the old row's primary key
          const oldId = (payload.old as any)?.id;
          if (oldId) useChatStore.getState().applyRemoteChatDelete(oldId);
        } else {
          useChatStore.getState().applyRemoteChatUpsert(payload.new);
        }
      }
    )
    .on(
      // messages has no user_id column (ownership is via its parent chat),
      // so this can't be filtered server-side the way chats can — RLS
      // still restricts which rows this client is allowed to receive at
      // all, this just can't narrow the subscription further up front.
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any)?.id;
          if (oldId) useChatStore.getState().applyRemoteMessageDelete(oldId);
        } else {
          useChatStore.getState().applyRemoteMessageUpsert(payload.new);
        }
      }
    )
    .on(
      // Same ownership caveat as messages above (via message_id -> chat_id
      // -> user_id), plus DELETE is intentionally not handled: nothing in
      // the app currently deletes individual message_versions rows (edit/
      // regenerate only ever appends or upserts — see library-sync.ts /
      // migrate/route.ts), only ever the whole message via cascade.
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_versions' },
      (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
        if (payload.eventType !== 'DELETE') {
          useChatStore.getState().applyRemoteMessageVersionUpsert(payload.new);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agents', filter: `user_id=eq.${userId}` },
      scheduleLibraryRefetch
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'composite_models', filter: `user_id=eq.${userId}` },
      scheduleLibraryRefetch
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'composite_steps' }, scheduleLibraryRefetch)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'composite_router_rules' }, scheduleLibraryRefetch)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workflows', filter: `user_id=eq.${userId}` },
      scheduleLibraryRefetch
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_nodes' }, scheduleLibraryRefetch)
    .subscribe();

  activeUserId = userId;
}

export function stopRealtimeSync() {
  if (libraryRefetchTimer) {
    clearTimeout(libraryRefetchTimer);
    libraryRefetchTimer = null;
  }
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    activeUserId = null;
  }
}
