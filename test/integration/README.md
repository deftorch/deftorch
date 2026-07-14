# Integration tests

These test against **real infrastructure**, not mocks — that's the whole
point of them. `test/*.test.ts` (the default `npm test`) uses MSW to make
sure nothing ever hits a real network call; these three files do the
opposite on purpose, because the three bugs they cover
(`FASE_C_PROGRESS.md`'s "Perbaikan eksternal" #1–3) are exactly the kind
that only show up against real Postgres/R2 behavior — `tsc` and mocked
unit tests both stayed green the entire time those bugs existed.

**Disclosure, upfront**: these tests have never been run successfully
from any sandbox that built or reviewed this codebase — none of them had
Docker or real Cloudflare credentials available. They're written
correctly to the best of that review, cross-checked line-by-line against
the actual schema/route code they're testing, but "should pass" is not
the same claim as "has passed." Run them once for real before trusting
them as a merge gate.

## What each one covers

| File | Tests | Needs |
|---|---|---|
| `rls-preset-escalation.test.ts` | The `0006` RLS fix — a regular user cannot INSERT/UPDATE/DELETE a preset's `composite_steps`, but can still write their own | Local Supabase |
| `migrate-idempotency.test.ts` | Calling `/api/migrate` twice (simulating a retry after partial failure) doesn't skip/lose data | Local Supabase |
| `presigned-url-size.test.ts` | A presigned R2 URL rejects a PUT larger than the size it was signed for | Real Cloudflare R2 (skips itself if absent — see below) |

## Setup

### 1. Supabase (needed for the first two files)

```bash
# Requires Docker running.
supabase start

# Apply all migrations, including 0006 (the fix these tests verify) and
# 0007 — order matters, `db push` runs them in filename order.
supabase db push

# Prints the local URL + anon/service_role keys you need below.
supabase status
```

Export what `supabase status` printed:

```bash
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_ANON_KEY="<anon key from supabase status>"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key from supabase status>"
```

### 2. R2 (needed only for `presigned-url-size.test.ts`)

Use a real (ideally disposable/test) bucket — see `R2_SETUP.md` at the
project root for how to create one. This test writes and deletes a
couple of small objects under an `integration-test/` prefix.

```bash
export R2_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
export R2_BUCKET_NAME="..."
```

Without these, `presigned-url-size.test.ts` prints a warning and skips
itself (via `describe.skip`) rather than failing — it doesn't block the
Supabase-only tests from running in an environment that only has that
half set up.

### 3. Run

```bash
npm run test:integration
```

This uses `vitest.integration.config.ts`, not the default
`vitest.config.ts` — deliberately separate so `npm test` (the fast,
infra-free suite CI actually runs on every PR) never accidentally
requires Docker or R2 credentials. See that file's own comments for why.

## Cleanup

Every test creates its own throwaway user/rows/objects and deletes them
in `afterAll`. If a run crashes before `afterAll` fires, look for:
- Auth users with emails matching `rls-test-*@example.com` /
  `migrate-test-*@example.com` in Supabase Studio (`supabase status` for
  the URL) — delete manually via the Auth panel.
- R2 objects under the `integration-test/` prefix in your bucket.

## Why these three specifically, and not more

These cover the three externally-found-and-fixed bugs that were
previously only "verified" by reading the code and reasoning about it —
see `FASE_C_PROGRESS.md`. They're the highest-value regression tests to
have precisely because each one already fooled a `tsc --noEmit` pass and
a code read before someone actually ran the scenario. Everything else in
`rencana-pengembangan-deftorch-lanjutan.md`'s Fase E unit-test list
(`lib/ai-providers.ts`, `lib/rate-limiter.ts`, etc.) doesn't need real
infrastructure and belongs in the regular `test/*.test.ts` suite instead,
not here.
