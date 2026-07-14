import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { POST as migratePOST } from '@/app/api/migrate/route';
import { requireLocalSupabaseEnv, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from './env';

// ============================================================
// Regression test: app/api/migrate/route.ts idempotency
// ============================================================
// The original guard was `if (existingChats > 0) return {skipped:true}`
// (status 200). If a migration call died partway through (5 of 20 chats
// inserted, then a network drop), the CLIENT never set its
// `deftorch-migrated` flag (that request failed), but the SERVER now had
// >0 chats for that user — so the retry would hit the guard and skip
// the entire migration, permanently abandoning the other 15 chats. This
// test reproduces that exact shape (a first call with a partial data
// set, followed by a second call with the FULL data set simulating a
// client retry with everything it has) and asserts nothing gets lost on
// the second call — the current implementation should upsert
// (`onConflict: 'id'`) rather than skip, so calling again with more data
// should just... add the rest.

function makeChat(overrides: Partial<{ id: string; title: string }> = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    title: overrides.title ?? 'Untitled chat',
    messages: [
      { id: randomUUID(), role: 'user' as const, content: 'hello' },
      { id: randomUUID(), role: 'assistant' as const, content: 'hi there' },
    ],
    modelConfig: { model: 'gemini-3-flash' },
    isStarred: false,
    totalTokens: 0,
  };
}

function migrateRequest(accessToken: string, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/migrate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

describe('Migrate idempotency (data-loss regression)', () => {
  let service: SupabaseClient;
  let accessToken: string;
  let testUserId: string;

  beforeAll(async () => {
    requireLocalSupabaseEnv();
    service = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `migrate-test-${Date.now()}@example.com`;
    const password = 'test-password-123!';
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) throw new Error(`Failed to create test user: ${createErr?.message}`);
    testUserId = created.user.id;

    const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data: signedIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !signedIn.session) throw new Error(`Failed to sign in test user: ${signInErr?.message}`);
    accessToken = signedIn.session.access_token;
  });

  afterAll(async () => {
    if (testUserId) {
      await service.from('chats').delete().eq('user_id', testUserId); // messages cascade
      await service.auth.admin.deleteUser(testUserId);
    }
  });

  it('does not abandon later chats when migrate is called again after a partial first call', async () => {
    const chatA = makeChat({ title: 'Chat A (made it in the first, "interrupted" call)' });
    const chatB = makeChat({ title: 'Chat B (made it in the first, "interrupted" call)' });
    const chatC = makeChat({ title: 'Chat C (only present in the retry payload)' });

    // Call 1: simulates a client that died after only A and B made it
    // into the request it managed to send.
    const res1 = await migratePOST(migrateRequest(accessToken, { chats: [chatA, chatB] }));
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);

    // Call 2: simulates the client retrying with everything it has,
    // because it never got a successful response the first time (or the
    // user just reopened the app and localStorage still has all three).
    // Pre-fix, this call would see `existingChats > 0` (from A and B
    // already being there) and return {skipped:true} WITHOUT ever
    // writing C.
    const res2 = await migratePOST(migrateRequest(accessToken, { chats: [chatA, chatB, chatC] }));
    expect(res2.status).toBe(200);
    const body2 = await res2.json();

    // The critical assertion: this must NOT be a silent skip. Either the
    // route processes it fully (success:true) or it explicitly does
    // something else — but "skipped: true" here would mean the bug is
    // back.
    expect(body2.skipped).not.toBe(true);

    const { data: serverChats, error } = await service
      .from('chats')
      .select('id, title')
      .eq('user_id', testUserId);
    expect(error).toBeNull();

    const serverIds = new Set((serverChats ?? []).map((c) => c.id));
    expect(serverIds.has(chatA.id)).toBe(true);
    expect(serverIds.has(chatB.id)).toBe(true);
    // This is the one that would have failed against the old
    // "skip if existingChats > 0" guard.
    expect(serverIds.has(chatC.id)).toBe(true);
    expect(serverChats?.length).toBe(3);
  });

  it('calling migrate twice with the exact same chat does not duplicate it', async () => {
    const chat = makeChat({ title: 'Same chat, migrated twice' });

    const res1 = await migratePOST(migrateRequest(accessToken, { chats: [chat] }));
    expect(res1.status).toBe(200);
    const res2 = await migratePOST(migrateRequest(accessToken, { chats: [chat] }));
    expect(res2.status).toBe(200);

    const { data: rows, count } = await service
      .from('chats')
      .select('id', { count: 'exact' })
      .eq('id', chat.id);
    expect(count).toBe(1);
    expect(rows?.length).toBe(1);
  });
});
