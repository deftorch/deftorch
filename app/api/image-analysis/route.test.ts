import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { callGeminiWithRotation } from '@/lib/gemini-client';
import { analysisRateLimiter } from '@/lib/rate-limiter';

vi.mock('@/lib/gemini-client', () => ({
  callGeminiWithRotation: vi.fn(),
}));

vi.mock('@/lib/rate-limiter', () => ({
  analysisRateLimiter: {
    check: vi.fn(),
  },
}));

vi.mock('@/lib/ssrf-guard', () => ({
  // route.ts calls safeFetch(imageUrl) directly (dynamic import) since
  // the SSRF/DNS-rebinding fix — isSafeUrl() alone is no longer what's
  // used to fetch the image itself. This mock was still stubbing the
  // pre-fix API and silently made every "success" test path throw
  // ("No safeFetch export is defined on the mock"), which vitest run
  // reported as a 500 with no indication it was the test's mock at fault
  // rather than the route.
  safeFetch: vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }),
}));

describe('POST /api/image-analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if payload is invalid', async () => {
    const req = new NextRequest('http://localhost/api/image-analysis', {
      method: 'POST',
      body: JSON.stringify({ invalidField: true }), // Missing imageUrl
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request payload');
  });

  it('should call Gemini API and return description on success', async () => {
    (callGeminiWithRotation as any).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: 'This is a mocked image description.' }],
          },
        },
      ],
    });

    const req = new NextRequest('http://localhost/api/image-analysis', {
      method: 'POST',
      body: JSON.stringify({ imageUrl: 'https://example.com/image.jpg', text: 'What is this?' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.description).toBe('This is a mocked image description.');
    expect(callGeminiWithRotation).toHaveBeenCalled();
  });

  it('should return 429 if rate limited', async () => {
    (analysisRateLimiter.check as any).mockImplementation(() => {
      throw new Error('Rate limit');
    });

    const req = new NextRequest('http://localhost/api/image-analysis', {
      method: 'POST',
      body: JSON.stringify({ imageUrl: 'https://example.com/img.jpg' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
