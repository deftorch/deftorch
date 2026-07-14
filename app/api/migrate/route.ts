import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { migrateRateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

// One-time migration: reads the Zustand/localStorage shape the client
// already has (chat-store.ts / settings-store.ts) and upserts it into
// the tables created in supabase/migrations/0001_schema.sql, scoped to
// the authenticated caller. Every entity is written with the client's
// own id and `onConflict: 'id'`, so this is safe to call repeatedly —
// including retries after a partial failure — without duplicating data
// or leaving a partially-migrated user stuck (see the long comment above
// the upsert logic below for why the original "skip if any chat already
// exists server-side" guard was a data-loss trap and was removed).
//
// Auth model: the client sends its Supabase access token as a Bearer
// header. We verify it with the anon client, then use the service-role
// client for the actual writes (bypassing RLS) — but every write is
// hard-scoped to that verified user_id, never to anything from the body.

const attachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  dataUrl: z.string(),
  preview: z.string().optional(),
});

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.union([z.string(), z.date()]).optional(),
  isEdited: z.boolean().optional(),
  parentId: z.string().optional(),
  versions: z.array(z.string()).optional(),
  activeVersionIdx: z.number().optional(),
  attachments: z.array(attachmentSchema).optional(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  agentName: z.string().optional(),
  agentAvatar: z.string().optional(),
});

const chatSchema = z.object({
  id: z.string(),
  title: z.string(),
  messages: z.array(messageSchema).default([]),
  modelConfig: z.record(z.any()).default({}),
  summary: z.string().optional(),
  lastSummarizedIndex: z.number().optional(),
  isStarred: z.boolean().default(false),
  totalTokens: z.number().default(0),
  projectId: z.string().optional(),
  agentId: z.string().optional(),
  compositeModelId: z.string().optional(),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

const agentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  systemInstruction: z.string(),
  modelId: z.string(),
  temperature: z.number().default(0.7),
  useSearchGrounding: z.boolean().default(false),
  useCodeExecution: z.boolean().default(false),
  useStructuredOutputs: z.boolean().default(false),
  avatar: z.string().optional(),
});

const compositeModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  strategy: z.enum(['sequential', 'routing', 'consensus']),
  steps: z
    .array(
      z.object({ id: z.string(), modelId: z.string(), role: z.string(), prompt: z.string() })
    )
    .optional(),
  routerModelId: z.string().optional(),
  routerRules: z
    .array(
      z.object({ id: z.string(), keyword: z.string(), targetModelId: z.string() })
    )
    .optional(),
  fallbackModelId: z.string().optional(),
  expertModelIds: z.array(z.string()).optional(),
  aggregatorModelId: z.string().optional(),
});

const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['trigger', 'agent', 'tool', 'condition', 'output']),
        title: z.string(),
        config: z.record(z.any()).default({}),
        nextNodes: z.array(z.string()).default([]),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
      })
    )
    .default([]),
});

const preferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    fontSize: z.enum(['small', 'medium', 'large']).optional(),
    language: z.string().optional(),
    defaultModel: z.string().optional(),
    defaultProvider: z.string().optional(),
    autoSave: z.boolean().optional(),
    showTokenCount: z.boolean().optional(),
    enableNotifications: z.boolean().optional(),
    developerMode: z.boolean().optional(),
    defaultSystemInstruction: z.string().optional(),
  })
  .optional();

const migratePayloadSchema = z.object({
  chats: z.array(chatSchema).default([]),
  projects: z.array(projectSchema).default([]),
  agents: z.array(agentSchema).default([]), // custom-only, filtered client-side
  compositeModels: z.array(compositeModelSchema).default([]), // custom-only
  workflows: z.array(workflowSchema).default([]),
  preferences: preferencesSchema,
});

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  try {
    migrateRateLimiter.check(5, request);
  } catch {
    return NextResponse.json({ error: 'Terlalu banyak percobaan migrasi.' }, { status: 429 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Tidak ada sesi login yang valid.' }, { status: 401 });
  }

  const anon = getAnonClient();
  const service = getServiceClient();
  if (!anon || !service) {
    return NextResponse.json(
      { error: 'Supabase belum dikonfigurasi di server (env NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 }
    );
  }

  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Sesi tidak valid atau sudah kedaluwarsa.' }, { status: 401 });
  }
  const userId = userData.user.id;

  let body: z.infer<typeof migratePayloadSchema>;
  try {
    body = migratePayloadSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload migrasi tidak valid', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Gagal membaca payload migrasi' }, { status: 400 });
  }

  // Idempotency: every entity below is upserted using the CLIENT's own
  // id (chat-store.ts already generates proper uuidv4s via
  // lib/utils.ts#generateId) as the row's primary key, with
  // `onConflict: 'id'`. This makes the whole migration safe to call
  // repeatedly — including after a partial failure.
  //
  // Previously this endpoint did a plain insert() + a coarse guard
  // ("if the user has ANY chat server-side, skip the entire migration").
  // That guard was a real data-loss trap: if migration failed partway
  // (e.g. network drop after 5 of 20 chats were inserted), the client
  // correctly did NOT mark itself migrated (res.ok was false) — but the
  // next retry would see `existingChats > 0` from those 5 already-
  // inserted chats and return `{skipped: true}` with a 200, which the
  // client DOES treat as success. The remaining 15 chats (and any
  // agents/composites/workflows that hadn't made it yet) would then be
  // permanently stranded in localStorage, never retried again. Using the
  // client's own id + upsert instead means a retry just re-writes
  // already-migrated rows (harmless no-op) and inserts whatever didn't
  // make it the first time — there is no partial state that can get
  // silently "skipped" as if it were complete.

  try {
    // 1. Preferences (upsert — row already exists from the signup trigger)
    if (body.preferences) {
      const p = body.preferences;
      await service.from('user_preferences').update({
        theme: p.theme,
        font_size: p.fontSize,
        language: p.language,
        default_model: p.defaultModel,
        default_provider: p.defaultProvider,
        auto_save: p.autoSave,
        show_token_count: p.showTokenCount,
        enable_notifications: p.enableNotifications,
        developer_mode: p.developerMode,
        default_system_instruction: p.defaultSystemInstruction,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    }

    // 2. Projects — id = client's local id directly, no more idMap bookkeeping
    if (body.projects.length > 0) {
      const { error } = await service.from('projects').upsert(
        body.projects.map((p) => ({
          id: p.id,
          user_id: userId,
          name: p.name,
          description: p.description ?? null,
        })),
        { onConflict: 'id' }
      );
      if (error) throw error;
    }

    // 3. Custom agents
    if (body.agents.length > 0) {
      const { error } = await service.from('agents').upsert(
        body.agents.map((a) => ({
          id: a.id,
          user_id: userId,
          name: a.name,
          description: a.description ?? null,
          system_instruction: a.systemInstruction,
          model_id: a.modelId,
          temperature: a.temperature,
          use_search_grounding: a.useSearchGrounding,
          use_code_execution: a.useCodeExecution,
          use_structured_outputs: a.useStructuredOutputs,
          avatar: a.avatar ?? '🤖',
          is_custom: true,
        })),
        { onConflict: 'id' }
      );
      if (error) throw error;
    }

    // 4. Custom composite models + their steps/rules
    for (const cm of body.compositeModels) {
      const { error } = await service.from('composite_models').upsert(
        {
          id: cm.id,
          user_id: userId,
          name: cm.name,
          description: cm.description ?? null,
          strategy: cm.strategy,
          router_model_id: cm.routerModelId ?? null,
          fallback_model_id: cm.fallbackModelId ?? null,
          aggregator_model_id: cm.aggregatorModelId ?? null,
          expert_model_ids: cm.expertModelIds ?? null,
          is_custom: true,
        },
        { onConflict: 'id' }
      );
      if (error) throw error;

      // Children have no client-supplied id to upsert against, but the
      // parent id is now stable across retries — delete-then-reinsert
      // scoped to it is naturally idempotent (same pattern already used
      // by lib/sync/library-sync.ts for regular saves, not a new one
      // invented just for this endpoint).
      await service.from('composite_steps').delete().eq('composite_model_id', cm.id);
      if (cm.steps?.length) {
        await service.from('composite_steps').insert(
          cm.steps.map((s, idx) => ({
            composite_model_id: cm.id,
            step_order: idx,
            model_id: s.modelId,
            role_instruction: s.role || s.prompt || null,
          }))
        );
      }

      await service.from('composite_router_rules').delete().eq('composite_model_id', cm.id);
      if (cm.routerRules?.length) {
        await service.from('composite_router_rules').insert(
          cm.routerRules.map((r, idx) => ({
            composite_model_id: cm.id,
            pattern: r.keyword,
            target_model_id: r.targetModelId,
            priority: idx,
          }))
        );
      }
    }

    // 5. Workflows + nodes
    for (const wf of body.workflows) {
      const { error } = await service.from('workflows').upsert(
        { id: wf.id, user_id: userId, name: wf.name, description: wf.description ?? null },
        { onConflict: 'id' }
      );
      if (error) throw error;

      await service.from('workflow_nodes').delete().eq('workflow_id', wf.id);
      if (wf.nodes.length) {
        await service.from('workflow_nodes').insert(
          wf.nodes.map((n) => ({
            workflow_id: wf.id,
            node_key: n.id,
            type: n.type,
            title: n.title,
            config: n.config ?? {},
            next_node_keys: n.nextNodes ?? [],
            position_x: n.position?.x ?? null,
            position_y: n.position?.y ?? null,
          }))
        );
      }
    }

    // 6. Chats + messages + versions
    //
    // chat.agentId / chat.compositeModelId may point at a PRESET
    // (isCustom: false) agent/composite model — those are deliberately
    // excluded from body.agents/body.compositeModels (see the client
    // payload in app/page.tsx and the note in library-sync.ts: presets
    // aren't rows any single user owns, so they're never migrated).
    // There's also no seed migration that inserts PRESET_AGENTS /
    // PRESET_COMPOSITES into the agents/composite_models tables with
    // matching ids. Passing a preset id straight through as a foreign
    // key would violate the chats.agent_id / chats.composite_model_id
    // FK constraint (no such row exists server-side) and fail the whole
    // upsert for that chat. Only pass the id through if it's one we
    // actually just migrated in this same request.
    const customAgentIds = new Set(body.agents.map((a) => a.id));
    const customCompositeIds = new Set(body.compositeModels.map((c) => c.id));

    for (const chat of body.chats) {
      const { error } = await service.from('chats').upsert(
        {
          id: chat.id,
          user_id: userId,
          project_id: chat.projectId ?? null,
          agent_id: chat.agentId && customAgentIds.has(chat.agentId) ? chat.agentId : null,
          composite_model_id:
            chat.compositeModelId && customCompositeIds.has(chat.compositeModelId) ? chat.compositeModelId : null,
          title: chat.title,
          model_config: chat.modelConfig ?? {},
          summary: chat.summary ?? null,
          last_summarized_index: chat.lastSummarizedIndex ?? null,
          is_starred: chat.isStarred,
          total_tokens: chat.totalTokens,
        },
        { onConflict: 'id' }
      );
      if (error) throw error;

      if (chat.messages.length) {
        const { error: msgError } = await service.from('messages').upsert(
          chat.messages.map((m) => ({
            id: m.id,
            chat_id: chat.id,
            role: m.role,
            content: m.content,
            attachments: m.attachments ?? [],
            prompt_tokens: m.promptTokens ?? 0,
            completion_tokens: m.completionTokens ?? 0,
            total_tokens: m.totalTokens ?? 0,
            agent_name: m.agentName ?? null,
            agent_avatar: m.agentAvatar ?? null,
            is_edited: m.isEdited ?? false,
            active_version_idx: m.activeVersionIdx ?? 0,
          })),
          { onConflict: 'id' }
        );
        if (msgError) throw msgError;

        // message_versions: no client-supplied id, but (message_id,
        // version_index) is already a unique constraint in
        // 0001_schema.sql — upsert against that instead of delete+insert,
        // since unlike steps/nodes above there's no single parent id to
        // scope a delete to without an extra round trip.
        const versionRows: { message_id: string; version_index: number; content: string }[] = [];
        chat.messages.forEach((m) => {
          if (m.versions?.length) {
            m.versions.forEach((content, vIdx) => {
              versionRows.push({ message_id: m.id, version_index: vIdx, content });
            });
          }
        });
        if (versionRows.length) {
          const { error: versionError } = await service
            .from('message_versions')
            .upsert(versionRows, { onConflict: 'message_id,version_index' });
          if (versionError) throw versionError;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Migration failed', { userId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Migrasi gagal di tengah jalan. Data lokal tetap aman, retry akan melanjutkan dari sisa yang belum tersimpan.' }, { status: 500 });
  }
}
