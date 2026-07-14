import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteAccountRateLimiter } from '@/lib/rate-limiter';
import { deleteR2Object } from '@/lib/r2-client';
import { logger } from '@/lib/logger';

// Deletes a user's account and everything owned by it.
//
// Cascade coverage: every FK in 0001_schema.sql chains
// auth.users -> profiles -> {projects, agents, composite_models,
// workflows, chats -> messages -> message_versions, usage_logs} with
// `on delete cascade`, so calling auth.admin.deleteUser() alone already
// removes all of those.
//
// media_assets is the ONE deliberate exception — it uses
// `on delete set null` (see 0001_schema.sql), not cascade, so that media
// referenced from a chat someone else still has access to (a shared/
// exported chat, once that exists) doesn't vanish out from under them
// just because the uploader deleted their account. That means an
// account deletion has to explicitly clean up the requesting user's OWN
// media_assets + their R2 objects first — auth.admin.deleteUser() will
// not do this for us, and skipping it would silently leak storage
// (orphaned R2 objects with no owner, costing money forever with no way
// to find them again through the app).
//
// Auth model: same as migrate/route.ts and upload-media/* — Bearer token
// verified against the anon client, service-role client used for the
// actual deletes, every operation scoped to that verified user_id.

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
    deleteAccountRateLimiter.check(5, request);
  } catch {
    return NextResponse.json({ error: 'Terlalu banyak percobaan.' }, { status: 429 });
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

  // 1. Clean up this user's own R2 objects BEFORE touching the database —
  // once media_assets rows are gone (whether via the explicit delete
  // below or a future cascade change), there's no way to recover their
  // storage_key to clean up R2 after the fact.
  const { data: assets, error: assetsError } = await service
    .from('media_assets')
    .select('id, storage_key')
    .eq('user_id', userId);

  if (assetsError) {
    logger.error('Failed to list media_assets before account deletion', { userId, error: assetsError.message });
    return NextResponse.json({ error: 'Gagal membaca data media. Coba lagi.' }, { status: 500 });
  }

  const r2Failures: string[] = [];
  for (const asset of assets ?? []) {
    try {
      await deleteR2Object(asset.storage_key);
    } catch (err) {
      // Best-effort: log and keep going rather than aborting the whole
      // account deletion because one stale R2 object 404s or the R2
      // credentials hiccup. A stray object with no DB row left behind is
      // a storage-cost cleanup task, not a reason to block someone from
      // deleting their account — surfaced in the response so an admin
      // can follow up manually if it happens.
      r2Failures.push(asset.storage_key);
      logger.error('R2 object delete failed during account deletion', {
        userId,
        storageKey: asset.storage_key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (assets && assets.length > 0) {
    const { error: deleteAssetsError } = await service.from('media_assets').delete().eq('user_id', userId);
    if (deleteAssetsError) {
      logger.error('Failed to delete media_assets rows before account deletion', { userId, error: deleteAssetsError.message });
      return NextResponse.json({ error: 'Gagal menghapus data media. Coba lagi.' }, { status: 500 });
    }
  }

  // 2. Delete the auth user — cascades through profiles to every other
  // owned table per the FK chain documented above.
  const { error: deleteUserError } = await service.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    logger.error('auth.admin.deleteUser failed', { userId, error: deleteUserError.message });
    return NextResponse.json({ error: 'Gagal menghapus akun. Coba lagi atau hubungi dukungan.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ...(r2Failures.length > 0
      ? { warning: `${r2Failures.length} objek storage gagal dibersihkan otomatis dan mungkin perlu dihapus manual.` }
      : {}),
  });
}
