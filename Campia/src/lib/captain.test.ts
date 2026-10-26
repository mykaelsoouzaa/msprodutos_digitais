import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamSummary } from './captain';
import { buildPlan } from './domain/build';
import type { Championship } from './domain/types';

const champ: Championship = {
  id: 'c', slug: 'c', name: 'C', sport: 'Futebol society', format: 'pontos', feeCents: 0, location: '', city: '', state: '', online: false,
  visibility: 'link', rules: { qualify: 2, tiebreak: ['v', 'sg', 'gp', 'cd'] }, schedule: { start: '2026-11-07', times: ['09:00'], fields: ['A'] },
};

test('resumo do time do capitão', () => {
  const { teams, games } = buildPlan({ format: 'pontos', teamCount: 4, schedule: champ.schedule });
  const me = teams[0].id;
  const mine = games.filter(g => g.homeId === me || g.awayId === me);
  // ganha o primeiro jogo
  const g1 = mine[0];
  [g1.homeScore, g1.awayScore] = g1.homeId === me ? [2, 0] : [0, 2];
  const s = teamSummary(champ, games, teams, me);
  assert.equal(s.played, 1);
  assert.equal(s.wins, 1);
  assert.equal(s.lastOutcome, 'V');
  assert.equal(s.position, 1);
  assert.equal(s.tableSize, 4);
  assert.equal(s.next.length, 2);
  assert.ok(!s.next.includes(g1));
  assert.equal(s.eliminated, false);
});

test('empate em pontos corridos não vira derrota', () => {
  const { teams, games } = buildPlan({ format: 'pontos', teamCount: 4, schedule: champ.schedule });
  const me = teams[0].id;
  const g = games.find(x => x.homeId === me || x.awayId === me)!;
  g.homeScore = 1; g.awayScore = 1;
  const s = teamSummary(champ, games, teams, me);
  assert.equal(s.lastOutcome, 'E');
  assert.equal(s.wins, 0);
});
