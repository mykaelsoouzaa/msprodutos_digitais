// Lembrete por e-mail para o capitão que reservou a vaga e ainda não pagou o PIX.
import { escapeHtml } from './email';
import { brl } from './format';

export const REMIND_AFTER_MIN = 10;   // espera 10 min depois da reserva
export const MIN_LEFT_MIN = 5;        // só vale a pena se faltarem pelo menos 5 min

export interface PendingPix { id: string; created_at: string; reminder_sent_at: string | null; reserved_until: string | null; status: string }

/** Pagamentos pendentes que já devem receber o lembrete (uma vez só, com tempo para pagar). */
export function duePixReminders<T extends PendingPix>(rows: T[], now: number): T[] {
  return rows.filter(r => {
    if (r.status !== 'pendente' || r.reminder_sent_at || !r.reserved_until) return false;
    const age = (now - Date.parse(r.created_at)) / 60_000;
    const left = (Date.parse(r.reserved_until) - now) / 60_000;
    return age >= REMIND_AFTER_MIN && left >= MIN_LEFT_MIN;
  });
}

export function pixReminderEmail(p: { team: string; championship: string; amountCents: number; url: string; minutesLeft: number }) {
  const team = escapeHtml(p.team), champ = escapeHtml(p.championship);
  return {
    subject: `Falta o PIX da inscrição do ${p.team}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 8px">Sua vaga ainda está reservada</h2>
<p>A inscrição do <b>${team}</b> no <b>${champ}</b> está aguardando o PIX de <b>${brl(p.amountCents)}</b>.</p>
<p>A reserva vale por mais <b>${p.minutesLeft} minutos</b>. Depois disso a vaga volta a ficar livre para outro time.</p>
<p><a href="${escapeHtml(p.url)}" style="display:inline-block;background:#22c55e;color:#06210f;padding:12px 20px;border-radius:10px;font-weight:bold;text-decoration:none">Pagar o PIX agora</a></p>
<p style="color:#666;font-size:13px">Se você já pagou, pode ignorar este e-mail: a confirmação chega em instantes.</p>
</div>`,
  };
}
