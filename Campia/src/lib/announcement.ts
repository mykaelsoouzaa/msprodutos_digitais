// Recado do organizador para todos os capitães.
import { escapeHtml } from './email';

export const ANNOUNCE_MAX = 1500;
export const ANNOUNCE_EVERY_MIN = 10;

/** Texto com quebras de linha → parágrafos seguros em HTML. */
export function textToHtml(text: string) {
  return text.trim().split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('\n');
}

export function announcementEmail(p: { championship: string; from: string; subject: string; text: string; url: string }) {
  return {
    subject: `[${p.championship}] ${p.subject}`.slice(0, 150),
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
<p style="color:#666;font-size:13px;margin:0 0 4px">Recado de <b>${escapeHtml(p.from)}</b> · ${escapeHtml(p.championship)}</p>
<h2 style="margin:0 0 12px">${escapeHtml(p.subject)}</h2>
${textToHtml(p.text)}
<p style="margin-top:18px"><a href="${escapeHtml(p.url)}" style="color:#16a34a">Ver jogos e tabela do campeonato</a></p>
<p style="color:#666;font-size:12px">Você recebeu porque é capitão de um time inscrito. Para responder, é só responder este e-mail.</p>
</div>`,
  };
}

/** Lista de e-mails únicos e válidos. */
export function uniqueEmails(list: Array<string | null | undefined>) {
  return [...new Set(list.map(e => (e ?? '').trim().toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
}
