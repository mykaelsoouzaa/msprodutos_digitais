// Preço da inscrição: lotes por data e cupom de desconto.

export interface PriceTier { until: string; cents: number } // vale até o fim do dia `until` (AAAA-MM-DD)
export interface Coupon { code: string; percent: number | null; amount_cents: number | null; max_uses: number | null }

/** Hoje no horário de Brasília (AAAA-MM-DD). */
export const todayBr = (now = Date.now()) => new Date(now - 3 * 3600_000).toISOString().slice(0, 10);

export function sortedTiers(tiers: PriceTier[] | null | undefined): PriceTier[] {
  return [...(tiers ?? [])].filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.until) && Number.isInteger(t.cents) && t.cents >= 0)
    .sort((a, b) => a.until.localeCompare(b.until));
}

/** Preço de hoje e informações do lote atual / próximo. */
export function currentPrice(baseCents: number, tiers: PriceTier[] | null | undefined, today: string) {
  const list = sortedTiers(tiers);
  const idx = list.findIndex(t => t.until >= today);
  if (idx === -1) return { cents: baseCents, lot: list.length ? list.length + 1 : null, until: null as string | null, next: null as number | null };
  const next = idx + 1 < list.length ? list[idx + 1].cents : baseCents;
  return { cents: list[idx].cents, lot: idx + 1, until: list[idx].until, next: next !== list[idx].cents ? next : null };
}

export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Desconto do cupom em centavos (nunca maior que o preço). */
export function couponDiscount(priceCents: number, c: Pick<Coupon, 'percent' | 'amount_cents'>): number {
  const d = c.percent ? Math.round((priceCents * c.percent) / 100) : (c.amount_cents ?? 0);
  return Math.max(0, Math.min(priceCents, d));
}

/** Texto do preço para mostrar ao público: "R$ 250,00 (1º lote até 01/11, depois R$ 300,00)". */
export function priceText(baseCents: number, tiers: PriceTier[] | null | undefined, brl: (c: number) => string, today = todayBr()) {
  const p = currentPrice(baseCents, tiers, today);
  if (!p.cents) return { now: p.cents, short: 'grátis', long: 'inscrição grátis' };
  const short = brl(p.cents);
  if (!p.until || !p.lot) return { now: p.cents, short, long: short };
  const [, m, d] = p.until.split('-');
  const tail = p.next !== null ? `, depois ${brl(p.next)}` : '';
  return { now: p.cents, short, long: `${short} (${p.lot}º lote até ${d}/${m}${tail})` };
}
