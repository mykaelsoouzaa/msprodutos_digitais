// Campeonato de demonstração: dados gerados na hora (não vêm do banco), sempre "em andamento".
// Duas rodadas jogadas, a terceira acontecendo hoje (com um jogo ao vivo), mata-mata pela frente.
import { buildPlan } from './domain/build';
import type { Card, Championship, Game, Goal, Player, Team } from './domain/types';

const TEAMS: Array<[string, string, string]> = [
  ['Real Várzea', 'RVZ', '#e11d48'], ['Unidos da Vila', 'UDV', '#2563eb'], ['Bola Cheia', 'BOL', '#16a34a'], ['Os Brabos', 'BRB', '#ea580c'],
  ['Galáticos FC', 'GAL', '#9333ea'], ['Amigos do Gol', 'ADG', '#0891b2'], ['Tsunami', 'TSU', '#ca8a04'], ['Inter de Bairro', 'INT', '#db2777'],
];
const NAMES = ['Rafinha', 'Marcão', 'Juninho', 'Diego', 'Pedrão', 'Léo', 'Tiago', 'Bruno', 'Caio', 'Dudu', 'Fábio', 'Gui', 'Henrique', 'Igor',
  'Jonas', 'Kauã', 'Lucas', 'Matheus', 'Nando', 'Otávio', 'Paulinho', 'Renan', 'Samuel', 'Thiago', 'Vini', 'Wesley', 'Xande', 'Yuri',
  'Zeca', 'André', 'Beto', 'Cadu', 'Davi', 'Edu', 'Felipe', 'Gabriel', 'Hugo', 'Ítalo', 'João', 'Kleber'];

/** Gerador pseudoaleatório com semente: o exemplo sai igual a cada visita. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shift = (day: string, delta: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

export const DEMO_SLUG = 'exemplo';

export function demoChampionship(today: string) {
  const r = rng(2026);
  const schedule = { start: shift(today, -14), times: ['09:00', '10:00'], fields: ['Campo 1', 'Campo 2'] };
  const plan = buildPlan({ format: 'grupos', teamCount: 8, schedule });
  const champ: Championship = {
    id: 'demo', slug: DEMO_SLUG, name: 'Copa Exemplo da Arena', sport: 'Futebol society', format: 'grupos', feeCents: 30000,
    location: 'Arena Central', city: 'Campinas', state: 'SP', online: false, visibility: 'link', voting: 'aberta',
    rules: { qualify: plan.qualify, tiebreak: ['v', 'sg', 'gp', 'cd'] }, schedule,
  };
  const teams: Team[] = plan.teams.map((t, i) => ({ ...t, name: TEAMS[i][0], short: TEAMS[i][1], color: TEAMS[i][2], status: 'inscrita', paid: true, captainName: NAMES[i * 5] }));
  const players: Player[] = teams.flatMap((t, i) => NAMES.slice(i * 5, i * 5 + 5).map((name, k) => ({ id: `p${i}-${k}`, teamId: t.id, name, number: String([1, 4, 7, 10, 9][k]) })));
  const games: Game[] = plan.games.map(g => ({ ...g }));
  const goals: Goal[] = [];
  const cards: Card[] = [];
  const scorers = (teamId: string) => players.filter(p => p.teamId === teamId && p.number !== '1');

  let liveSet = false;
  for (const g of games) {
    if (g.stage !== 'grupo' || !g.homeId || !g.awayId) continue;
    if (g.date < today) {
      g.homeScore = Math.floor(r() * 4); g.awayScore = Math.floor(r() * 3);
      for (const [side, n] of [[g.homeId, g.homeScore], [g.awayId, g.awayScore]] as const) {
        for (let k = 0; k < n; k++) {
          const pool = scorers(side);
          const p = pool[Math.min(pool.length - 1, Math.floor(r() * r() * pool.length * 1.6))];
          const cur = goals.find(x => x.gameId === g.id && x.playerId === p.id);
          if (cur) cur.count++; else goals.push({ gameId: g.id, playerId: p.id, teamId: side, count: 1 });
        }
      }
      if (r() < 0.6) {
        const pool = players.filter(p => p.teamId === (r() < 0.5 ? g.homeId : g.awayId));
        const p = pool[Math.floor(r() * pool.length)];
        cards.push({ gameId: g.id, playerId: p.id, teamId: p.teamId, yellow: 1, red: false });
      }
    } else if (g.date === today && !liveSet) {
      g.live = { home: 1, away: 1, since: new Date(Date.now() - 25 * 60_000).toISOString() };
      liveSet = true;
    }
  }
  const votes = [
    { category: 'craque', player_id: 'p0-3', total: 41 }, { category: 'craque', player_id: 'p2-4', total: 33 }, { category: 'craque', player_id: 'p4-3', total: 12 },
    { category: 'goleiro', player_id: 'p1-0', total: 28 }, { category: 'goleiro', player_id: 'p3-0', total: 19 },
    { category: 'revelacao', player_id: 'p6-2', total: 22 }, { category: 'revelacao', player_id: 'p5-3', total: 17 },
  ];
  const sponsors = [
    { id: 's1', name: 'Padaria Pão Bom', url: '', logo_url: '', tier: 'master' as const },
    { id: 's2', name: 'Auto Peças Silva', url: '', logo_url: '', tier: 'apoio' as const },
    { id: 's3', name: 'Açaí do Zé', url: '', logo_url: '', tier: 'apoio' as const },
  ];
  return { champ, teams, players, games, goals, cards, votes, sponsors };
}
