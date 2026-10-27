// Quem está mexendo no campeonato: o dono, um ajudante convidado ou o admin da Campia.
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdmin } from './admin';

export type Role = 'dono' | 'ajudante';

/** Admin da Campia com a verificação em duas etapas confirmada nesta sessão. */
export async function isPlatformAdmin(db: SupabaseClient, user: { email?: string | null } | null): Promise<boolean> {
  if (!user || !isAdmin(user.email)) return false;
  const { data } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2';
}

/** Pode fazer tudo que o dono faz (o próprio dono ou o admin da Campia). */
export async function canManage(db: SupabaseClient, champ: { owner_id: string }, user: { id: string; email?: string | null } | null): Promise<boolean> {
  if (!user) return false;
  return champ.owner_id === user.id || isPlatformAdmin(db, user);
}

export async function roleIn(
  db: SupabaseClient, champ: { id: string; owner_id: string }, user: { id: string; email?: string | null } | null,
): Promise<Role | null> {
  if (!user) return null;
  if (await canManage(db, champ, user)) return 'dono';
  const email = (user.email ?? '').toLowerCase();
  if (!email) return null;
  const { data } = await db.from('championship_helpers').select('email').eq('championship_id', champ.id).eq('email', email).maybeSingle();
  return data ? 'ajudante' : null;
}
