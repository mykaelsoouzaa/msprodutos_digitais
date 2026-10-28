// Textos prontos para colar no grupo do WhatsApp (negrito com *asteriscos*, como o WhatsApp entende).
import { fmtDate } from './format';
import { isDecided, labels, ordered, sourceLabel, tables } from './domain/standings';
import type { Championship, Game, Team } from './domain/types';

const MEDAL = ['🥇', '🥈', '🥉'];

function names(games: Game[], teams: Team[]) {
  return (g: Game) => [
    teams.find(t => t.id === g.homeId)?.name ?? sourceLabel(games, g.srcHome, teams),
    teams.find(t => t.id === g.awayId)?.name ?? sourceLabel(games, g.srcAway, teams),
  ];
}

function score(g: Game) {
  if (g.wo === 'both') return 'W.O. duplo';
  const pen = g.penHome !== null && g.penAway !== null && g.homeScore === g.awayScore ? ` (${g.penHome}×${g.penAway})` : '';
  return `${g.homeScore} × ${g.awayScore}${pen}${g.wo ? ' W.O.' : ''}`;
}

/** Resultados da última rodada com placar (ou da rodada pedida). */
export function resultsText(c: Championship, games: Game[], teams: Team[], url: string, label?: string) {
  const done = labels(games).filter(l => games.some(g => g.label === l && isDecided(g)));
  const l = label && done.includes(label) ? label : done[done.length - 1];
  if (!l) return '';
  const n = names(games, teams);
  const lines = ordered(games).filter(g => g.label === l && isDecided(g)).map(g => { const [h, a] = n(g); return `${h} *${score(g)}* ${a}`; });
  return [`🏁 *${c.name}*`, `Resultados · ${l}`, '', ...lines, '', `📊 Tabela completa: ${url}`].join('\n');
}

/** Próximos jogos marcados (até 10), agrupados por dia. */
export function nextGamesText(c: Championship, games: Game[], teams: Team[], url: string, today: string) {
  const n = names(games, teams);
  const next = ordered(games).filter(g => !isDecided(g) && g.date && g.date >= today && (g.homeId || g.srcHome))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 10);
  if (!next.length) return '';
  const out = [`📅 *${c.name}*`, 'Próximos jogos'];
  let day = '';
  for (const g of next) {
    if (g.date !== day) { day = g.date; out.push('', `*${fmtDate(g.date)}*`); }
    const [h, a] = n(g);
    out.push(`${g.time || '--:--'}${g.field ? ` · ${g.field}` : ''} · ${h} x ${a}`);
  }
  out.push('', `Acompanhe: ${url}`);
  return out.join('\n');
}

/** Classificação resumida de todos os grupos. */
export function standingsText(c: Championship, games: Game[], teams: Team[], url: string) {
  const ts = tables(c, games, teams).filter(t => t.rows.some(r => r.J > 0));
  if (!ts.length) return '';
  const out = [`📊 *${c.name}*`, 'Classificação'];
  for (const t of ts) {
    out.push('');
    if (t.title) out.push(`*${t.title}*`);
    t.rows.forEach((r, i) => out.push(`${MEDAL[i] ?? `${i + 1}º`} ${r.team.name} · ${r.P} pt${r.P === 1 ? "" : "s"} (${r.J} j, saldo ${r.GP - r.GC})`));
  }
  out.push('', url);
  return out.join('\n');
}
