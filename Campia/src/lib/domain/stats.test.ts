import { test } from 'node:test';
import assert from 'node:assert/strict';
import { champStats, headToHead, outcome, recentForm } from './stats';
import type { Game, Team } from './types';

const T = (id: string): Team => ({ id, name: id.toUpperCase(), short: id.toUpperCase(), color: '#000' } as Team);
let seq = 0;
const G = (h: string, a: string, hs: number | null, as: number | null, extra: Partial<Game> = {}): Game => ({
  id: `g${++seq}`, stage: 'grupo', group: 'A', seq, sort: seq, label: `R${seq}`, name: '', homeId: h, awayId: a, srcHome: null, srcAway: null,
  homeScore: hs, awayScore: as, penHome: null, penAway: null, wo: null, date: '', time: '', field: '', live: null, ...extra,
} as Game);

const teams = ['a', 'b', 'c'].map(T);
const games = [G('a', 'b', 3, 0), G('b', 'c', 1, 1), G('c', 'a', 0, 2), G('a', 'b', 1, 1), G('b', 'c', null, null), G('c', 'b', 0, 3, { wo: 'home' })];

test('forma: V/E/D na ordem dos jogos, W.O. conta', () => {
  assert.deepEqual(recentForm(games, 'a'), ['V', 'V', 'E']);
  assert.deepEqual(recentForm(games, 'c'), ['E', 'D', 'D']);
  assert.deepEqual(recentForm(games, 'b', 2), ['E', 'V']);
  assert.equal(outcome(games[4], 'b'), null);
});

test('números: média sem W.O., ataque, defesa, goleada', () => {
  const s = champStats(games, teams, [
    { gameId: 'x', playerId: 'p', teamId: 'a', yellow: 2, red: false },
    { gameId: 'x', playerId: 'q', teamId: 'c', yellow: 0, red: true },
  ]);
  assert.equal(s.games, 4);
  assert.equal(s.total, 9);
  assert.equal(s.average, 2.25);
  assert.equal(s.attack?.team.id, 'a'); assert.equal(s.attack?.value, 6);
  assert.equal(s.defense?.team.id, 'a'); assert.equal(s.defense?.value, 1);
  assert.equal(s.biggest?.id, games[0].id);
  assert.deepEqual(s.fairPlay.map(f => [f.team.id, f.points]), [['b', 0], ['a', 2], ['c', 3]]);
});

test('confronto direto: mais recente primeiro, sem o jogo atual', () => {
  assert.deepEqual(headToHead(games, 'b', 'a').map(g => g.id), [games[3].id, games[0].id]);
  assert.deepEqual(headToHead(games, 'a', 'b', games[3].id).map(g => g.id), [games[0].id]);
});
