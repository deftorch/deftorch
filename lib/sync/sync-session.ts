// Single shared place holding "who is currently signed in, for sync
// purposes" — set by auth-store.ts on every auth state change, read by
// chat-sync.ts and settings-sync.ts so they don't each need their own
// async getSession() round trip on every store mutation.
let currentUserId: string | null = null;

export function setSyncUserId(userId: string | null) {
  currentUserId = userId;
}

export function getSyncUserId(): string | null {
  return currentUserId;
}

export function syncEnabled(): boolean {
  return !!currentUserId && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}
