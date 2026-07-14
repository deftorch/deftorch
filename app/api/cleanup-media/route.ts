import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { deleteR2Object, isR2Configured } from '@/lib/r2-client';
import { logger } from '@/lib/logger';

// ============================================================
// Deftorch — Fase D item 6: media_assets expiry cleanup
// ============================================================
// R2's own Object Lifecycle Rules (see R2_SETUP.md §4) delete the actual
// file bytes in R2 after 30 days, but that's a Cloudflare-side rule with
// no way to also touch Supabase — it doesn't know `media_assets` exists.
// This cron does the other half: delete media_assets rows whose
// expires_at has passed, and best-effort delete the matching R2 object
// too (in case this runs before the lifecycle rule does, or the
// lifecycle rule's window is set differently than expires_at).
//
// Same Bearer-token + timing-safe-compare auth pattern as the existing
// app/api/cleanup-images/route.ts (which cleans up a local /public/temp
// dir left over from before Supabase Storage / R2 — unrelated to this
// route, kept separate rather than merged).

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const cronToken = process.env.CRON_TOKEN;

  if (!cronToken) {
    logger.error('CRON_TOKEN environment variable is not set');
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  const expectedHeader = `Bearer ${cronToken}`;
  const isAuthorized =
    authHeader.length === expectedHeader.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedHeader));

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized. Provide a valid Bearer token.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: expired, error: fetchError } = await service
    .from('media_assets')
    .select('id, storage_key, storage_provider')
    .lt('expires_at', new Date().toISOString())
    .limit(500); // batch cap per run — a cron that runs regularly doesn't need to clear an unbounded backlog in one shot

  if (fetchError) {
    logger.error('cleanup-media: fetch expired rows failed', { error: fetchError.message });
    return NextResponse.json({ error: 'Gagal membaca baris kedaluwarsa.' }, { status: 500 });
  }

  let deletedRows = 0;
  let deletedObjects = 0;

  for (const row of expired ?? []) {
    if (row.storage_provider === 'r2' && isR2Configured()) {
      try {
        await deleteR2Object(row.storage_key);
        deletedObjects++;
      } catch (error) {
        // Object may already be gone (R2's own lifecycle rule beat us to
        // it) — log and continue, don't let one failed object block the
        // DB row cleanup for the rest of the batch.
        logger.warn('cleanup-media: R2 object delete failed (continuing)', {
          storageKey: row.storage_key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const { error: deleteError } = await service.from('media_assets').delete().eq('id', row.id);
    if (!deleteError) deletedRows++;
  }

  logger.info('cleanup-media run complete', { deletedRows, deletedObjects, candidateCount: expired?.length ?? 0 });

  return NextResponse.json({ success: true, deletedRows, deletedObjects });
}
