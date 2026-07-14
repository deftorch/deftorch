import { LRUCache } from 'lru-cache';
import { NextRequest } from 'next/server';

export function getIpFromRequest(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'anonymous';
}

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
};

export function rateLimit(options?: Options) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options?.uniqueTokenPerInterval ?? 500,
    ttl: options?.interval ?? 60_000,
  });

  return {
    check: (limit: number, requestOrToken: NextRequest | string) => {
      const token = typeof requestOrToken === 'string' ? requestOrToken : getIpFromRequest(requestOrToken);
      const tokenCount = tokenCache.get(token) ?? [0];
      const currentUsage = tokenCount[0];

      if (currentUsage >= limit) {
        throw new Error('Rate limit exceeded');
      }

      tokenCache.set(token, [currentUsage + 1]);
    },
  };
}

export const chatRateLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 500,
});

export const uploadRateLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 500,
});

export const analysisRateLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 500,
});

// One-time bulk import per user — deliberately stricter than chat/upload,
// since a single call can insert an entire localStorage history.
export const migrateRateLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 500,
});

// Account deletion is irreversible and touches R2 + auth.users — kept
// tight (a handful of attempts per minute) mostly to blunt automated
// abuse of the endpoint, not because legitimate retries are expected to
// be frequent.
export const deleteAccountRateLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 500,
});
