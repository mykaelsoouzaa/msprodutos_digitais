import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoChampionship } from './demo-data';
import { isDecided, tables } from './domain/standings';

test('exemplo: duas rodadas jogadas, um jogo ao vivo hoje, gols batendo com o placar', () => {
  const d = demoChampionship('2026-10-31');
  assert.equal(d.games.filter(isDecided).length, 8);
  assert.equal(d.games.filter(g => g.live).length, 1);
  for (const g of d.games.filter(isDecided)) {
    const sum = (team: string) => d.goals.filter(x => x.gameId === g.id && x.teamId === team).reduce((s, x) => s + x.count, 0);
    assert.equal(sum(g.homeId!), g.homeScore);
    assert.equal(sum(g.awayId!), g.awayScore);
  }
  assert.equal(tables(d.champ, d.games, d.teams).length, 2);
  // sempre igual (semente fixa)
  const again = demoChampionship('2026-10-31');
  assert.deepEqual(again.games.map(g => [g.homeScore, g.awayScore]), d.games.map(g => [g.homeScore, g.awayScore]));
});
