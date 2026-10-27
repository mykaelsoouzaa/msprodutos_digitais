// Indique uma arena: quem indica ganha 1 mês de Pro quando a arena indicada paga a primeira mensalidade.

export const REFERRAL_COOKIE = 'campia-indicacao';
export const REFERRAL_RE = /^[a-z0-9]{6,12}$/;
export const REFERRAL_DAYS = 60;

/** Código curto e legível (sem letras parecidas como l/1, o/0). */
export function newReferralCode(rand = Math.random) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => abc[Math.floor(rand() * abc.length)]).join('');
}

/** Um mês a mais de Pro a partir do que já estava pago (ou de agora). */
export function addMonth(currentPaidUntil: string | null, now = new Date()): string {
  const base = currentPaidUntil && new Date(currentPaidUntil) > now ? new Date(currentPaidUntil) : new Date(now);
  const day = base.getUTCDate();
  base.setUTCMonth(base.getUTCMonth() + 1);
  if (base.getUTCDate() < day) base.setUTCDate(0);
  return base.toISOString();
}
