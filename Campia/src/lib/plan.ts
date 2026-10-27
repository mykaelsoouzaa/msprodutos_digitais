// Plano Pro dos organizadores. Preço e taxa ficam em variáveis da Vercel para mudar sem mexer no código.
import { campiaFeePercent } from './payout';

/** Mensalidade do Pro em centavos (CAMPIA_PRO_PRECO, em reais; padrão R$ 49,90). */
export function proPriceCents(raw = process.env.CAMPIA_PRO_PRECO): number {
  const n = Number(String(raw ?? '').replace(',', '.'));
  return raw && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 4990;
}

/** Taxa da Campia por inscrição para quem é Pro (CAMPIA_TAXA_PERCENT_PRO; padrão 5%). */
export function proFeePercent(raw = process.env.CAMPIA_TAXA_PERCENT_PRO): number {
  return campiaFeePercent(raw ?? '5');
}

/** Taxa que vale para um organizador. */
export const feeFor = (pro: boolean) => (pro ? proFeePercent() : campiaFeePercent());

export interface PlanRow {
  owner_id: string;
  status: 'pendente' | 'ativo' | 'cancelado';
  source: 'asaas' | 'cortesia';
  paid_until: string | null;
  asaas_subscription_id: string | null;
  invoice_url: string | null;
}

export const isProActive = (plan: Pick<PlanRow, 'paid_until'> | null | undefined, now = Date.now()) =>
  !!plan?.paid_until && new Date(plan.paid_until).getTime() > now;

/** Folga depois do vencimento antes de perder o Pro (PIX de fim de semana, boleto compensando). */
export const GRACE_DAYS = 5;

/**
 * Mensalidade paga: libera o Pro até 1 mês depois do vencimento dessa cobrança (+ folga).
 * Nunca encurta o que já estava pago (ex.: webhook repetido ou fora de ordem).
 */
export function extendPaidUntil(current: string | null, dueDate: string): string {
  const d = new Date(`${dueDate}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31/01 → 28/02
  d.setUTCDate(d.getUTCDate() + GRACE_DAYS);
  const next = d.toISOString();
  return current && current > next ? current : next;
}

/** O que só o Pro tem (aparece na página do plano e em Para arenas). */
export const PRO_FEATURES: Array<[string, string]> = [
  ['💸', 'Taxa menor por inscrição'],
  ['🏷️', 'Sem a marca Campia na página do campeonato, na impressão e nas artes'],
  ['🤝', 'Patrocinadores com logo na página, na impressão e nas artes'],
  ['📊', 'Estatísticas de visitas: de onde vem o público e quantos vão para a inscrição'],
  ['⬇️', 'Planilhas de times, atletas, pagamentos e jogos'],
];
