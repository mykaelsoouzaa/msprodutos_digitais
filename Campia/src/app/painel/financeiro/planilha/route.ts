import { brDateTime, money, toCsv } from '@/lib/csv';
import { loadOwnerFinance } from '@/lib/finance-data';
import { methodLabel } from '@/lib/payment-emails';
import { campiaFeePercent } from '@/lib/payout';
import { createClient } from '@/lib/supabase/server';

const STATUS: Record<string, string> = { pago: 'Pago', pago_tarde: 'Pago depois do prazo', estornado: 'Devolvido' };

/** Todas as inscrições pagas do organizador, para o contador. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Entre na sua conta', { status: 401 });
  const { champs, pays } = await loadOwnerFinance(supabase, user.id);
  const name = new Map(champs.map(c => [c.id, c.name]));
  const teamIds = [...new Set(pays.map(p => p.team_id))];
  const { data: teams } = teamIds.length ? await supabase.from('teams').select('id, name').in('id', teamIds).returns<Array<{ id: string; name: string }>>() : { data: [] };
  const team = new Map((teams ?? []).map(t => [t.id, t.name]));
  const def = campiaFeePercent();
  const rows = pays.map(p => {
    const fee = p.status === 'pago' ? Math.round((p.amount_cents * Number(p.fee_percent ?? def)) / 100) : 0;
    return [
      brDateTime(p.paid_at), name.get(p.championship_id) ?? '', team.get(p.team_id) ?? '', STATUS[p.status] ?? p.status, methodLabel(p.method, p.installments),
      money(p.amount_cents), money(p.discount_cents ?? 0), p.coupon_code ?? '', `${Number(p.fee_percent ?? def)}%`, money(fee), money(p.status === 'pago' ? p.amount_cents - fee : 0),
      p.payout === 'automatico' ? 'Automático (Asaas)' : p.manual_payout_done_at ? `Repassado em ${brDateTime(p.manual_payout_done_at)}` : 'A receber da Campia',
      brDateTime(p.refunded_at),
    ];
  });
  const csv = toCsv(['Pago em', 'Campeonato', 'Time', 'Situação', 'Forma', 'Valor (R$)', 'Desconto (R$)', 'Cupom', 'Taxa %', 'Taxa Campia (R$)', 'Sua parte (R$)', 'Repasse', 'Devolvido em'], rows);
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="campia-financeiro.csv"', 'cache-control': 'no-store' } });
}
