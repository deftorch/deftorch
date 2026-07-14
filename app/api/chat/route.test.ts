import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';

// POST() is typed to accept NextRequest, not the plain Request global —
// `new Request(...)` is structurally close enough that vitest (which
// transpiles via esbuild and never type-checks) let this slide silently,
// but `tsc --noEmit` correctly flags it as 6 real type errors. Using
// NextRequest here closes that gap without changing any test behavior.

describe('/api/chat API Route', () => {
  it('should return 400 when no messages are provided', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-3-flash' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request payload');
  });

  it('should return 400 when messages array has more than 100 items', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: 'gemini-3-flash',
        messages: Array(101).fill({ role: 'user', content: 'test' })
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request payload');
  });

  it('should return 400 when message content exceeds 50000 characters', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: 'gemini-3-flash',
        messages: [{ role: 'user', content: 'a'.repeat(50001) }]
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request payload');
  });

  it('should return 400 when the last message is empty', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3-flash',
        messages: [{ role: 'user', content: '   ' }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Empty message content');
  });

  it('should stream a real SSE response for a valid messages payload', async () => {
    // This test previously asserted `res.json()` directly returned a
    // `{candidates: [...]}` object, and expected the mocked text to
    // literally contain '// renderer: p5' — a leftover from Genesis's
    // old canvas-renderer system prompt, which no longer exists anywhere
    // in route.ts (removed as dead code during the Fase B AI SDK
    // migration cleanup). The Gemini branch has always returned a raw
    // `text/event-stream` passthrough of Gemini's own SSE body (see
    // `return new Response(response.body, ...)` in route.ts) — it was
    // never actually a single JSON response, so the old assertion could
    // only ever have passed against a response that also never really
    // existed. Rewritten to register a realistic Gemini
    // streamGenerateContent SSE mock and assert against the real
    // text/event-stream contract instead.
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/*', () => {
        const sseBody =
          'data: ' +
          JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'Hello from the mock.' }] } }] }) +
          '\n\n';
        return new HttpResponse(sseBody, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      })
    );

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3-flash',
        messages: [{ role: 'user', content: 'Say hello' }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const bodyText = await res.text();
    expect(bodyText).toContain('Hello from the mock.');
  });

  it('should handle daily usage limit quota exhaustion gracefully (status 429)', async () => {
    // Override MSW handler for this test only to simulate exhausted key status
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/*', () => {
        return new HttpResponse(
          JSON.stringify({
            error: {
              message: 'Resource has been exhausted (e.g. API key limit reached).',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429 }
        );
      })
    );

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3-flash',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('usage limit has been reached');
  });
});
