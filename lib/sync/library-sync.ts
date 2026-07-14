import { supabase } from '@/lib/supabaseClient';
import type { Agent, CompositeModel, Workflow } from '@/types';
import { getSyncUserId, syncEnabled } from '@/lib/sync/sync-session';

// ============================================================
// Deftorch — Fase C slice 3: agents / composite models / workflows sync
// ============================================================
// Same best-effort write-through model as chat-sync.ts. Presets (agents/
// composites with isCustom falsy) are never pushed — they're read-only
// system rows (user_id IS NULL) per the RLS design; only user-created
// entries get synced.
//
// Workflows have no isCustom flag in the type (see types/index.ts) — the
// app treats every workflow in the store as a mutable per-user copy, and
// app/api/migrate/route.ts already pushes all of them unfiltered. This
// module does the same for consistency: every workflow syncs.
//
// Child rows (composite_steps, composite_router_rules, workflow_nodes)
// use a full delete-then-insert per save rather than diffing — these
// actions fire on explicit "save" clicks, not on every keystroke, so the
// extra round trip is a non-issue and it's far simpler than reconciling
// reordered/removed steps individually.

function warn(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[library-sync] ${action} failed`, error);
  }
}

// ------------------------------------------------------------
// Agents
// ------------------------------------------------------------
export async function syncUpsertAgent(agent: Agent) {
  if (!syncEnabled() || !agent.isCustom) return;
  try {
    const { error } = await supabase.from('agents').upsert({
      id: agent.id,
      user_id: getSyncUserId(),
      name: agent.name,
      description: agent.description ?? null,
      system_instruction: agent.systemInstruction,
      model_id: agent.modelId,
      temperature: agent.temperature,
      use_search_grounding: agent.useSearchGrounding,
      use_code_execution: agent.useCodeExecution,
      use_structured_outputs: agent.useStructuredOutputs,
      avatar: agent.avatar ?? '🤖',
      is_custom: true,
    });
    if (error) throw error;
  } catch (error) {
    warn('syncUpsertAgent', error);
  }
}

export async function syncDeleteAgent(agentId: string) {
  if (!syncEnabled()) return;
  try {
    const { error } = await supabase.from('agents').delete().eq('id', agentId);
    if (error) throw error;
  } catch (error) {
    warn('syncDeleteAgent', error);
  }
}

// ------------------------------------------------------------
// Composite models (+ steps, router rules)
// ------------------------------------------------------------
export async function syncUpsertCompositeModel(model: CompositeModel) {
  if (!syncEnabled() || !model.isCustom) return;
  try {
    const { error } = await supabase.from('composite_models').upsert({
      id: model.id,
      user_id: getSyncUserId(),
      name: model.name,
      description: model.description ?? null,
      strategy: model.strategy,
      router_model_id: model.routerModelId ?? null,
      fallback_model_id: model.fallbackModelId ?? null,
      aggregator_model_id: model.aggregatorModelId ?? null,
      expert_model_ids: model.expertModelIds ?? null,
      is_custom: true,
    });
    if (error) throw error;

    await supabase.from('composite_steps').delete().eq('composite_model_id', model.id);
    if (model.steps?.length) {
      const { error: stepsError } = await supabase.from('composite_steps').insert(
        model.steps.map((s, idx) => ({
          composite_model_id: model.id,
          step_order: idx,
          model_id: s.modelId,
          role_instruction: s.role || s.prompt || null,
          temperature: s.temperature ?? 0.7,
        }))
      );
      if (stepsError) throw stepsError;
    }

    await supabase.from('composite_router_rules').delete().eq('composite_model_id', model.id);
    if (model.routerRules?.length) {
      const { error: rulesError } = await supabase.from('composite_router_rules').insert(
        model.routerRules.map((r, idx) => ({
          composite_model_id: model.id,
          pattern: r.keyword,
          target_model_id: r.targetModelId,
          priority: idx,
        }))
      );
      if (rulesError) throw rulesError;
    }
  } catch (error) {
    warn('syncUpsertCompositeModel', error);
  }
}

export async function syncDeleteCompositeModel(modelId: string) {
  if (!syncEnabled()) return;
  try {
    // composite_steps / composite_router_rules cascade-delete via FK
    // (see supabase/migrations/0001_schema.sql), no manual cleanup needed.
    const { error } = await supabase.from('composite_models').delete().eq('id', modelId);
    if (error) throw error;
  } catch (error) {
    warn('syncDeleteCompositeModel', error);
  }
}

// ------------------------------------------------------------
// Workflows (+ nodes)
// ------------------------------------------------------------
export async function syncUpsertWorkflow(workflow: Workflow) {
  if (!syncEnabled()) return;
  try {
    const { error } = await supabase.from('workflows').upsert({
      id: workflow.id,
      user_id: getSyncUserId(),
      name: workflow.name,
      description: workflow.description ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    await supabase.from('workflow_nodes').delete().eq('workflow_id', workflow.id);
    if (workflow.nodes?.length) {
      const { error: nodesError } = await supabase.from('workflow_nodes').insert(
        workflow.nodes.map((n) => ({
          workflow_id: workflow.id,
          node_key: n.id,
          type: n.type,
          title: n.title,
          config: n.config ?? {},
          next_node_keys: n.nextNodes ?? [],
          position_x: n.position?.x ?? null,
          position_y: n.position?.y ?? null,
        }))
      );
      if (nodesError) throw nodesError;
    }
  } catch (error) {
    warn('syncUpsertWorkflow', error);
  }
}

export async function syncDeleteWorkflow(workflowId: string) {
  if (!syncEnabled()) return;
  try {
    const { error } = await supabase.from('workflows').delete().eq('id', workflowId);
    if (error) throw error;
  } catch (error) {
    warn('syncDeleteWorkflow', error);
  }
}

// ------------------------------------------------------------
// Pull: custom agents/composites (is_custom=true rows belonging to the
// user) + all of the user's workflows. Presets stay wherever they
// already live client-side (config/deftorch-presets.ts) — callers are
// expected to merge these results with the local preset arrays rather
// than replacing them outright, unlike chats/projects which have no
// preset concept.
// ------------------------------------------------------------
export async function pullLibrary(): Promise<{
  agents: Agent[];
  compositeModels: CompositeModel[];
  workflows: Workflow[];
} | null> {
  if (!syncEnabled()) return null;

  try {
    const [agentsRes, compositesRes, workflowsRes] = await Promise.all([
      supabase.from('agents').select('*').eq('is_custom', true),
      supabase.from('composite_models').select('*, composite_steps(*), composite_router_rules(*)').eq('is_custom', true),
      supabase.from('workflows').select('*, workflow_nodes(*)'),
    ]);
    if (agentsRes.error) throw agentsRes.error;
    if (compositesRes.error) throw compositesRes.error;
    if (workflowsRes.error) throw workflowsRes.error;

    const agents: Agent[] = (agentsRes.data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      systemInstruction: row.system_instruction,
      modelId: row.model_id,
      temperature: row.temperature,
      useSearchGrounding: row.use_search_grounding,
      useCodeExecution: row.use_code_execution,
      useStructuredOutputs: row.use_structured_outputs,
      avatar: row.avatar ?? '🤖',
      isCustom: true,
    }));

    const compositeModels: CompositeModel[] = (compositesRes.data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      strategy: row.strategy,
      isCustom: true,
      routerModelId: row.router_model_id ?? undefined,
      fallbackModelId: row.fallback_model_id ?? undefined,
      aggregatorModelId: row.aggregator_model_id ?? undefined,
      expertModelIds: row.expert_model_ids ?? undefined,
      steps: (row.composite_steps ?? [])
        .sort((a: any, b: any) => a.step_order - b.step_order)
        .map((s: any) => ({
          id: s.id,
          modelId: s.model_id,
          role: s.role_instruction ?? '',
          prompt: s.role_instruction ?? '',
          temperature: s.temperature ?? 0.7,
        })),
      routerRules: (row.composite_router_rules ?? [])
        .sort((a: any, b: any) => a.priority - b.priority)
        .map((r: any) => ({ id: r.id, keyword: r.pattern, targetModelId: r.target_model_id })),
    }));

    const workflows: Workflow[] = (workflowsRes.data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      nodes: (row.workflow_nodes ?? []).map((n: any) => ({
        id: n.node_key,
        type: n.type,
        title: n.title,
        config: n.config ?? {},
        nextNodes: n.next_node_keys ?? [],
        position: n.position_x != null && n.position_y != null ? { x: n.position_x, y: n.position_y } : undefined,
      })),
    }));

    return { agents, compositeModels, workflows };
  } catch (error) {
    warn('pullLibrary', error);
    return null;
  }
}
