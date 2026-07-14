// ============================================================
// Deftorch — Fase D: Gemini File API upload
// ============================================================
// For files above MEDIA_LIMITS.INLINE_MAX_BYTES (config/constants.ts),
// Deftorch uploads the bytes to Gemini's own File API once, server-side,
// and re-uses the returned fileUri across chat turns — instead of
// re-sending the whole file as base64 on every single message. This is
// the "fileUri presigned URL langsung ke Gemini" step from Fase D item 5
// in rencana-pengembangan-deftorch-lanjutan.md.
//
// Uses the "multipart" single-request upload variant of the File API
// (X-Goog-Upload-Protocol: multipart) rather than the resumable
// chunked-upload protocol. Trade-off, stated plainly: a dropped
// connection mid-upload means starting over, since there's no resumable
// session to continue. Good enough for MEDIA_LIMITS' current caps
// (500MB video / 100MB audio) on a normal server connection; if large
// files start failing in practice, switching to the resumable protocol
// (initiate -> get upload URL from Location header -> PUT chunks -> 
// finalize) is the documented next step, not implemented here to keep
// this slice's surface area manageable.
//
// Gemini-hosted files expire automatically after 48 hours (Google's own
// limit, not configurable) — gemini_file_expires_at on media_assets
// tracks this so the app can know to re-upload rather than reuse a
// stale fileUri. There is no automatic re-upload wired up yet; a chat
// referencing an expired fileUri will just fail at the Gemini API call,
// surfaced as a normal error to the user.

export interface GeminiFileUploadResult {
  uri: string;
  name: string;
  mimeType: string;
  expirationTime: string;
}

export async function uploadToGeminiFiles(params: {
  data: Uint8Array;
  mimeType: string;
  displayName: string;
  apiKey: string;
}): Promise<GeminiFileUploadResult> {
  const boundary = `deftorch-${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ file: { display_name: params.displayName } });

  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
  );
  const fileHeader = encoder.encode(`--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`);
  const closing = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(metadataPart.length + fileHeader.length + params.data.length + closing.length);
  let offset = 0;
  body.set(metadataPart, offset); offset += metadataPart.length;
  body.set(fileHeader, offset); offset += fileHeader.length;
  body.set(params.data, offset); offset += params.data.length;
  body.set(closing, offset);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${params.apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'multipart',
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini File API upload failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (!json?.file?.uri) {
    throw new Error('Gemini File API upload succeeded but response had no file.uri');
  }

  return {
    uri: json.file.uri,
    name: json.file.name,
    mimeType: json.file.mimeType ?? params.mimeType,
    expirationTime: json.file.expirationTime,
  };
}
