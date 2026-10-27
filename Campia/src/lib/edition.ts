import { escapeHtml } from './email';
import { brl } from './format';

/**
 * Nome sugerido para a próxima edição:
 * "Copa Verão 2026" → "Copa Verão 2027"; "Copa 3ª edição" → "Copa 4ª edição"; senão "· 2ª edição".
 */
export function nextEditionName(name: string) {
  const year = name.match(/\b(20\d{2})\b/);
  if (year) return name.replace(year[1], String(Number(year[1]) + 1));
  const ed = name.match(/(\d+)\s*[ªa]\s*edi[çc][ãa]o/i);
  if (ed) return name.replace(ed[0], `${Number(ed[1]) + 1}ª edição`);
  return `${name} · 2ª edição`.slice(0, 80);
}

/** Convite para os capitães da edição anterior. */
export function editionInviteEmail(p: { team: string; previous: string; championship: string; feeCents: number; start: string; url: string; organizer: string }) {
  const date = p.start ? p.start.split('-').reverse().join('/') : '';
  return {
    subject: `${p.championship}: inscrições abertas`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 8px">Vem aí o ${escapeHtml(p.championship)}!</h2>
<p>O <b>${escapeHtml(p.team)}</b> jogou o <b>${escapeHtml(p.previous)}</b>, então você fica sabendo primeiro: as inscrições da nova edição estão abertas${date ? `, com início em <b>${date}</b>` : ''}.</p>
<p>${p.feeCents ? `Inscrição de ${brl(p.feeCents)} por time, paga pelo PIX. ` : ''}As vagas são de quem se inscrever primeiro.</p>
<p><a href="${escapeHtml(p.url)}" style="display:inline-block;background:#22c55e;color:#06210f;padding:12px 20px;border-radius:10px;font-weight:bold;text-decoration:none">Garantir a vaga do time</a></p>
<p style="color:#666;font-size:13px">Convite enviado por ${escapeHtml(p.organizer)} pela Campia porque você foi capitão na edição anterior.</p>
</div>`,
  };
}
