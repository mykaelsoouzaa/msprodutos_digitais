// Regras da inscrição paga num lugar só (usadas pela ação de inscrição e testadas de ponta a ponta).
import { organizerPercent } from './payout';
import { feeFor } from './plan';
import { type Coupon, type PriceTier, couponDiscount, currentPrice, normalizeCode } from './pricing';

export interface QuoteInput {
  baseCents: number;
  tiers: PriceTier[] | null | undefined;
  today: string;
  couponCode: string;
  coupon: Coupon | null;      // cupom encontrado no banco para esse código (ou null)
  couponUses: number;         // inscrições pagas/pendentes que já usaram o cupom
  pro: boolean;               // organizador é Pro (taxa menor)
  walletId: string | null;    // conta Asaas conectada para o repasse automático
}

export type Quote =
  | { ok: true; code: string; price: number; discount: number; amount: number; fee: number; split: { walletId: string; percent: number } | undefined }
  | { ok: false; error: string };

export function quote(i: QuoteInput): Quote {
  const price = currentPrice(i.baseCents, i.tiers, i.today).cents;
  const code = normalizeCode(i.couponCode);
  let discount = 0;
  if (code) {
    if (!i.coupon) return { ok: false, error: 'Cupom inválido para este campeonato' };
    if (i.coupon.max_uses && i.couponUses >= i.coupon.max_uses) return { ok: false, error: 'Esse cupom já foi usado o número máximo de vezes' };
    discount = couponDiscount(price, i.coupon);
  }
  const fee = feeFor(i.pro);
  return {
    ok: true, code, price, discount, amount: price - discount, fee,
    split: i.walletId ? { walletId: i.walletId, percent: organizerPercent(fee) } : undefined,
  };
}

/** O que fazer com um aviso do Asaas. */
export type WebhookAction =
  | { type: 'plano'; subscription: string; dueDate: string }
  | { type: 'inscricao'; asaasId: string; reference: string }
  | { type: 'ignorar' };

const PAID = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);

export function webhookAction(body: { event?: string; payment?: { id?: string; externalReference?: string; subscription?: string; dueDate?: string } } | null, today: string): WebhookAction {
  if (!body?.event || !body.payment?.id || !PAID.has(body.event)) return { type: 'ignorar' };
  if (body.payment.subscription) {
    const due = /^\d{4}-\d{2}-\d{2}$/.test(body.payment.dueDate ?? '') ? body.payment.dueDate! : today;
    return { type: 'plano', subscription: body.payment.subscription, dueDate: due };
  }
  return { type: 'inscricao', asaasId: body.payment.id, reference: body.payment.externalReference ?? '' };
}
