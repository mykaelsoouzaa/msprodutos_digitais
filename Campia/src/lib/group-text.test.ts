import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextGamesText, resultsText, standingsText } from './group-text';
import type { Championship, Game, Team } from './domain/types';

const T = (id: string): Team => ({ id, name: id.toUpperCase(), short: id, color: '#000', status: 'inscrita', slot: 0, group: null } as unknown as Team);
let seq = 0;
const G = (h: string, a: string, hs: number | null, as: number | null, label: string, date = '', time = ''): Game => ({
  id: `g${++seq}`, stage: 'grupo', group: null, seq, sort: seq, label, name: '', homeId: h, awayId: a, srcHome: null, srcAway: null,
  homeScore: hs, awayScore: as, penHome: null, penAway: null, wo: null, date, time, field: 'Campo 1', live: null,
} as Game);
const champ = { name: 'Copa', format: 'pontos', sport: 'Futebol society', rules: { qualify: 2 } } as unknown as Championship;
const teams = ['a', 'b', 'c', 'd'].map(T);
const games = [G('a', 'b', 2, 1, 'Rodada 1'), G('c', 'd', 0, 0, 'Rodada 1'), G('a', 'c', null, null, 'Rodada 2', '2026-11-07', '10:00'), G('b', 'd', null, null, 'Rodada 2', '2026-11-07', '09:00')];

test('resultados da última rodada com placar', () => {
  const t = resultsText(champ, games, teams, 'https://x');
  assert.match(t, /Resultados · Rodada 1/);
  assert.match(t, /A \*2 × 1\* B/);
  assert.match(t, /C \*0 × 0\* D/);
});

test('próximos jogos por dia, em ordem de horário', () => {
  const t = nextGamesText(champ, games, teams, 'https://x', '2026-11-01');
  assert.ok(t.indexOf('09:00') < t.indexOf('10:00'));
  assert.match(t, /09:00 · Campo 1 · B x D/);
  assert.equal(nextGamesText(champ, games, teams, 'https://x', '2026-12-01'), '');
});

test('classificação com medalhas', () => {
  const t = standingsText(champ, games, teams, 'https://x');
  assert.match(t, /🥇 A · 3 pts/);
});
