// Lista de espera: quem avisar quando abre vaga.
import { escapeHtml } from './email';
import { brl } from './format';

export const WAITLIST_WINDOW_MIN = 30; // quem foi avisado tem 30 min de preferência antes de avisarmos o próximo

export interface WaitEntry { id: string; created_at: string; notified_at: string | null }

/**
 * Quantas vagas livres há e quem avisar agora: os primeiros da fila ainda não avisados,
 * descontando quem foi avisado há menos de 30 min (ainda pode estar se inscrevendo).
 */
export function waitlistToNotify<T extends WaitEntry>(entries: T[], freeSlots: number, now: number): T[] {
  const recent = entries.filter(e => e.notified_at && now - Date.parse(e.notified_at) < WAITLIST_WINDOW_MIN * 60_000).length;
  const n = Math.max(0, freeSlots - recent);
  return [...entries].filter(e => !e.notified_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, n);
}

/** Vagas livres agora: abertas ou com reserva vencida. */
export const freeSlots = (teams: Array<{ status: string; reserved_until: string | null }>, now: number) =>
  teams.filter(t => t.status === 'aberta' || (t.status === 'reservada' && t.reserved_until !== null && Date.parse(t.reserved_until) < now)).length;

export function waitlistEmail(p: { team: string; championship: string; feeCents: number; url: string }) {
  return {
    subject: `Abriu vaga no ${p.championship}!`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 8px">Abriu uma vaga!</h2>
<p>O <b>${escapeHtml(p.team)}</b> estava na lista de espera do <b>${escapeHtml(p.championship)}</b> e agora tem vaga.</p>
<p>A vaga é de quem se inscrever e pagar primeiro${p.feeCents ? ` (${brl(p.feeCents)} pelo PIX)` : ''}, então corra.</p>
<p><a href="${escapeHtml(p.url)}" style="display:inline-block;background:#22c55e;color:#06210f;padding:12px 20px;border-radius:10px;font-weight:bold;text-decoration:none">Inscrever o time agora</a></p>
<p style="color:#666;font-size:13px">Você recebeu este e-mail porque entrou na lista de espera na Campia.</p>
</div>`,
  };
}
