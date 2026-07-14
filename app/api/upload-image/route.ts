import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { API_CONFIG } from '@/config/constants';
import { uploadRateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

// Fase C follow-up: this endpoint was flagged in FASE_C_PROGRESS.md as
// "no auth check yet". Deliberately NOT making auth required here after
// investigating its only caller (components/image/ImageAnalysis.tsx) —
// that's a standalone, anonymous-accessible "analyze an image" tool, not
// part of the authenticated chat flow. Requiring login would be a
// product behavior change (breaking anonymous visitors' ability to use
// it), not a security fix, and isn't something to slip in silently under
// a "quick win."
//
// What auth CAN reasonably add here without changing who's allowed to
// use it: if the caller happens to be logged in, verify the token and
// attribute the upload to that user in logs. This gives at least partial
// traceability for abuse investigation without locking anonymous users
// out. Uploads to the shared `genesis-images` bucket remain otherwise
// unauthenticated and rate-limited by IP only, same as before — a real
// per-user ownership/cleanup model (like media_assets + R2 has) would be
// a bigger redesign of this feature, not a quick-win-sized change.
async function tryGetAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    // An invalid/expired token here just means "treat as anonymous" —
    // this endpoint doesn't require auth, so a bad token isn't an error.
    return null;
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')
          ?? req.headers.get('x-real-ip')
          ?? 'anonymous';

  try {
    uploadRateLimiter.check(10, ip);
  } catch {
    return NextResponse.json(
      { error: 'Too many upload requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const uploaderId = await tryGetAuthenticatedUserId(req);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    // Validate file magic bytes (binary signature)
    const arrayBuffer = await file.arrayBuffer();
    // Ambil 12 byte untuk validasi WebP yang benar
    const bytes = new Uint8Array(arrayBuffer.slice(0, 12));
    let header = '';
    for (let i = 0; i < 4; i++) {
      header += bytes[i].toString(16).padStart(2, '0').toUpperCase();
    }

    const isJpeg = header.startsWith('FFD8FF');
    const isPng = header.startsWith('89504E47');
    const isGif = header.startsWith('47494638');

    // WebP: RIFF di byte 0-3 DAN 'WEBP' di byte 8-11
    const webpSignature = Array.from(bytes.slice(8, 12))
      .map(b => String.fromCharCode(b))
      .join('');
    const isWebp = header.startsWith('52494646') && webpSignature === 'WEBP';

    if (!isJpeg && !isPng && !isGif && !isWebp) {
      return NextResponse.json(
        { error: 'Invalid image signature. Only real JPEG, PNG, GIF, and WebP files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB for ThumbSnap)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase storage is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.' },
        { status: 501 }
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    try {
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('genesis-images')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        logger.error('Supabase upload error', { error: uploadError.message, ip, uploaderId });
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('genesis-images')
        .getPublicUrl(fileName);

      logger.info('Image uploaded via upload-image', { fileName, ip, uploaderId: uploaderId ?? 'anonymous' });

      return NextResponse.json({
        success: true,
        url: publicUrl,
        filename: file.name,
        provider: 'supabase'
      });
    } catch (storageError: any) {
      logger.error('Storage error', { error: storageError.message });
      return NextResponse.json(
        { 
          error: 'Failed to upload image to storage',
          details: storageError.message 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error('Image upload error', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
