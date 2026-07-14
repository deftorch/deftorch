import { describe, it, expect, afterAll } from 'vitest';
import { createPresignedUploadUrl, deleteR2Object } from '@/lib/r2-client';
import { hasR2Env } from './env';

// ============================================================
// Regression test: ContentLength enforcement on R2 presigned URLs
// ============================================================
// app/api/upload-media/presign/route.ts checks `sizeBytes` against
// MEDIA_LIMITS before generating a presigned URL — but that check alone
// is advisory unless the storage layer itself also refuses to accept
// more bytes than were declared at sign time. lib/r2-client.ts's
// createPresignedUploadUrl() now passes ContentLength into the signed
// PutObjectCommand specifically to close that gap (see
// FASE_C_PROGRESS.md's "Perbaikan eksternal" #3 for the history — this
// was flagged as "plausible but unverified" there precisely because it
// had never been tested against real R2, only reasoned about from
// documented S3 presigned-URL behavior). This test is that verification.
//
// Needs real Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) — unlike the other two
// integration tests, there's no local/Docker equivalent for R2 the way
// `supabase start` covers Postgres, so this SKIPS (not fails) when those
// aren't present, rather than blocking the other two regression tests
// from running in an environment that only has Supabase set up.

const describeIfR2 = hasR2Env() ? describe : describe.skip;
const objectKeysToCleanUp: string[] = [];

describeIfR2('R2 presigned URL: ContentLength enforcement', () => {
  afterAll(async () => {
    for (const key of objectKeysToCleanUp) {
      await deleteR2Object(key).catch(() => {
        // best-effort — see lib/r2-client.ts / app/api/upload-media/complete/route.ts
        // for why a failed cleanup here isn't worth failing the test suite over.
      });
    }
  });

  it('rejects a PUT whose body is larger than the ContentLength signed into the URL', async () => {
    const key = `integration-test/${Date.now()}-oversized.bin`;
    objectKeysToCleanUp.push(key);

    const declaredSize = 1024; // 1KB
    const url = await createPresignedUploadUrl(key, 'application/octet-stream', declaredSize, 300);

    // Actually send 10x what was declared — this is exactly the attack
    // this test exists to rule out: presign for something small, then
    // upload something much bigger than the size check ever saw.
    const oversizedBody = new Uint8Array(declaredSize * 10);

    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: oversizedBody,
    });

    // R2 (S3-compatible) should reject this at the signature-verification
    // level before ever accepting the bytes, because Content-Length no
    // longer matches what was signed. If this assertion fails, the
    // ContentLength fix does NOT actually enforce anything against real
    // R2, and MEDIA_LIMITS is enforced only by the (bypassable) size
    // check in presign/route.ts.
    expect(res.ok).toBe(false);
    expect([400, 403]).toContain(res.status);
  });

  it('accepts a PUT whose body size matches the signed ContentLength exactly', async () => {
    const key = `integration-test/${Date.now()}-correct-size.bin`;
    objectKeysToCleanUp.push(key);

    const declaredSize = 512;
    const url = await createPresignedUploadUrl(key, 'application/octet-stream', declaredSize, 300);
    const body = new Uint8Array(declaredSize);

    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
    });

    // Sanity check the OTHER direction — a test that only ever asserts
    // rejection could pass even if createPresignedUploadUrl were broken
    // in a way that rejects everything, not just oversized uploads.
    expect(res.ok).toBe(true);
  });
});

if (!hasR2Env()) {
  // vitest doesn't fail a describe.skip block, so nothing surfaces this
  // to whoever runs `npm run test:integration` unless they read scrollback
  // carefully — printing explicitly means an R2-less run states plainly
  // that 2 tests were never actually attempted, not just silently absent.
  // eslint-disable-next-line no-console
  console.warn(
    `[presigned-url-size.test.ts] Skipped — R2 env vars not set (need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME). See test/integration/README.md.`
  );
}
