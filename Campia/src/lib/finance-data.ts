import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinPayment } from './finance';

export const FIN_SELECT = 'championship_id, team_id, amount_cents, discount_cents, status, payout, manual_payout_done_at, fee_percent, method, installments, paid_at, refunded_at, created_at, coupon_code';

/** Campeonatos do organizador e os pagamentos deles (pagos, devolvidos e pagos fora do prazo). */
export async function loadOwnerFinance(db: SupabaseClient, ownerId: string) {
  const { data: champs } = await db.from('championships').select('id, name, slug, created_at').eq('owner_id', ownerId).order('created_at', { ascending: false })
    .returns<Array<{ id: string; name: string; slug: string; created_at: string }>>();
  const ids = (champs ?? []).map(c => c.id);
  const { data: pays } = ids.length
    ? await db.from('payments').select(FIN_SELECT).in('championship_id', ids).in('status', ['pago', 'pago_tarde', 'estornado']).order('paid_at', { ascending: false })
      .returns<Array<FinPayment & { team_id: string; installments: number | null; created_at: string; coupon_code: string | null }>>()
    : { data: [] as Array<FinPayment & { team_id: string; installments: number | null; created_at: string; coupon_code: string | null }> };
  return { champs: champs ?? [], pays: pays ?? [] };
}
