// Resumo de um time para a área do capitão: posição, próximos jogos e último resultado.
import { hasTeams, isDecided, ordered, tables, winnerId } from './domain/standings';
import type { Championship, Game, Team } from './domain/types';

export interface TeamSummary {
  position: number | null;
  tableTitle: string | null;
  tableSize: number;
  played: number;
  wins: number;
  next: Game[];
  last: Game | null;
  lastOutcome: 'V' | 'E' | 'D' | null;
  eliminated: boolean;
}

export function teamSummary(c: Championship, games: Game[], teams: Team[], teamId: string): TeamSummary {
  const mine = ordered(games).filter(g => g.homeId === teamId || g.awayId === teamId);
  const done = mine.filter(isDecided);
  const last = done.at(-1) ?? null;
  let lastOutcome: TeamSummary['lastOutcome'] = null;
  if (last) {
    const w = winnerId(last);
    lastOutcome = w === teamId ? 'V' : w ? 'D' : 'E';
  }
  let position: number | null = null, tableTitle: string | null = null, tableSize = 0;
  for (const t of tables(c, games, teams)) {
    const i = t.rows.findIndex(r => r.team.id === teamId);
    if (i >= 0) { position = i + 1; tableTitle = t.title; tableSize = t.rows.length; break; }
  }
  // Eliminado: perdeu um jogo de mata-mata.
  const eliminated = done.some(g => g.stage === 'ko' && winnerId(g) !== teamId);
  return {
    position, tableTitle, tableSize,
    played: done.length,
    wins: done.filter(g => winnerId(g) === teamId).length,
    next: mine.filter(g => hasTeams(g) && !isDecided(g)).slice(0, 3),
    last, lastOutcome, eliminated,
  };
}
