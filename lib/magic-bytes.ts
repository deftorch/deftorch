// ============================================================
// Deftorch — Fase D: magic-byte (binary signature) validation
// ============================================================
// Extracted from the inline JPEG/PNG/GIF/WebP check that already existed
// in app/api/upload-image/route.ts, and extended per
// rencana-pengembangan-deftorch-lanjutan.md Fase D item 3: PDF, MP4, WAV.
// Never trust `file.type` / a client-declared mimeType alone — it's
// exactly the kind of thing a malicious or just-plain-wrong client can
// lie about, so every accepted upload gets its actual bytes checked
// server-side before being marked 'ready' (see
// app/api/upload-media/complete/route.ts).

export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface MagicByteResult {
  valid: boolean;
  detectedCategory?: FileCategory;
  detectedMime?: string;
}

function bytesToHex(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i++) {
    out += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return out;
}

function bytesToAscii(bytes: Uint8Array, start: number, end: number): string {
  return Array.from(bytes.slice(start, end))
    .map((b) => String.fromCharCode(b))
    .join('');
}

/**
 * Inspect the first ~32 bytes of a file and determine what it actually
 * is, independent of any claimed mimeType/extension. Returns valid:false
 * if the bytes don't match any signature Deftorch currently accepts.
 */
export function detectFileSignature(buffer: ArrayBuffer | Uint8Array): MagicByteResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 12) return { valid: false };

  const header4 = bytesToHex(bytes, 0, 4);

  // --- Images (same checks as the original upload-image/route.ts) ---
  if (header4.startsWith('FFD8FF')) return { valid: true, detectedCategory: 'image', detectedMime: 'image/jpeg' };
  if (header4 === '89504E47') return { valid: true, detectedCategory: 'image', detectedMime: 'image/png' };
  if (header4 === '47494638') return { valid: true, detectedCategory: 'image', detectedMime: 'image/gif' };
  if (header4 === '52494646' && bytesToAscii(bytes, 8, 12) === 'WEBP') {
    return { valid: true, detectedCategory: 'image', detectedMime: 'image/webp' };
  }

  // --- Documents: PDF ---
  // "%PDF-" as ASCII at the very start of the file.
  if (bytesToAscii(bytes, 0, 5) === '%PDF-') {
    return { valid: true, detectedCategory: 'document', detectedMime: 'application/pdf' };
  }

  // --- Video: MP4 / MOV / M4A family (ISO base media file format) ---
  // Byte layout: [4-byte box size][4 bytes 'ftyp'][4-byte major brand]...
  // The size varies, so we check bytes 4-7 for 'ftyp' rather than a fixed
  // leading hex signature.
  if (bytesToAscii(bytes, 4, 8) === 'ftyp') {
    return { valid: true, detectedCategory: 'video', detectedMime: 'video/mp4' };
  }

  // --- Audio: WAV ---
  // "RIFF" at 0-3, then a 4-byte chunk size, then "WAVE" at 8-11 — same
  // RIFF container family as WebP above, distinguished by the tag at 8-11.
  if (header4 === '52494646' && bytesToAscii(bytes, 8, 12) === 'WAVE') {
    return { valid: true, detectedCategory: 'audio', detectedMime: 'audio/wav' };
  }

  return { valid: false };
}
