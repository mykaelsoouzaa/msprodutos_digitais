import { test } from 'node:test';
import assert from 'node:assert/strict';
import { athleteTotals, entryFor, handleFrom } from './athlete';
import { buildPlan } from './domain/build';
import type { Championship } from './domain/types';
import type { ChampData } from './data';

test('endereço do perfil', () => {
  assert.equal(handleFrom('Rafael Souza'), 'rafael-souza');
  assert.equal(handleFrom('Zé', '4f2a'), 'ze-4f2a');
  assert.equal(handleFrom('Zé'), 'ze-atleta');
  assert.equal(handleFrom('!!!'), 'atleta');
});

test('linha do perfil: gols, cartões, título e prêmio', () => {
  const champ: Championship = {
    id: 'c', slug: 'copa', name: 'Copa', sport: 'Futsal', format: 'mata', feeCents: 0, location: '', city: '', state: '', online: false,
    visibility: 'publico', voting: 'encerrada', rules: { qualify: 1, tiebreak: ['v', 'sg', 'gp', 'cd'] }, schedule: { start: '2026-11-07', times: ['09:00'], fields: ['A'] },
  };
  const { teams, games } = buildPlan({ format: 'mata', teamCount: 4, schedule: champ.schedule });
  const me = teams[0];
  const players = [{ id: 'p1', teamId: me.id, name: 'Rafinha', number: '10' }, { id: 'p2', teamId: teams[1].id, name: 'Outro', number: '' }];
  // time do atleta vence a semi e a final
  const [semi, other, final] = games;
  [semi.homeId, semi.awayId, semi.homeScore, semi.awayScore] = [me.id, teams[1].id, 3, 1];
  [other.homeId, other.awayId, other.homeScore, other.awayScore] = [teams[2].id, teams[3].id, 2, 0];
  [final.homeId, final.awayId, final.homeScore, final.awayScore] = [me.id, teams[2].id, 1, 0];
  const d = {
    row: {} as ChampData['row'], champ, teams, players, games,
    goals: [{ gameId: semi.id, playerId: 'p1', teamId: me.id, count: 2 }, { gameId: final.id, playerId: 'p1', teamId: me.id, count: 1 }],
    cards: [{ gameId: semi.id, playerId: 'p1', teamId: me.id, yellow: 1, red: false }],
  } as ChampData;
  const e = entryFor(d, 'p1', [{ category: 'craque', player_id: 'p1', total: 5 }, { category: 'craque', player_id: 'p2', total: 1 }])!;
  assert.equal(e.goals, 3);
  assert.equal(e.yellow, 1);
  assert.equal(e.games, 2);
  assert.equal(e.champion, true);
  assert.deepEqual(e.awards, ['Craque do campeonato']);
  assert.equal(entryFor(d, 'x', []), null);
  const t = athleteTotals([e, { ...e, champion: false, awards: [], goals: 1 }]);
  assert.deepEqual([t.championships, t.goals, t.titles, t.awards], [2, 4, 1, 1]);
});
