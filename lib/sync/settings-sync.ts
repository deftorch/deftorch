import { supabase } from '@/lib/supabaseClient';
import type { UserPreferences } from '@/types';
import { getSyncUserId, syncEnabled } from '@/lib/sync/sync-session';

// NOTE: apiKeys (BYOK) are intentionally NEVER synced here. That's Opsi A
// from rancangan-database-deftorch.md — see supabase/migrations/0003_notes.md.
// This module only ever touches user_preferences.

function warn(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[settings-sync] ${action} failed`, error);
  }
}

export async function syncUpsertPreferences(preferences: UserPreferences) {
  if (!syncEnabled()) return;
  try {
    const { error } = await supabase
      .from('user_preferences')
      .update({
        theme: preferences.theme,
        font_size: preferences.fontSize,
        language: preferences.language,
        default_model: preferences.defaultModel,
        default_provider: preferences.defaultProvider,
        auto_save: preferences.autoSave,
        show_token_count: preferences.showTokenCount,
        enable_notifications: preferences.enableNotifications,
        developer_mode: preferences.developerMode,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', getSyncUserId());
    if (error) throw error;
  } catch (error) {
    warn('syncUpsertPreferences', error);
  }
}

export async function pullPreferences(): Promise<Partial<UserPreferences> | null> {
  if (!syncEnabled()) return null;
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', getSyncUserId())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      theme: data.theme,
      fontSize: data.font_size,
      language: data.language,
      defaultModel: data.default_model,
      defaultProvider: data.default_provider,
      autoSave: data.auto_save,
      showTokenCount: data.show_token_count,
      enableNotifications: data.enable_notifications,
      developerMode: data.developer_mode,
    };
  } catch (error) {
    warn('pullPreferences', error);
    return null;
  }
}
