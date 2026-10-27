import { slugify } from './format';
import type { ChampData } from './data';
import { champion, isDecided } from './domain/standings';
import { type VoteResult, categoriesFor, ranking } from './voting';

export const HANDLE_RE = /^[a-z0-9-]{3,40}$/;

/** Endereço do perfil a partir do nome: "Rafael Souza" → "rafael-souza" (+ sufixo se precisar). */
export function handleFrom(name: string, suffix = '') {
  const base = slugify(name).slice(0, 30).replace(/-$/, '') || 'atleta';
  const h = suffix ? `${base}-${suffix}` : base;
  return h.length >= 3 ? h : `${h}-atleta`;
}

export interface AthleteEntry {
  championship: { id: string; slug: string; name: string; sport: string };
  team: { id: string; name: string; short: string; color: string };
  playerName: string;
  games: number;        // jogos do time já decididos (ou presença marcada, se houver)
  goals: number;
  yellow: number;
  red: number;
  champion: boolean;
  finished: boolean;
  awards: string[];     // prêmios da votação: "Craque do campeonato"...
}

/** Monta a linha do perfil para um atleta (playerId) dentro de um campeonato já carregado. */
export function entryFor(d: ChampData, playerId: string, votes: VoteResult[], present?: Set<string>): AthleteEntry | null {
  const p = d.players.find(x => x.id === playerId);
  const team = p && d.teams.find(t => t.id === p.teamId);
  if (!p || !team) return null;
  const teamGames = d.games.filter(g => isDecided(g) && (g.homeId === team.id || g.awayId === team.id));
  const games = present && present.size ? teamGames.filter(g => present.has(g.id)).length : teamGames.length;
  const ch = champion(d.champ, d.games, d.teams);
  const awards = d.champ.voting === 'encerrada'
    ? categoriesFor(d.champ.sport).filter(([cat]) => ranking(votes, d.players, d.teams, cat)[0]?.player.id === p.id).map(([, label]) => label)
    : [];
  return {
    championship: { id: d.champ.id, slug: d.champ.slug, name: d.champ.name, sport: d.champ.sport },
    team: { id: team.id, name: team.name, short: team.short, color: team.color },
    playerName: p.name,
    games,
    goals: d.goals.filter(g => g.playerId === p.id).reduce((s, g) => s + g.count, 0),
    yellow: d.cards.filter(c => c.playerId === p.id).reduce((s, c) => s + c.yellow, 0),
    red: d.cards.filter(c => c.playerId === p.id && c.red).length,
    champion: ch?.id === team.id,
    finished: !!ch,
    awards,
  };
}

export function athleteTotals(entries: AthleteEntry[]) {
  return {
    championships: entries.length,
    games: entries.reduce((s, e) => s + e.games, 0),
    goals: entries.reduce((s, e) => s + e.goals, 0),
    titles: entries.filter(e => e.champion).length,
    awards: entries.reduce((s, e) => s + e.awards.length, 0),
    yellow: entries.reduce((s, e) => s + e.yellow, 0),
    red: entries.reduce((s, e) => s + e.red, 0),
  };
}
