// Shared by every test/integration/*.test.ts file. Deliberately reads
// from plain env vars rather than hardcoding Supabase CLI's well-known
// local demo JWT — that JWT does exist and is the same across every
// fresh `supabase init`, but hardcoding one from memory here risks a
// subtly wrong string that fails in a confusing way. Get real values
// with `supabase status` after `supabase start` — see README.md in this
// folder for the full setup.

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function requireLocalSupabaseEnv(): void {
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_ANON_KEY && 'SUPABASE_ANON_KEY',
    !SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Missing env var(s) for integration tests: ${missing.join(', ')}.\n` +
        'Run `supabase start` (needs Docker), then `supabase status` to get ' +
        'these values, then re-run with them exported. See test/integration/README.md.'
    );
  }
}

// R2 tests additionally need real R2 credentials — Supabase's local dev
// story doesn't cover object storage, so these can't reuse the Supabase
// local instance the way the other two integration tests do. See
// presigned-url-size.test.ts for why this test is skipped rather than
// failing outright when these are absent.
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

export function hasR2Env(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}
