// Classificação, desempate, mata-mata e artilharia.
import { sportRules } from './sports';
import type { Championship, Game, Goal, Player, Source, StandingRow, Team } from './types';

export const hasTeams = (g: Game) => !!(g.homeId && g.awayId);

/** O jogo tem resultado válido? (no mata-mata, empate precisa de desempate) */
export function isDecided(g: Game): boolean {
  if (!hasTeams(g)) return false;
  if (g.wo) return true;
  if (g.homeScore === null || g.awayScore === null) return false;
  if (g.stage !== 'ko' || g.homeScore !== g.awayScore) return true;
  return g.penHome !== null && g.penAway !== null && g.penHome !== g.penAway;
}

export function winnerId(g: Game): string | null {
  if (!isDecided(g)) return null;
  if (g.wo === 'both') return null;
  if (g.wo === 'home') return g.awayId;
  if (g.wo === 'away') return g.homeId;
  if (g.homeScore! > g.awayScore!) return g.homeId;
  if (g.homeScore! < g.awayScore!) return g.awayId;
  if (g.stage !== 'ko') return null; // empate em fase de pontos
  return g.penHome! > g.penAway! ? g.homeId : g.awayId;
}

export const ordered = (games: Game[]) => [...games].sort((a, b) => a.sort - b.sort || a.seq - b.seq);

/** Rótulos das rodadas/fases na ordem em que acontecem. */
export function labels(games: Game[]): string[] {
  const out: string[] = [];
  ordered(games).forEach(g => { if (!out.includes(g.label)) out.push(g.label); });
  return out;
}

function headToHead(c: Championship, games: Game[], a: string, b: string): number {
  const [pw, pd, pl] = sportRules(c.sport).points;
  let pa = 0, pb = 0;
  games.filter(g => isDecided(g) && ((g.homeId === a && g.awayId === b) || (g.homeId === b && g.awayId === a))).forEach(g => {
    if (g.wo) { // W.O.: só o time presente pontua
      const w = winnerId(g);
      if (w === a) pa += pw; else if (w === b) pb += pw;
      return;
    }
    const ga = g.homeId === a ? g.homeScore! : g.awayScore!;
    const gb = g.homeId === a ? g.awayScore! : g.homeScore!;
    if (ga > gb) { pa += pw; pb += pl; } else if (ga < gb) { pb += pw; pa += pl; } else { pa += pd; pb += pd; }
  });
  return pa - pb;
}

/** Classificação dos `teams` considerando apenas os `games` informados. */
export function standings(c: Championship, games: Game[], teams: Team[]): StandingRow[] {
  const [pw, pd, pl] = sportRules(c.sport).points;
  const rows = new Map<string, StandingRow>();
  teams.forEach(t => rows.set(t.id, { team: t, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0 }));
  games.filter(isDecided).forEach(g => {
    const h = rows.get(g.homeId!), a = rows.get(g.awayId!);
    if (!h || !a) return;
    h.J++; a.J++;
    if (g.wo === 'both') { h.D++; a.D++; return; } // W.O. duplo: derrota sem pontos para os dois
    if (g.wo) { // W.O.: vitória com o placar padrão; o ausente não ganha nem o ponto de derrota
      const win = winnerId(g) === h.team.id ? h : a, lose = win === h ? a : h;
      const [ws, ls] = sportRules(c.sport).woScore;
      win.V++; lose.D++; win.P += pw; win.GP += ws; win.GC += ls; lose.GP += ls; lose.GC += ws;
      return;
    }
    const hs = g.homeScore!, as = g.awayScore!;
    h.GP += hs; h.GC += as; a.GP += as; a.GC += hs;
    if (hs > as) { h.V++; a.D++; h.P += pw; a.P += pl; }
    else if (hs < as) { a.V++; h.D++; a.P += pw; h.P += pl; }
    else { h.E++; a.E++; h.P += pd; a.P += pd; }
  });
  const tiebreak = c.rules.tiebreak?.length ? c.rules.tiebreak : ['v', 'sg', 'gp', 'cd'];
  return [...rows.values()].sort((x, y) => {
    if (y.P !== x.P) return y.P - x.P;
    for (const k of tiebreak) {
      let d = 0;
      if (k === 'v') d = y.V - x.V;
      else if (k === 'sg') d = (y.GP - y.GC) - (x.GP - x.GC);
      else if (k === 'gp') d = y.GP - x.GP;
      else if (k === 'cd') d = headToHead(c, games, y.team.id, x.team.id);
      if (d) return d;
    }
    return x.team.slot - y.team.slot;
  });
}

export interface Table { title: string | null; rows: StandingRow[]; qualify: number }

export function tables(c: Championship, games: Game[], teams: Team[]): Table[] {
  if (c.format === 'pontos') return [{ title: null, rows: standings(c, games, teams), qualify: 0 }];
  if (c.format === 'grupos') {
    const groups = [...new Set(teams.map(t => t.group).filter((g): g is string => !!g))].sort();
    return groups.map(g => ({
      title: `Grupo ${g}`,
      qualify: c.rules.qualify,
      rows: standings(c, games.filter(x => x.stage === 'grupo' && x.group === g), teams.filter(t => t.group === g)),
    }));
  }
  return [];
}

function sourceTeam(c: Championship, games: Game[], teams: Team[], src: Source | null): string | null {
  if (!src) return null;
  if (src.type === 'team') return src.id;
  if (src.type === 'grp') {
    const groupGames = games.filter(g => g.stage === 'grupo' && g.group === src.g);
    if (!groupGames.length || !groupGames.every(isDecided)) return null;
    return standings(c, groupGames, teams.filter(t => t.group === src.g))[src.pos - 1]?.team.id ?? null;
  }
  const g = games.find(x => x.id === src.game);
  return g ? winnerId(g) : null;
}

export function sourceLabel(games: Game[], src: Source | null, teams: Team[]): string {
  if (!src) return 'A definir';
  if (src.type === 'grp') return `${src.pos}º Grupo ${src.g}`;
  if (src.type === 'win') return `Venc. ${games.find(x => x.id === src.game)?.name ?? ''}`;
  return teams.find(t => t.id === src.id)?.name ?? 'A definir';
}

/**
 * Preenche os times do mata-mata conforme os resultados.
 * Devolve os ids dos jogos alterados; jogos cujo confronto mudou têm o placar apagado.
 */
export function resolveKnockout(c: Championship, games: Game[], teams: Team[]): string[] {
  const changed: string[] = [];
  games.filter(g => g.stage === 'ko').sort((a, b) => a.seq - b.seq || a.sort - b.sort).forEach(g => {
    const h = sourceTeam(c, games, teams, g.srcHome);
    const a = sourceTeam(c, games, teams, g.srcAway);
    if (g.homeId !== h || g.awayId !== a) {
      g.homeId = h; g.awayId = a;
      g.homeScore = g.awayScore = g.penHome = g.penAway = null;
      g.wo = null;
      changed.push(g.id);
    }
  });
  return changed;
}

export function champion(c: Championship, games: Game[], teams: Team[]): Team | null {
  const final = games.find(g => g.stage === 'ko' && g.label === 'Final');
  const byId = (id: string | null) => teams.find(t => t.id === id) ?? null;
  if (final) return byId(winnerId(final));
  if (c.format === 'pontos' && games.length && games.every(isDecided)) return standings(c, games, teams)[0]?.team ?? null;
  return null;
}

export interface ScorerRow { player: Player; team: Team; total: number }

export function topScorers(games: Game[], goals: Goal[], players: Player[], teams: Team[]): ScorerRow[] {
  const decided = new Set(games.filter(isDecided).map(g => g.id));
  const totals = new Map<string, number>();
  goals.filter(x => decided.has(x.gameId)).forEach(x => totals.set(x.playerId, (totals.get(x.playerId) ?? 0) + x.count));
  const rows: ScorerRow[] = [];
  totals.forEach((total, pid) => {
    const player = players.find(p => p.id === pid);
    const team = player && teams.find(t => t.id === player.teamId);
    if (player && team && total > 0) rows.push({ player, team, total });
  });
  return rows.sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name));
}

/** Valida um placar antes de salvar. Retorna a mensagem de erro ou null. */
export function scoreError(c: Championship, g: Game, home: number, away: number, penHome: number | null, penAway: number | null): string | null {
  const rules = sportRules(c.sport);
  if (![home, away].every(n => Number.isInteger(n) && n >= 0)) return 'Placar inválido';
  if (home === away && !rules.draws && g.stage !== 'ko') return `${c.sport} não tem empate`;
  if (g.stage === 'ko' && home === away) {
    if (penHome === null || penAway === null || penHome === penAway) {
      return rules.draws ? `Mata-mata empatado: informe ${rules.tieLabel.toLowerCase() || 'o desempate'}` : `${c.sport} não tem empate`;
    }
  }
  return null;
}
