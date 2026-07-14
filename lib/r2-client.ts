import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================================
// Deftorch — Fase D: Cloudflare R2 client
// ============================================================
// R2 is S3-API-compatible, so the regular AWS SDK v3 S3 client works
// against it unmodified — just point `endpoint` at the account's R2
// endpoint and use the R2 access key pair instead of AWS credentials.
// See supabase/../R2_SETUP.md for the one-time bucket/CORS/lifecycle
// provisioning steps (can't be done from here — needs a Cloudflare
// dashboard or `wrangler` with real account credentials).

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}. See R2_SETUP.md.`);
  return value;
}

let cachedClient: S3Client | null = null;

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const accountId = required('R2_ACCOUNT_ID');
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
  });
  return cachedClient;
}

export function getR2BucketName(): string {
  return required('R2_BUCKET_NAME');
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Presigned PUT URL the browser uploads directly to — file bytes never
 * touch the Deftorch server.
 *
 * `contentLength` is REQUIRED and gets baked into the signature: R2
 * (like S3) rejects the PUT if the actual `Content-Length` header the
 * browser sends doesn't match what was signed. Without this, the
 * `sizeBytes` check in presign/route.ts was purely advisory — a client
 * could request a presigned URL for a 1MB file and then actually PUT a
 * multi-GB object to it, since nothing at the storage layer enforced the
 * declared size.
 */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresInSeconds = 600
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Reads only the first `byteCount` bytes of an R2 object via an HTTP
 * Range request — enough for detectFileSignature() in magic-bytes.ts,
 * without pulling a potentially huge (up to MEDIA_LIMITS.video =
 * 500MB) file fully into server memory just to check its first ~32
 * bytes.
 *
 * No fallback to a full read if the object is smaller than `byteCount`
 * — earlier draft of this comment claimed one, but there never was one
 * in the implementation. In practice this is still safe: every
 * MEDIA_LIMITS category requires more than 64 bytes to even contain a
 * valid signature (the shortest, PNG/GIF, still need 8+ bytes of magic
 * number plus real content after), so a file too small to satisfy this
 * Range request would fail detectFileSignature()'s validity check
 * anyway once R2 returns whatever partial bytes it has for a
 * shorter-than-requested range (R2, like S3, serves a 206 with the
 * available bytes rather than erroring). If a provider ever behaves
 * differently here, add an explicit fallback — don't just re-add this
 * comment without the code behind it.
 */
export async function getR2ObjectRangeBytes(key: string, byteCount = 64): Promise<Uint8Array> {
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Range: `bytes=0-${byteCount - 1}`,
    })
  );
  const body = res.Body;
  if (!body) throw new Error(`R2 object not found or empty: ${key}`);
  return body.transformToByteArray();
}

/**
 * Reads an object back from R2 server-side. Used by
 * app/api/upload-media/complete/route.ts to verify magic bytes after the
 * client's direct upload finishes, and to fetch the full file when
 * relaying it to the Gemini File API for video/audio.
 */
export async function getR2ObjectBytes(key: string): Promise<Uint8Array> {
  const client = getR2Client();
  const res = await client.send(new GetObjectCommand({ Bucket: getR2BucketName(), Key: key }));
  const body = res.Body;
  if (!body) throw new Error(`R2 object not found or empty: ${key}`);
  const bytes = await body.transformToByteArray();
  return bytes;
}

export async function deleteR2Object(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }));
}
