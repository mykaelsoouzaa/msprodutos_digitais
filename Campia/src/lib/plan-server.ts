import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanRow } from './plan';

/** O organizador é Pro agora? Funciona para qualquer visitante (função pública do banco). */
export async function ownerIsPro(db: SupabaseClient, ownerId: string): Promise<boolean> {
  const { data, error } = await db.rpc('pro_owner', { p_owner: ownerId });
  return !error && data === true;
}

export async function myPlan(db: SupabaseClient, userId: string): Promise<PlanRow | null> {
  const { data } = await db.from('plans').select('owner_id, status, source, paid_until, asaas_subscription_id, invoice_url').eq('owner_id', userId).maybeSingle<PlanRow>();
  return data ?? null;
}
