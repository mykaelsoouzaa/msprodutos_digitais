// Repasse automático das inscrições ao organizador (split da Asaas).

/** Taxa da Campia sobre o valor líquido de cada inscrição, em %. Configurada em CAMPIA_TAXA_PERCENT. */
export function campiaFeePercent(raw = process.env.CAMPIA_TAXA_PERCENT): number {
  const n = Number(String(raw ?? '').replace(',', '.'));
  if (raw === undefined || raw === '' || !Number.isFinite(n)) return 10;
  return Math.min(100, Math.max(0, n));
}

/** Parte do organizador (percentualValue do split), com até 4 casas como a Asaas aceita. */
export const organizerPercent = (fee = campiaFeePercent()) => Math.round((100 - fee) * 10000) / 10000;

export const WALLET_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
