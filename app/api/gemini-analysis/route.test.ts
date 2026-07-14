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
  // Same fix as app/api/image-analysis/route.test.ts — route.ts calls
  // safeFetch(imageUrl) directly since the SSRF/DNS-rebinding fix, this
  // mock was still stubbing the pre-fix isSafeUrl()-only API.
  safeFetch: vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }),
}));

// Mock API Config
vi.mock('@/config/constants', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    API_CONFIG: {
      ...actual.API_CONFIG,
      GEMINI_API_KEY: 'mock-key',
    }
  };
});

describe('POST /api/gemini-analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid payload', async () => {
    const req = new NextRequest('http://localhost/api/gemini-analysis', {
      method: 'POST',
      body: JSON.stringify({}), 
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should process Gemini native image analysis properly', async () => {
    (callGeminiWithRotation as any).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: '{"summary": "This is a detailed analysis"}' }],
          },
        },
      ],
    });

    const req = new NextRequest('http://localhost/api/gemini-analysis', {
      method: 'POST',
      body: JSON.stringify({ 
        imageUrl: 'https://example.com/image.jpg',
        modelId: 'gemini-native',
        analysisType: 'image-description'
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result).toContain('This is a detailed analysis');
    expect(callGeminiWithRotation).toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    (callGeminiWithRotation as any).mockRejectedValue(new Error('Quota exceeded'));

    const req = new NextRequest('http://localhost/api/gemini-analysis', {
      method: 'POST',
      body: JSON.stringify({ 
        imageUrl: 'https://example.com/image.jpg',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429); // Quota exceeded mapped to 429
  });
});
