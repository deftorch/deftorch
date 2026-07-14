import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as z from 'zod';
import { getR2ObjectBytes, getR2ObjectRangeBytes, deleteR2Object } from '@/lib/r2-client';
import { detectFileSignature } from '@/lib/magic-bytes';
import { uploadToGeminiFiles } from '@/lib/gemini-file-upload';
import { getGeminiApiKeys, MEDIA_LIMITS } from '@/config/constants';
import { uploadRateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

// ============================================================
// Deftorch — Fase D: POST /api/upload-media/complete
// ============================================================
// Step 2 of the R2 upload flow. The client already PUT the bytes
// directly to R2 using the presigned URL from /presign; this route:
//   1. re-reads those bytes from R2 (server-side, not from the client
//      request — the client cannot claim what the bytes are)
//   2. checks the real magic-byte signature against what the row's
//      file_category claims, per Fase D item 3 in
//      rencana-pengembangan-deftorch-lanjutan.md
//   3. for files above MEDIA_LIMITS.INLINE_MAX_BYTES, relays them to the
//      Gemini File API once and stores the resulting fileUri (Fase D
//      item 5) — server-to-server, not through the browser
//   4. flips media_assets.processing_status to 'ready' (or deletes the
//      row + R2 object on a signature mismatch)

const completeSchema = z.object({
  mediaAssetId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    uploadRateLimiter.check(10, request);
  } catch {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
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

  let body: z.infer<typeof completeSchema>;
  try {
    body = completeSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload tidak valid', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Gagal membaca payload' }, { status: 400 });
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: asset, error: fetchError } = await service
    .from('media_assets')
    .select('*')
    .eq('id', body.mediaAssetId)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 });
  }
  // Ownership check done manually here rather than relying on RLS, since
  // this route uses the service-role client (see presign/route.ts for
  // why: avoids a second auth round trip for a row we already verified).
  if (asset.user_id !== userId) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 });
  }
  if (asset.processing_status !== 'uploading') {
    // Already completed (or failed) — idempotent no-op rather than an
    // error, in case the client retries after a network blip on its end.
    return NextResponse.json({ success: true, mediaAsset: asset, alreadyProcessed: true });
  }

  let headerBytes: Uint8Array;
  try {
    // Only the first 64 bytes are needed to identify the file type —
    // no reason to pull a potentially 500MB video fully into memory
    // just to check its signature.
    headerBytes = await getR2ObjectRangeBytes(asset.storage_key, 64);
  } catch (error) {
    logger.error('R2 read failed during complete', { assetId: asset.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Gagal membaca file dari storage. Coba upload ulang.' }, { status: 500 });
  }

  const signature = detectFileSignature(headerBytes);
  if (!signature.valid || signature.detectedCategory !== asset.file_category) {
    // Signature mismatch: either not a real file of any supported type,
    // or the client lied about the category (e.g. renamed a .exe to
    // .pdf). Clean up rather than leaving a bad row + orphaned R2 object.
    await service.from('media_assets').delete().eq('id', asset.id);
    await deleteR2Object(asset.storage_key).catch(() => {
      // best-effort cleanup — a stray R2 object with no DB row is a
      // storage-cost annoyance, not a security or correctness issue, so
      // a failure here doesn't need to block the error response.
    });
    return NextResponse.json(
      { error: 'Signature file tidak cocok dengan kategori yang diklaim. File ditolak.' },
      { status: 400 }
    );
  }

  const updates: Record<string, any> = {
    processing_status: 'ready',
    mime_type: signature.detectedMime ?? asset.mime_type,
  };

  // Large files get pre-uploaded to Gemini's File API once, here,
  // server-to-server — so later chat turns reference a fileUri instead
  // of resending the whole file as base64 every time. This is the one
  // case that legitimately needs the full object in memory, so the full
  // download only happens here, not for every upload regardless of size.
  if (asset.size_bytes > MEDIA_LIMITS.INLINE_MAX_BYTES) {
    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
      logger.warn('Skipping Gemini File API upload — no Gemini key configured', { assetId: asset.id });
    } else {
      try {
        const fullBytes = await getR2ObjectBytes(asset.storage_key);
        const uploaded = await uploadToGeminiFiles({
          data: fullBytes,
          mimeType: updates.mime_type,
          displayName: asset.original_filename ?? asset.storage_key,
          apiKey: apiKeys[0],
        });
        updates.gemini_file_uri = uploaded.uri;
        updates.gemini_file_expires_at = uploaded.expirationTime;
      } catch (error) {
        // Non-fatal: the file is still safely in R2 and marked 'ready'.
        // Without a gemini_file_uri, the chat route falls back to
        // treating it as a normal attachment (which will fail Gemini's
        // own inline-size limit for anything this big — surfaced to the
        // user as a normal chat error, not silently swallowed here).
        logger.error('Gemini File API upload failed', { assetId: asset.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  const { data: updated, error: updateError } = await service
    .from('media_assets')
    .update(updates)
    .eq('id', asset.id)
    .select()
    .single();

  if (updateError) {
    logger.error('media_assets update failed', { assetId: asset.id, error: updateError.message });
    return NextResponse.json({ error: 'Gagal finalisasi metadata file.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, mediaAsset: updated });
}
