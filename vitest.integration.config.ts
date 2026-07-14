import { defineConfig } from 'vitest/config';
import path from 'path';

// Separate from vitest.config.ts on purpose: integration tests in
// test/integration/ talk to a REAL local Postgres via `supabase start`
// (Docker) — they must never run as part of the default `npm test`,
// which needs to work with zero external dependencies (that's the whole
// point of MSW in test/setup.ts). Mixing them into one config means
// either `npm test` silently needs Docker (breaks CI's fast unit-test
// job, breaks any contributor without Docker installed), or these tests
// get excluded and quietly never run at all — see test/integration/README.md
// for why that second failure mode is exactly what happened to the
// original 5 route.test.ts files before this whole Fase E pass.
//
// No jsdom environment (these are Node-side Supabase client calls, not
// component tests) and no test/setup.ts (that file's MSW server is
// specifically for INTERCEPTING network calls so tests never hit the
// real internet — these tests need the opposite: a real network call to
// a real local Postgres instance).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['test/integration/**/*.test.ts'],
    // Integration tests do real network round-trips to local Postgres/
    // PostgREST — 5s (vitest's default) is tight for a few of these
    // (RLS test creates 2 users + several rows per case).
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
