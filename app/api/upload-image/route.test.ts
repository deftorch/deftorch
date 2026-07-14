import { describe, it, expect } from 'vitest';
import { POST } from './route';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';

describe('/api/upload-image API Route', () => {
  it('should return 400 when no file is provided', async () => {
    const mockFormData = {
      get: (key: string) => null,
    };
    const req = {
      headers: new Headers(),
      formData: async () => mockFormData,
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('No file provided');
  });

  it('should return 400 when file is not an image', async () => {
    const mockFile = {
      name: 'test.txt',
      type: 'text/plain',
      size: 100,
    };
    const mockFormData = {
      get: (key: string) => mockFile,
    };
    const req = {
      headers: new Headers(),
      formData: async () => mockFormData,
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Only image files are allowed');
  });

  it('should return 400 when image signature does not match magic bytes', async () => {
    const mockFile = {
      name: 'test.png',
      type: 'image/png',
      size: 100,
      arrayBuffer: async () => new Uint8Array([0, 0, 0, 0]).buffer,
    };
    const mockFormData = {
      get: (key: string) => mockFile,
    };
    const req = {
      headers: new Headers(),
      formData: async () => mockFormData,
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid image signature');
  });

  it('should return 501 when Supabase is not configured', async () => {
    const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const mockFile = {
      name: 'correct.png',
      type: 'image/png',
      size: 1000,
      arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4E, 0x47]).buffer,
    };
    const mockFormData = {
      get: (key: string) => mockFile,
    };
    const req = {
      headers: new Headers(),
      formData: async () => mockFormData,
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(501);
    const data = await res.json();
    expect(data.error).toContain('Supabase storage is not configured');

    process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
  });

  it('should upload successfully to Supabase Storage when magic bytes are correct', async () => {
    const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-key';

    server.use(
      http.post('https://mock.supabase.co/storage/v1/object/genesis-images/*', () => {
        return HttpResponse.json({ Key: 'test-key' });
      })
    );

    const mockFile = {
      name: 'correct.png',
      type: 'image/png',
      size: 1000,
      arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4E, 0x47]).buffer,
    };
    const mockFormData = {
      get: (key: string) => mockFile,
    };
    const req = {
      headers: new Headers(),
      formData: async () => mockFormData,
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.provider).toBe('supabase');
    expect(data.url).toContain('https://mock.supabase.co/storage/v1/object/public/genesis-images/');

    process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  });
});
