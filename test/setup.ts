import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';

/**
 * This file was referenced by vitest.config.ts (`setupFiles`) and
 * imported directly by two route.test.ts files (`import { server } from
 * '@/test/setup'`) but never actually existed. Every single test file in
 * the project failed at the module-resolution stage before a single
 * test could run — `npx vitest run` reported "5 failed suites, 0 tests"
 * regardless of what the tests themselves checked. This wasn't a subtle
 * bug; running the test suite even once would have caught it.
 *
 * `setupServer()` with no handlers means every test that doesn't
 * explicitly call `server.use(...)` for a given URL gets MSW's default
 * "no handler for this request" error instead of a real network call —
 * which is the point: tests should never hit the actual internet
 * (Gemini, OpenRouter, Supabase, R2), even accidentally.
 */
export const server = setupServer();

// Route tests mock the actual HTTP call via MSW (server.use(...) per
// test), but every route first checks whether an API key is configured
// AT ALL before making that call — see lib/gemini-client.ts#getGeminiApiKeys
// and lib/ai-providers.ts#resolveNonGeminiModel. Without a key present,
// routes throw "API key not configured" before the request MSW is meant
// to intercept ever gets made, and every route test asserting a 200/429
// response fails with 500 instead — which is exactly what happened here
// (this file didn't exist at all, so nothing about API keys had ever
// been configured for tests either). Dummy keys, never real ones —
// MSW intercepts the actual network call before any of these are used
// for a real request.
process.env.GEMINI_API_KEY ??= 'test-gemini-key';
process.env.OPENAI_API_KEY ??= 'test-openai-key';
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key';
process.env.GROQ_API_KEY ??= 'test-groq-key';
process.env.DEEPSEEK_API_KEY ??= 'test-deepseek-key';
process.env.OPENROUTER_API_KEY ??= 'test-openrouter-key';
process.env.CRON_TOKEN ??= 'test-cron-token';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
