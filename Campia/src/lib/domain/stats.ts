// Números do campeonato: forma recente, ataque/defesa, goleada, fair play e confronto direto.
import { isDecided, ordered, winnerId } from './standings';
import type { Card, Game, Team } from './types';

export type Outcome = 'V' | 'E' | 'D';

/** Resultado do time num jogo decidido. W.O. duplo conta derrota para os dois. */
export function outcome(g: Game, teamId: string): Outcome | null {
  if (!isDecided(g) || (g.homeId !== teamId && g.awayId !== teamId)) return null;
  if (g.wo === 'both') return 'D';
  const w = winnerId(g);
  return w === null ? 'E' : w === teamId ? 'V' : 'D';
}

/** Últimos `n` resultados, do mais antigo para o mais recente (lê da esquerda para a direita). */
export function recentForm(games: Game[], teamId: string, n = 5): Outcome[] {
  const list = ordered(games).map(g => outcome(g, teamId)).filter((o): o is Outcome => o !== null);
  return list.slice(-n);
}

/** Jogos com placar de verdade (W.O. não entra nas médias). */
const real = (games: Game[]) => games.filter(g => isDecided(g) && !g.wo);

export interface TeamCount { team: Team; value: number; games: number }

export function champStats(games: Game[], teams: Team[], cards: Card[]) {
  const played = real(games);
  const total = played.reduce((s, g) => s + g.homeScore! + g.awayScore!, 0);
  const per = new Map<string, { gp: number; gc: number; j: number }>();
  for (const g of played) {
    for (const [id, gp, gc] of [[g.homeId!, g.homeScore!, g.awayScore!], [g.awayId!, g.awayScore!, g.homeScore!]] as const) {
      const r = per.get(id) ?? { gp: 0, gc: 0, j: 0 };
      r.gp += gp; r.gc += gc; r.j++;
      per.set(id, r);
    }
  }
  const team = (id: string) => teams.find(t => t.id === id);
  const rows = [...per].flatMap(([id, r]) => { const t = team(id); return t ? [{ team: t, ...r }] : []; });
  const attack = [...rows].sort((a, b) => b.gp - a.gp || a.j - b.j)[0];
  const defense = [...rows].sort((a, b) => a.gc - b.gc || b.j - a.j)[0];
  const biggest = [...played].sort((a, b) =>
    Math.abs(b.homeScore! - b.awayScore!) - Math.abs(a.homeScore! - a.awayScore!) || (b.homeScore! + b.awayScore!) - (a.homeScore! + a.awayScore!))[0];

  // Fair play: amarelo 1 ponto, vermelho 3; menos é melhor. Só times que já jogaram.
  const fair = new Map<string, { yellow: number; red: number }>();
  for (const c of cards) {
    const r = fair.get(c.teamId) ?? { yellow: 0, red: 0 };
    r.yellow += c.yellow; r.red += c.red ? 1 : 0;
    fair.set(c.teamId, r);
  }
  const fairPlay = rows.map(r => {
    const f = fair.get(r.team.id) ?? { yellow: 0, red: 0 };
    return { team: r.team, yellow: f.yellow, red: f.red, points: f.yellow + f.red * 3, games: r.j };
  }).sort((a, b) => a.points - b.points || b.games - a.games || a.team.name.localeCompare(b.team.name));

  return {
    games: played.length,
    total,
    average: played.length ? total / played.length : 0,
    attack: attack ? { team: attack.team, value: attack.gp, games: attack.j } : null,
    defense: defense ? { team: defense.team, value: defense.gc, games: defense.j } : null,
    biggest: biggest && biggest.homeScore !== biggest.awayScore ? biggest : null,
    fairPlay,
  };
}

/** Jogos já decididos entre os dois times (mais recente primeiro), sem contar o jogo atual. */
export function headToHead(games: Game[], a: string, b: string, exceptId?: string) {
  return ordered(games).filter(g => g.id !== exceptId && isDecided(g)
    && ((g.homeId === a && g.awayId === b) || (g.homeId === b && g.awayId === a))).reverse();
}
