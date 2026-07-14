import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { setSyncUserId } from '@/lib/sync/sync-session';

interface AuthStore {
  user: User | null;
  session: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;

  init: () => () => void; // returns unsubscribe
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

// NOTE: init() should be called once from a top-level client component
// (see app/page.tsx). It subscribes to Supabase's auth state and keeps
// this store in sync; call the returned function on unmount.
export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  session: null,
  status: 'loading',
  error: null,

  init: () => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSyncUserId(data.session?.user?.id ?? null);
      set({
        session: data.session,
        user: data.session?.user ?? null,
        status: data.session ? 'authenticated' : 'unauthenticated',
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setSyncUserId(session?.user?.id ?? null);
        set({
          session,
          user: session?.user ?? null,
          status: session ? 'authenticated' : 'unauthenticated',
        });
      }
    );

    return () => listener?.subscription?.unsubscribe?.();
  },

  signInWithPassword: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return { error: error.message };
    }
    return { error: null };
  },

  signUp: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ error: error.message });
      return { error: error.message };
    }
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    setSyncUserId(null);
    set({ user: null, session: null, status: 'unauthenticated' });
  },

  clearError: () => set({ error: null }),
}));
