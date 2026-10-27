import type { ChampData } from './data';
import { sportLabel, sportRules } from './domain/sports';
import { champion } from './domain/standings';
import { type VoteResult, categoriesFor, ranking } from './voting';

export interface Scorer { key: string; name: string; team: string; handle?: string; total: number; championships: number }
export interface Title { champ: { slug: string; name: string; sport: string }; team: { name: string; short: string; color: string } }
export interface Award { champ: { slug: string; name: string }; label: string; player: string; team: string; handle?: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Ranking de todos os campeonatos de uma arena.
 * O mesmo atleta em edições diferentes é somado pelo perfil de atleta (quando ligado) ou pelo nome + time.
 */
export function arenaRanking(
  datas: ChampData[],
  linked: Map<string, { userId: string; handle: string }>, // playerId → perfil
  votes: Map<string, VoteResult[]>,                          // championshipId → votos
) {
  const scorers = new Map<string, Map<string, Scorer & { seen: Set<string> }>>(); // esporte → atleta
  const titles: Title[] = [];
  const awards: Award[] = [];

  for (const d of datas) {
    const teamOf = new Map(d.teams.map(t => [t.id, t]));
    const ch = champion(d.champ, d.games, d.teams);
    if (ch) titles.push({ champ: { slug: d.champ.slug, name: d.champ.name, sport: d.champ.sport }, team: { name: ch.name, short: ch.short, color: ch.color } });

    if (sportRules(d.champ.sport).scorers) {
      const label = sportLabel(d.champ.sport);
      const bucket = scorers.get(label) ?? new Map();
      scorers.set(label, bucket);
      for (const p of d.players) {
        const total = d.goals.filter(g => g.playerId === p.id).reduce((s, g) => s + g.count, 0);
        if (!total) continue;
        const team = teamOf.get(p.teamId)?.name ?? '';
        const link = linked.get(p.id);
        const key = link ? `u:${link.userId}` : `n:${norm(p.name)}|${norm(team)}`;
        const cur = bucket.get(key) ?? { key, name: p.name, team, handle: link?.handle, total: 0, championships: 0, seen: new Set<string>() };
        cur.total += total;
        if (!cur.seen.has(d.champ.id)) { cur.seen.add(d.champ.id); cur.championships++; }
        cur.team = team; // time mais recente (lista vem do mais novo para o mais antigo? mantém o último visto)
        bucket.set(key, cur);
      }
    }

    if (d.champ.voting === 'encerrada') {
      const v = votes.get(d.champ.id) ?? [];
      for (const [cat, label] of categoriesFor(d.champ.sport)) {
        const top = ranking(v, d.players, d.teams, cat)[0];
        if (top) awards.push({ champ: { slug: d.champ.slug, name: d.champ.name }, label, player: top.player.name, team: top.team?.name ?? '', handle: linked.get(top.player.id)?.handle });
      }
    }
  }

  const bySport = [...scorers].map(([sport, m]) => ({
    sport,
    unit: datas.find(d => sportLabel(d.champ.sport) === sport && sportRules(d.champ.sport).unit === 'pontos') ? 'pontos' : 'gols',
    list: [...m.values()].map(({ seen: _seen, ...s }) => s).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, 10),
  })).filter(s => s.list.length);

  // Times com mais títulos.
  const count = new Map<string, { team: Title['team']; titles: number }>();
  for (const t of titles) {
    const k = norm(t.team.name);
    const cur = count.get(k) ?? { team: t.team, titles: 0 };
    cur.titles++;
    count.set(k, cur);
  }
  const topTeams = [...count.values()].sort((a, b) => b.titles - a.titles || a.team.name.localeCompare(b.team.name)).slice(0, 10);

  return { scorers: bySport, titles, topTeams, awards };
}
