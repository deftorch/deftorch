import { useCallback } from 'react';
import { ImageAttachment } from '@/types';
import { MEDIA_LIMITS } from '@/config/constants';
import { useAuthStore } from '@/lib/store/auth-store';
import { generateId } from '@/lib/utils';

// ============================================================
// Fase D follow-up: sambungkan frontend ke app/api/upload-media/*
// ============================================================
// Before this hook, app/page.tsx#processFiles() did ONE thing for every
// file regardless of type or size: FileReader.readAsDataURL() into a
// base64 string kept entirely in browser memory / component state, then
// sent inline in the chat request. That's fine for a 200KB photo. It is
// not fine for a 400MB video — encoding that to base64 client-side would
// hang the tab, and MEDIA_LIMITS.video (500MB) that Fase D's backend
// already enforces was never reachable through the UI at all.
//
// This hook decides, per file, which path to take:
//   - Small images (<= MEDIA_LIMITS.INLINE_MAX_BYTES): unchanged fast
//     path, inline base64, no network round trip beyond the chat request
//     itself. Works signed-out, exactly like before.
//   - Everything else (video, audio, documents, or images above the
//     inline threshold): the real R2 flow — presign, direct browser PUT
//     to R2, complete (server-side magic-byte check + optional Gemini
//     File API relay). Requires an authenticated session, because
//     media_assets rows need a real owner for RLS — see the comment in
//     app/api/upload-media/presign/route.ts.

export type MediaCategory = 'image' | 'video' | 'audio' | 'document';

function detectCategory(mimeType: string): MediaCategory | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'document';
  return null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export class MediaUploadAuthRequiredError extends Error {
  constructor() {
    super('Login diperlukan untuk mengunggah video, audio, dokumen, atau gambar berukuran besar.');
    this.name = 'MediaUploadAuthRequiredError';
  }
}

export function useMediaUpload() {
  const session = useAuthStore((s) => s.session);

  /**
   * Uploads a single file and returns a ready-to-attach ImageAttachment.
   *
   * `onStatusChange` fires once immediately with `uploadStatus: 'uploading'`
   * (or 'error' for the auth-required case) so the caller can push a
   * placeholder into attachedImages right away and show upload progress,
   * then again with the final 'ready' | 'error' state.
   */
  const uploadFile = useCallback(
    async (file: File, chatId: string | undefined, onStatusChange: (attachment: ImageAttachment) => void) => {
      const category = detectCategory(file.type);
      if (!category) {
        throw new Error(`Tipe file tidak didukung: ${file.type || file.name}`);
      }

      const limit = MEDIA_LIMITS[category].maxBytes;
      if (file.size > limit) {
        throw new Error(`${file.name} melebihi batas ${Math.round(limit / (1024 * 1024))}MB untuk kategori ${category}.`);
      }

      const id = generateId();

      // --- Fast path: small image, inline base64, no auth required ---
      if (category === 'image' && file.size <= MEDIA_LIMITS.INLINE_MAX_BYTES) {
        const dataUrl = await readAsDataUrl(file);
        const attachment: ImageAttachment = {
          id,
          url: dataUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: dataUrl,
          category,
          mimeType: file.type,
          uploadStatus: 'ready',
        };
        onStatusChange(attachment);
        return attachment;
      }

      // --- R2 path: video/audio/document, or a large image ---
      if (!session?.access_token) {
        throw new MediaUploadAuthRequiredError();
      }

      const placeholder: ImageAttachment = {
        id,
        url: '',
        name: file.name,
        size: file.size,
        type: file.type,
        category,
        mimeType: file.type,
        uploadStatus: 'uploading',
      };
      onStatusChange(placeholder);

      try {
        const presignRes = await fetch('/api/upload-media/presign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            category,
            chatId,
          }),
        });
        if (!presignRes.ok) {
          const body = await presignRes.json().catch(() => ({}));
          throw new Error(body.error || `Gagal memulai upload (${presignRes.status})`);
        }
        const { uploadUrl, mediaAssetId } = await presignRes.json();

        // Direct browser -> R2 PUT. The browser sets Content-Length from
        // the File object's size automatically, which must match what
        // presign/route.ts signed the URL with (see lib/r2-client.ts) —
        // R2 rejects the PUT otherwise, which is the whole point of that
        // fix (declared size is now actually enforced, not advisory).
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Upload ke storage gagal (${putRes.status}). Coba lagi.`);
        }

        const completeRes = await fetch('/api/upload-media/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ mediaAssetId }),
        });
        if (!completeRes.ok) {
          const body = await completeRes.json().catch(() => ({}));
          throw new Error(body.error || `Verifikasi file gagal (${completeRes.status})`);
        }
        const { mediaAsset } = await completeRes.json();

        // For small-enough large-ish files that didn't cross
        // INLINE_MAX_BYTES on the Gemini side but did on ours (rare, since
        // our INLINE_MAX_BYTES is already conservative), there's no
        // fileUri — the chat route falls back per-provider. For
        // video/most audio there will be a fileUri from the Gemini File
        // API relay complete/route.ts already performed server-side.
        const ready: ImageAttachment = {
          ...placeholder,
          uploadStatus: 'ready',
          mediaAssetId,
          fileUri: mediaAsset?.gemini_file_uri ?? undefined,
          mimeType: mediaAsset?.mime_type ?? file.type,
          // No client-side preview for non-image R2 uploads — the actual
          // bytes never round-tripped back to the browser at all, by
          // design (that's the point of direct-to-R2 upload). ChatImagePreview
          // already renders a generic file icon when `type` isn't image/*.
        };
        onStatusChange(ready);
        return ready;
      } catch (err) {
        const failed: ImageAttachment = {
          ...placeholder,
          uploadStatus: 'error',
          uploadError: err instanceof Error ? err.message : 'Upload gagal',
        };
        onStatusChange(failed);
        throw err;
      }
    },
    [session]
  );

  return { uploadFile, isAuthenticated: !!session?.access_token };
}
