// Agenda da arena: todos os jogos dos campeonatos abertos, por dia, horário e campo.
export interface AgendaGame {
  id: string; date: string; time: string; field: string;
  champ: { name: string; slug: string };
  home: string; away: string; score: string | null;
}

export const AGENDA_DAYS = 14;

/** Jogos de hoje até `days` dias depois, agrupados por dia; dentro do dia, por horário e campo. */
export function agendaDays(games: AgendaGame[], today: string, days = AGENDA_DAYS) {
  const end = shift(today, days - 1);
  const list = games.filter(g => g.date && g.date >= today && g.date <= end)
    .sort((a, b) => (a.date + (a.time || '99:99') + a.field).localeCompare(b.date + (b.time || '99:99') + b.field, 'pt-BR', { numeric: true }));
  const out: Array<{ date: string; games: AgendaGame[] }> = [];
  for (const g of list) {
    const last = out[out.length - 1];
    if (last?.date === g.date) last.games.push(g); else out.push({ date: g.date, games: [g] });
  }
  return out;
}

export function todayBr(now = new Date()) {
  return new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

function shift(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
