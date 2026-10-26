// Cartões e suspensões.
// Regra: vermelho (ou 2 amarelos no mesmo jogo) = suspenso no próximo jogo do time.
// A cada `yellowLimit` amarelos acumulados (em jogos diferentes) = suspenso no próximo jogo, e a contagem zera.
import { isDecided, ordered } from './standings';
import type { Card, Game, Player, Team } from './types';

export const DEFAULT_YELLOW_LIMIT = 3;

export interface DisciplineRow { player: Player; team: Team; yellow: number; red: number; suspendedIn: Game | null }

export interface Discipline {
  /** gameId → atletas suspensos naquele jogo */
  suspended: Map<string, Set<string>>;
  rows: DisciplineRow[];
}

export function discipline(games: Game[], cards: Card[], players: Player[], teams: Team[], yellowLimit = DEFAULT_YELLOW_LIMIT): Discipline {
  const suspended = new Map<string, Set<string>>();
  const totals = new Map<string, { yellow: number; red: number; suspendedIn: Game | null }>();
  const limit = Math.max(1, yellowLimit);

  for (const team of teams) {
    const pending = new Set<string>();      // cumprem suspensão no próximo jogo do time
    const accumulated = new Map<string, number>();
    for (const g of ordered(games).filter(x => x.homeId === team.id || x.awayId === team.id)) {
      if (pending.size) {
        suspended.set(g.id, new Set([...(suspended.get(g.id) ?? []), ...pending]));
        pending.forEach(pid => { const t = totals.get(pid); if (t) t.suspendedIn = isDecided(g) ? null : g; });
        pending.clear();
      }
      if (!isDecided(g)) continue;
      for (const c of cards.filter(x => x.gameId === g.id && x.teamId === team.id)) {
        const t = totals.get(c.playerId) ?? { yellow: 0, red: 0, suspendedIn: null };
        totals.set(c.playerId, t);
        t.yellow += c.yellow;
        const sentOff = c.red || c.yellow >= 2;
        if (c.red) t.red++;
        if (sentOff) { pending.add(c.playerId); continue; }
        if (c.yellow > 0) {
          const n = (accumulated.get(c.playerId) ?? 0) + c.yellow;
          if (n >= limit) { pending.add(c.playerId); accumulated.set(c.playerId, 0); } else accumulated.set(c.playerId, n);
        }
      }
    }
    // Suspensão sem próximo jogo marcado ainda: fica registrada sem jogo definido.
  }

  const rows: DisciplineRow[] = [];
  totals.forEach((t, pid) => {
    const player = players.find(p => p.id === pid);
    const team = player && teams.find(x => x.id === player.teamId);
    if (player && team && (t.yellow || t.red)) rows.push({ player, team, ...t });
  });
  rows.sort((a, b) => b.red - a.red || b.yellow - a.yellow || a.player.name.localeCompare(b.player.name));
  return { suspended, rows };
}
