import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from './build';
import { discipline } from './discipline';
import { ordered, standings, winnerId } from './standings';
import type { Card, Championship, Game, Player } from './types';

const schedule = { start: '2026-11-07', times: ['09:00'], fields: ['A'] };
const champ: Championship = {
  id: 'c', slug: 'c', name: 'C', sport: 'Futebol society', format: 'pontos', feeCents: 0, location: '', city: '', state: '', online: false,
  visibility: 'link', rules: { qualify: 2, tiebreak: ['v', 'sg', 'gp', 'cd'] }, schedule,
};

function setup() {
  const { teams, games } = buildPlan({ format: 'pontos', teamCount: 4, schedule });
  const t = teams[0];
  const mine = ordered(games).filter(g => g.homeId === t.id || g.awayId === t.id);
  const p: Player = { id: 'p1', teamId: t.id, name: 'Zé', number: '10' };
  return { teams, games, t, mine, p };
}
const play = (g: Game) => { g.homeScore = 1; g.awayScore = 0; };
const card = (g: Game, p: Player, yellow: number, red = false): Card => ({ gameId: g.id, playerId: p.id, teamId: p.teamId, yellow, red });

test('vermelho suspende o próximo jogo do time', () => {
  const { teams, games, mine, p } = setup();
  play(mine[0]);
  const d = discipline(games, [card(mine[0], p, 0, true)], [p], teams);
  assert.ok(d.suspended.get(mine[1].id)?.has('p1'));
  assert.ok(!d.suspended.get(mine[2].id)?.has('p1'));
  assert.equal(d.rows[0].red, 1);
  assert.equal(d.rows[0].suspendedIn?.id, mine[1].id);
});

test('dois amarelos no mesmo jogo = suspensão; amarelos acumulados no limite também', () => {
  const { teams, games, mine, p } = setup();
  play(mine[0]);
  assert.ok(discipline(games, [card(mine[0], p, 2)], [p], teams).suspended.get(mine[1].id)?.has('p1'));

  play(mine[1]);
  const two = discipline(games, [card(mine[0], p, 1), card(mine[1], p, 1)], [p], teams, 2);
  assert.ok(two.suspended.get(mine[2].id)?.has('p1'));
  const three = discipline(games, [card(mine[0], p, 1), card(mine[1], p, 1)], [p], teams, 3);
  assert.ok(!three.suspended.get(mine[2].id));
});

test('W.O. dá vitória com placar padrão e duplo W.O. não pontua', () => {
  const { teams, games, t, mine } = setup();
  const g = mine[0];
  g.wo = g.homeId === t.id ? 'away' : 'home'; // o adversário faltou
  assert.equal(winnerId(g), t.id);
  const row = standings(champ, games, teams).find(r => r.team.id === t.id)!;
  assert.deepEqual([row.P, row.V, row.GP, row.GC], [3, 1, 3, 0]);
  const other = standings(champ, games, teams).find(r => r.team.id === (g.homeId === t.id ? g.awayId : g.homeId))!;
  assert.deepEqual([other.P, other.D, other.GC], [0, 1, 3]);

  g.wo = 'both';
  const both = standings(champ, games, teams).filter(r => r.team.id === g.homeId || r.team.id === g.awayId);
  assert.ok(both.every(r => r.P === 0 && r.D === 1 && r.J === 1));
});
