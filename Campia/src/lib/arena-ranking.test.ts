import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arenaRanking } from './arena-ranking';
import { buildPlan } from './domain/build';
import type { Championship } from './domain/types';
import type { ChampData } from './data';

function edition(id: string, names: string[], goals: Array<[number, number]>, winner: number): ChampData {
  const champ: Championship = {
    id, slug: id, name: `Copa ${id}`, sport: 'Futsal', format: 'mata', feeCents: 0, location: '', city: '', state: '', online: false,
    visibility: 'publico', voting: 'fechada', rules: { qualify: 1, tiebreak: ['v', 'sg', 'gp', 'cd'] }, schedule: { start: '2026-11-07', times: ['09:00'], fields: ['A'] },
  };
  const { teams, games } = buildPlan({ format: 'mata', teamCount: 4, schedule: champ.schedule });
  teams.forEach((t, i) => { t.name = names[i]; t.status = 'inscrita'; });
  const [s1, s2, f] = games;
  [s1.homeId, s1.awayId, s1.homeScore, s1.awayScore] = [teams[0].id, teams[1].id, winner === 0 ? 1 : 0, winner === 0 ? 0 : 1];
  [s2.homeId, s2.awayId, s2.homeScore, s2.awayScore] = [teams[2].id, teams[3].id, 1, 0];
  const w = winner === 0 ? teams[0] : teams[1];
  [f.homeId, f.awayId, f.homeScore, f.awayScore] = [w.id, teams[2].id, 2, 0];
  const players = [
    { id: `${id}-a`, teamId: teams[0].id, name: 'Rafinha', number: '10' },
    { id: `${id}-b`, teamId: teams[2].id, name: 'Marcão', number: '5' },
  ];
  return {
    row: {} as ChampData['row'], champ, teams, players, games, cards: [],
    goals: goals.map(([pi, n]) => ({ gameId: f.id, playerId: players[pi].id, teamId: players[pi].teamId, count: n })),
  } as ChampData;
}

test('ranking da arena soma edições pelo nome + time e conta títulos', () => {
  const d1 = edition('e1', ['Real Várzea', 'Unidos', 'Bola Cheia', 'Tsunami'], [[0, 3], [1, 1]], 0);
  const d2 = edition('e2', ['Real  Várzea', 'Unidos', 'Bola Cheia', 'Tsunami'], [[0, 2], [1, 4]], 0);
  const r = arenaRanking([d1, d2], new Map(), new Map());
  const futsal = r.scorers.find(s => s.sport === 'Futsal')!;
  assert.deepEqual(futsal.list.map(s => [s.name, s.total, s.championships]), [['Marcão', 5, 2], ['Rafinha', 5, 2]]);
  assert.equal(r.titles.length, 2);
  assert.deepEqual(r.topTeams.map(t => [t.team.name, t.titles]), [['Real Várzea', 2]]);
});

test('perfil de atleta junta o mesmo atleta mesmo trocando de time', () => {
  const d1 = edition('e1', ['Real Várzea', 'Unidos', 'Bola Cheia', 'Tsunami'], [[0, 3]], 0);
  const d2 = edition('e2', ['Outro Time', 'Unidos', 'Bola Cheia', 'Tsunami'], [[0, 2]], 1);
  const linked = new Map([['e1-a', { userId: 'u', handle: 'rafinha' }], ['e2-a', { userId: 'u', handle: 'rafinha' }]]);
  const r = arenaRanking([d1, d2], linked, new Map());
  const top = r.scorers[0].list[0];
  assert.deepEqual([top.total, top.handle, top.championships], [5, 'rafinha', 2]);
});
