// Página da arena (perfil público do organizador).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ArenaRow {
  id: string; owner_id: string; slug: string; name: string; bio: string; address: string;
  city: string; state: string; whatsapp: string; instagram: string; logo_url: string;
}

export const ARENA_SLUG_RE = /^[a-z0-9-]{3,60}$/;

/** Arena de cada dono, para mostrar "por Arena X" nas listagens. */
export async function arenasByOwner(db: SupabaseClient, ownerIds: string[]): Promise<Map<string, ArenaRow>> {
  const ids = [...new Set(ownerIds)];
  if (!ids.length) return new Map();
  const { data } = await db.from('arenas').select('*').in('owner_id', ids).returns<ArenaRow[]>();
  return new Map((data ?? []).map(a => [a.owner_id, a]));
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(w => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase();
