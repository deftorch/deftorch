import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as z from 'zod';
import { createPresignedUploadUrl, getR2BucketName, isR2Configured } from '@/lib/r2-client';
import { MEDIA_LIMITS } from '@/config/constants';
import { generateId } from '@/lib/utils';
import { uploadRateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

// ============================================================
// Deftorch — Fase D: POST /api/upload-media/presign
// ============================================================
// Step 1 of the R2 upload flow: client asks for permission + a URL,
// server hands back a short-lived presigned PUT URL, client uploads
// directly to R2 (file bytes never pass through this server), then
// calls /api/upload-media/complete to verify + finalize. See
// app/api/migrate/route.ts for the same Bearer-token auth pattern.
//
// Auth is REQUIRED here (unlike app/api/upload-image/route.ts, which is
// still anonymous — see FASE_C_PROGRESS.md) because presigned keys are
// namespaced by user_id, and the media_assets row this creates needs a
// real owner for RLS to mean anything.

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
  category: z.enum(['image', 'video', 'audio', 'document']),
  chatId: z.string().uuid().optional(),
});

function sanitizeFilename(name: string): string {
  // Keep it simple: strip anything that isn't alnum/dot/dash/underscore,
  // collapse the rest. Prevents path traversal (`../`) and weird R2 key
  // characters without needing a full filename-parsing library.
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(-100); // keep it short; the uuid prefix guarantees uniqueness anyway
}

export async function POST(request: NextRequest) {
  try {
    uploadRateLimiter.check(10, request);
  } catch {
    return NextResponse.json({ error: 'Terlalu banyak permintaan upload.' }, { status: 429 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: 'R2 belum dikonfigurasi di server. Lihat R2_SETUP.md.' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Tidak ada sesi login yang valid.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi di server.' }, { status: 503 });
  }

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Sesi tidak valid atau sudah kedaluwarsa.' }, { status: 401 });
  }
  const userId = userData.user.id;

  let body: z.infer<typeof presignSchema>;
  try {
    body = presignSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload tidak valid', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Gagal membaca payload' }, { status: 400 });
  }

  const limit = MEDIA_LIMITS[body.category].maxBytes;
  if (body.sizeBytes > limit) {
    return NextResponse.json(
      { error: `File terlalu besar untuk kategori ${body.category}. Maksimal ${Math.round(limit / (1024 * 1024))}MB.` },
      { status: 400 }
    );
  }

  const assetId = generateId();
  const storageKey = `${userId}/${assetId}-${sanitizeFilename(body.filename)}`;

  let uploadUrl: string;
  try {
    uploadUrl = await createPresignedUploadUrl(storageKey, body.mimeType, body.sizeBytes);
  } catch (error) {
    logger.error('R2 presign failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Gagal membuat URL upload.' }, { status: 500 });
  }

  // Row created up front with status 'uploading' — /complete flips it to
  // 'ready' (or the row gets deleted) once the magic-byte check passes.
  // Service-role client used for the write (RLS would also allow this
  // since user_id = the verified caller, but service-role avoids a
  // second round-trip auth check for a row we've already verified
  // ownership of above).
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days — see R2_SETUP.md §4
  const { error: insertError } = await service.from('media_assets').insert({
    id: assetId,
    user_id: userId,
    chat_id: body.chatId ?? null,
    file_category: body.category,
    mime_type: body.mimeType,
    original_filename: body.filename,
    storage_provider: 'r2',
    storage_bucket: getR2BucketName(),
    storage_key: storageKey,
    size_bytes: body.sizeBytes,
    processing_status: 'uploading',
    expires_at: expiresAt,
  });

  if (insertError) {
    logger.error('media_assets insert failed', { error: insertError.message });
    return NextResponse.json({ error: 'Gagal menyimpan metadata file.' }, { status: 500 });
  }

  return NextResponse.json({ uploadUrl, mediaAssetId: assetId, storageKey });
}
