// Relatório financeiro do organizador: quanto entrou, a taxa da Campia e o que é dele.
// Valores estimados: a tarifa do Asaas por PIX/cartão sai antes da divisão e não aparece aqui.
import { campiaFeePercent } from './payout';

export interface FinPayment {
  championship_id: string; amount_cents: number; discount_cents: number | null; status: string;
  payout: 'automatico' | 'manual' | null; manual_payout_done_at: string | null; fee_percent: number | null;
  method: string | null; paid_at: string | null; refunded_at: string | null;
}

export interface FinTotals {
  paid: number; count: number; discounts: number; campia: number; yours: number;
  auto: number; manualDone: number; manualPending: number; refunded: number; refundedCount: number; late: number;
}

const zero = (): FinTotals => ({ paid: 0, count: 0, discounts: 0, campia: 0, yours: 0, auto: 0, manualDone: 0, manualPending: 0, refunded: 0, refundedCount: 0, late: 0 });

export function financeSummary(list: FinPayment[], defaultFee = campiaFeePercent()) {
  const total = zero();
  const byChamp = new Map<string, FinTotals>();
  const byMonth = new Map<string, FinTotals>();
  for (const p of list) {
    const bucket = [total, byChamp.get(p.championship_id) ?? zero()];
    byChamp.set(p.championship_id, bucket[1]);
    if (p.status === 'pago') {
      const month = (p.paid_at ?? '').slice(0, 7);
      if (month) { const m = byMonth.get(month) ?? zero(); byMonth.set(month, m); bucket.push(m); }
      const fee = Math.round((p.amount_cents * Number(p.fee_percent ?? defaultFee)) / 100);
      const yours = p.amount_cents - fee;
      for (const t of bucket) {
        t.paid += p.amount_cents; t.count++; t.discounts += p.discount_cents ?? 0; t.campia += fee; t.yours += yours;
        if (p.payout === 'automatico') t.auto += yours;
        else if (p.manual_payout_done_at) t.manualDone += yours;
        else t.manualPending += yours;
      }
    } else if (p.status === 'estornado') {
      for (const t of bucket) { t.refunded += p.amount_cents; t.refundedCount++; }
    } else if (p.status === 'pago_tarde') {
      for (const t of bucket) t.late += p.amount_cents;
    }
  }
  const months = [...byMonth].sort((a, b) => b[0].localeCompare(a[0]));
  return { total, byChamp, months };
}

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
