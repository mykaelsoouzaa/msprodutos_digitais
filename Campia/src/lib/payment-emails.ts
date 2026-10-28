// E-mails do pagamento confirmado (texto puro, testável).
import { escapeHtml } from './email';
import { brl } from './format';

const btn = (url: string, label: string) =>
  `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#22c55e;color:#06210f;padding:12px 20px;border-radius:10px;font-weight:bold;text-decoration:none">${escapeHtml(label)}</a></p>`;

export function methodLabel(method: string | null | undefined, installments?: number | null) {
  if (method === 'cartao') return installments && installments > 1 ? `Cartão de crédito em ${installments}x` : 'Cartão de crédito';
  if (method === 'manual') return 'Confirmado pelo organizador';
  return 'PIX';
}

/** Para o capitão: inscrição confirmada, com os dados do comprovante. */
export function captainConfirmedEmail(p: {
  team: string; championship: string; amountCents: number; method: string; paidAt: string; code: string; receiptUrl: string; championshipUrl: string;
}) {
  const when = new Date(p.paidAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return {
    subject: `✅ ${p.team} está inscrito no ${p.championship}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 8px">Inscrição confirmada!</h2>
<p>O <b>${escapeHtml(p.team)}</b> está garantido no <b>${escapeHtml(p.championship)}</b>.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
<tr><td style="padding:6px 0;color:#666">Valor</td><td style="text-align:right"><b>${p.amountCents < 0 ? '—' : p.amountCents ? brl(p.amountCents) : 'Grátis'}</b></td></tr>
<tr><td style="padding:6px 0;color:#666">Forma</td><td style="text-align:right">${escapeHtml(p.method)}</td></tr>
<tr><td style="padding:6px 0;color:#666">Data</td><td style="text-align:right">${escapeHtml(when)}</td></tr>
<tr><td style="padding:6px 0;color:#666">Código</td><td style="text-align:right;font-family:monospace">${escapeHtml(p.code)}</td></tr>
</table>
${btn(p.championshipUrl, 'Ver jogos e tabela')}
<p style="font-size:13px"><a href="${escapeHtml(p.receiptUrl)}">Abrir o comprovante</a> · acompanhe tudo em <a href="${escapeHtml(p.championshipUrl.replace(/\/c\/.*$/, '/meus-times'))}">Meus times</a>.</p>
</div>`,
  };
}

/** Para o organizador: mais um time pago. */
export function organizerNewTeamEmail(p: { team: string; championship: string; amountCents: number; method: string; signed: number; total: number; panelUrl: string }) {
  const full = p.signed >= p.total;
  return {
    subject: full ? `🎉 ${p.championship} lotou: ${p.signed} de ${p.total} times` : `Nova inscrição: ${p.team} (${p.signed} de ${p.total})`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 8px">${full ? 'Campeonato lotado!' : 'Mais um time inscrito'}</h2>
<p><b>${escapeHtml(p.team)}</b> ${p.amountCents > 0 ? `pagou <b>${brl(p.amountCents)}</b> (${escapeHtml(p.method)})` : p.amountCents < 0 ? `foi confirmado (${escapeHtml(p.method)})` : 'fez a inscrição grátis'} e está confirmado no <b>${escapeHtml(p.championship)}</b>.</p>
<p style="font-size:22px;margin:14px 0"><b>${p.signed}</b> de ${p.total} vagas preenchidas</p>
${btn(p.panelUrl, 'Abrir o painel')}
</div>`,
  };
}
