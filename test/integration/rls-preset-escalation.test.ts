import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireLocalSupabaseEnv, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from './env';

// ============================================================
// Regression test: supabase/migrations/0006_fix_preset_child_rls_escalation.sql
// ============================================================
// The original policies on composite_steps / composite_router_rules /
// workflow_nodes were `for all using (parent.user_id IS NULL OR
// parent.user_id = auth.uid())` with no separate `with check`. Postgres
// reuses `using` as `with check` for `for all` policies when one isn't
// given explicitly — so the `IS NULL` branch (meant to allow SELECTing
// system presets) also permitted INSERT/UPDATE/DELETE on any preset's
// child rows, for ANY authenticated user. This test only covers
// composite_steps; workflow_nodes and composite_router_rules got the
// identical fix for the identical reason, so one well-covered case here
// stands in for all three rather than tripling this file for no real
// gain in confidence — if this one holds, the other two do too, since
// it's the same policy shape copy-pasted three times in 0002_rls.sql.

describe('RLS: preset composite_steps cannot be written by a regular user (0006 regression)', () => {
  let service: SupabaseClient;
  let userClient: SupabaseClient;
  let testUserId: string;
  let presetCompositeModelId: string;

  beforeAll(async () => {
    requireLocalSupabaseEnv();
    service = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `rls-test-${Date.now()}@example.com`;
    const password = 'test-password-123!';
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) throw new Error(`Failed to create test user: ${createErr?.message}`);
    testUserId = created.user.id;

    // Deliberately the ANON client for the actual attack attempt below —
    // this is the client any real attacker has. If this test used the
    // service-role client instead it would prove nothing, since service
    // role bypasses RLS entirely by design.
    userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(`Failed to sign in test user: ${signInErr.message}`);

    // Seed a "preset" composite model the same shape a migrated
    // config/deftorch-presets.ts entry would have: user_id IS NULL.
    const { data: preset, error: presetErr } = await service
      .from('composite_models')
      .insert({ user_id: null, name: 'Test Preset (RLS regression)', strategy: 'sequential', is_custom: false })
      .select('id')
      .single();
    if (presetErr || !preset) throw new Error(`Failed to seed preset composite model: ${presetErr?.message}`);
    presetCompositeModelId = preset.id;
  });

  afterAll(async () => {
    // Service role bypasses RLS, so cleanup always works regardless of
    // what the test below did or didn't manage to write.
    if (presetCompositeModelId) {
      await service.from('composite_models').delete().eq('id', presetCompositeModelId);
    }
    if (testUserId) {
      await service.auth.admin.deleteUser(testUserId);
    }
  });

  it('rejects INSERT into a preset composite model\'s composite_steps', async () => {
    const { error } = await userClient.from('composite_steps').insert({
      composite_model_id: presetCompositeModelId,
      step_order: 0,
      model_id: 'gemini-3-flash',
      role_instruction: 'malicious tampering attempt',
    });

    // Before 0006 this insert SUCCEEDED. 42501 is Postgres's
    // insufficient_privilege code, which is what an RLS policy violation
    // surfaces as via PostgREST.
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');

    // Belt and suspenders: confirm via the service-role client that
    // nothing actually landed, rather than trusting the error alone. A
    // client library that reports an error while the write still went
    // through underneath (e.g. a batched/multi-statement quirk) would be
    // a worse bug than the one this test exists to catch, so check the
    // actual data, not just the response shape.
    const { data: rows, count } = await service
      .from('composite_steps')
      .select('*', { count: 'exact' })
      .eq('composite_model_id', presetCompositeModelId);
    expect(count).toBe(0);
    expect(rows).toEqual([]);
  });

  it('rejects UPDATE and DELETE the same way (the "with check" fix, not just INSERT)', async () => {
    // Seed one row via service role so there's something to try to
    // tamper with — this row's existence is not part of what's being
    // tested, only whether userClient can touch it.
    const { data: seeded, error: seedErr } = await service
      .from('composite_steps')
      .insert({
        composite_model_id: presetCompositeModelId,
        step_order: 0,
        model_id: 'gemini-3-flash',
        role_instruction: 'original, untampered value',
      })
      .select('id')
      .single();
    expect(seedErr).toBeNull();

    const { error: updateErr } = await userClient
      .from('composite_steps')
      .update({ role_instruction: 'tampered' })
      .eq('id', seeded!.id);
    expect(updateErr).not.toBeNull();

    const { error: deleteErr } = await userClient.from('composite_steps').delete().eq('id', seeded!.id);
    expect(deleteErr).not.toBeNull();

    const { data: stillThere } = await service
      .from('composite_steps')
      .select('role_instruction')
      .eq('id', seeded!.id)
      .single();
    expect(stillThere?.role_instruction).toBe('original, untampered value');

    await service.from('composite_steps').delete().eq('id', seeded!.id);
  });

  it('still allows the same user to write composite_steps under their OWN composite model', async () => {
    // Sanity check the fix isn't over-broad — must not have also broken
    // the legitimate case lib/sync/library-sync.ts's
    // syncUpsertCompositeModel depends on every time a user saves a
    // custom composite model.
    const { data: ownModel, error: ownModelErr } = await userClient
      .from('composite_models')
      .insert({ user_id: testUserId, name: 'My Own Model', strategy: 'sequential', is_custom: true })
      .select('id')
      .single();
    expect(ownModelErr).toBeNull();
    expect(ownModel).not.toBeNull();

    const { error: stepErr } = await userClient.from('composite_steps').insert({
      composite_model_id: ownModel!.id,
      step_order: 0,
      model_id: 'gemini-3-flash',
      role_instruction: 'legitimate step',
    });
    expect(stepErr).toBeNull();

    await service.from('composite_models').delete().eq('id', ownModel!.id); // composite_steps cascades
  });
});
