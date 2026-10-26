// Quem está mexendo no campeonato: o dono ou um ajudante convidado.
import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'dono' | 'ajudante';

export async function roleIn(
  db: SupabaseClient, champ: { id: string; owner_id: string }, user: { id: string; email?: string | null } | null,
): Promise<Role | null> {
  if (!user) return null;
  if (champ.owner_id === user.id) return 'dono';
  const email = (user.email ?? '').toLowerCase();
  if (!email) return null;
  const { data } = await db.from('championship_helpers').select('email').eq('championship_id', champ.id).eq('email', email).maybeSingle();
  return data ? 'ajudante' : null;
}
