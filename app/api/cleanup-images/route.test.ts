import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

describe('/api/cleanup-images API Route', () => {
  beforeEach(() => {
    process.env.CRON_TOKEN = 'test-cron-token';
  });

  it('should return 401 when no token is provided', async () => {
    const req = new NextRequest('http://localhost/api/cleanup-images', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('should return 200 when valid Bearer token in headers is provided', async () => {
    const req = new NextRequest('http://localhost/api/cleanup-images', {
      method: 'GET',
      headers: {
        authorization: 'Bearer test-cron-token',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deleted).toBeDefined();
  });
});
