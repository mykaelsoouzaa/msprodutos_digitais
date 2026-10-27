// Dono da plataforma: e-mails em ADMIN_EMAILS (separados por vírgula) acessam /admin.
export function isAdmin(email: string | null | undefined, raw = process.env.ADMIN_EMAILS): boolean {
  if (!email) return false;
  const list = (raw ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Divide o valor bruto entre organizador e Campia pela taxa (estimativa: a tarifa do Asaas sai antes). */
export function splitGross(cents: number, feePercent: number) {
  const campia = Math.round((cents * feePercent) / 100);
  return { campia, organizer: cents - campia };
}
