import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySchedule, buildPlan, gamesFor, qualifyOptions, roundRobin, shuffled, teamCountError } from './build';
import { champion, isDecided, resolveKnockout, scoreError, standings, tables, topScorers, winnerId } from './standings';
import type { Championship, Game, Goal, Player, Team } from './types';

const schedule = { start: '2026-10-31', times: ['09:00', '10:00'], fields: ['Campo 1', 'Campo 2'] };
const champ = (over: Partial<Championship> = {}): Championship => ({
  id: 'c1', slug: 'copa', name: 'Copa', sport: 'Futebol society', format: 'pontos', feeCents: 0, location: '', city: '', state: '', online: false,
  visibility: 'link', rules: { qualify: 2, tiebreak: ['v', 'sg', 'gp', 'cd'] }, schedule, ...over,
});
const play = (g: Game, h: number, a: number, ph: number | null = null, pa: number | null = null) => {
  g.homeScore = h; g.awayScore = a; g.penHome = ph; g.penAway = pa;
};

test('validação do número de times por formato', () => {
  assert.equal(teamCountError('pontos', 2), 'Pontos corridos: de 3 a 16 times');
  assert.equal(teamCountError('pontos', 5), null);
  assert.equal(teamCountError('grupos', 5), 'Grupos + mata-mata: de 6 a 16 times');
  assert.equal(teamCountError('mata', 6), 'Mata-mata: 4, 8 ou 16 times');
  assert.equal(teamCountError('mata', 8), null);
});

test('todos contra todos: cada par joga uma vez, ninguém joga duas vezes na rodada', () => {
  for (const n of [3, 4, 5, 6, 7, 8, 16]) {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`);
    const rounds = roundRobin(ids);
    const pairs = new Set<string>();
    rounds.forEach(r => {
      const seen = new Set<string>();
      r.forEach(([a, b]) => {
        assert.ok(!seen.has(a) && !seen.has(b), `time repetido na rodada (n=${n})`);
        seen.add(a); seen.add(b);
        const key = [a, b].sort().join('-');
        assert.ok(!pairs.has(key), `confronto repetido (n=${n})`);
        pairs.add(key);
      });
    });
    assert.equal(pairs.size, (n * (n - 1)) / 2);
  }
});

test('pontos corridos: jogos, agenda semanal e campos', () => {
  const plan = buildPlan({ format: 'pontos', teamCount: 4, schedule });
  assert.equal(plan.teams.length, 4);
  assert.equal(plan.games.length, 6);
  const r1 = plan.games.filter(g => g.seq === 1);
  assert.deepEqual(r1.map(g => [g.date, g.time, g.field]), [['2026-10-31', '09:00', 'Campo 1'], ['2026-10-31', '09:00', 'Campo 2']]);
  assert.equal(plan.games.find(g => g.seq === 3)!.date, '2026-11-14');
  assert.ok(plan.teams.every(t => t.status === 'aberta' && !t.paid));
});

test('grupos + mata-mata com 8 times: 2 grupos, semis e final', () => {
  const plan = buildPlan({ format: 'grupos', teamCount: 8, schedule });
  assert.deepEqual([...new Set(plan.teams.map(t => t.group))].sort(), ['A', 'B']);
  assert.equal(plan.games.filter(g => g.stage === 'grupo').length, 12);
  const ko = plan.games.filter(g => g.stage === 'ko');
  assert.deepEqual(ko.map(g => g.name), ['Semi 1', 'Semi 2', 'Final']);
  assert.deepEqual(qualifyOptions(plan.teams), [1, 2, 4]);
});

test('grupos com 12 times usa 4 grupos e quartas', () => {
  const plan = buildPlan({ format: 'grupos', teamCount: 12, schedule });
  assert.equal(new Set(plan.teams.map(t => t.group)).size, 4);
  assert.deepEqual(plan.games.filter(g => g.stage === 'ko').map(g => g.label), ['Quartas', 'Quartas', 'Quartas', 'Quartas', 'Semifinal', 'Semifinal', 'Final']);
});

test('mata-mata com 16 times: oitavas até a final', () => {
  const plan = buildPlan({ format: 'mata', teamCount: 16, schedule });
  assert.equal(plan.games.length, 15);
  assert.deepEqual([...new Set(plan.games.map(g => g.label))], ['Oitavas', 'Quartas', 'Semifinal', 'Final']);
});

test('classificação: pontos, desempate por vitórias e saldo', () => {
  const c = champ();
  const plan = buildPlan({ format: 'pontos', teamCount: 3, schedule });
  const [a, b, d] = plan.teams;
  const g = (h: Team, x: Team) => plan.games.find(m => (m.homeId === h.id && m.awayId === x.id) || (m.homeId === x.id && m.awayId === h.id))!;
  const set = (h: Team, x: Team, hs: number, xs: number) => { const m = g(h, x); m.homeId === h.id ? play(m, hs, xs) : play(m, xs, hs); };
  set(a, b, 3, 0);
  set(b, d, 1, 1);
  set(a, d, 0, 1);
  const rows = standings(c, plan.games, plan.teams);
  // a: 3 pts (1V, saldo +2) · d: 4 pts · b: 1 pt
  assert.deepEqual(rows.map(r => [r.team.id, r.P]), [[d.id, 4], [a.id, 3], [b.id, 1]]);
  assert.equal(rows[1].GP - rows[1].GC, 2);
  assert.equal(champion(c, plan.games, plan.teams)?.id, d.id);
});

test('basquete: vitória vale 2, derrota 1 e não aceita empate', () => {
  const c = champ({ sport: 'Basquete' });
  const plan = buildPlan({ format: 'pontos', teamCount: 3, schedule });
  const m = plan.games[0];
  assert.equal(scoreError(c, m, 50, 50, null, null), 'Basquete não tem empate');
  play(m, 60, 52);
  const rows = standings(c, plan.games, plan.teams);
  assert.equal(rows.find(r => r.team.id === m.homeId)!.P, 2);
  assert.equal(rows.find(r => r.team.id === m.awayId)!.P, 1);
});

test('grupos: mata-mata só se preenche quando o grupo acaba, e pênaltis decidem', () => {
  const c = champ({ format: 'grupos' });
  const plan = buildPlan({ format: 'grupos', teamCount: 6, schedule });
  const groupGames = plan.games.filter(g => g.stage === 'grupo');
  // mandante sempre vence, exceto um jogo por grupo
  groupGames.forEach((g, i) => play(g, i % 4 === 0 ? 0 : 2, i % 4 === 0 ? 1 : 0));
  groupGames[groupGames.length - 1].homeScore = null; // grupo ainda não acabou
  resolveKnockout(c, plan.games, plan.teams);
  const semis = plan.games.filter(g => g.label === 'Semifinal');
  const incompleteGroup = groupGames[groupGames.length - 1].group;
  assert.ok(semis.some(s => (s.srcHome as { g: string }).g === incompleteGroup && s.homeId === null));

  play(groupGames[groupGames.length - 1], 1, 0);
  resolveKnockout(c, plan.games, plan.teams);
  assert.ok(semis.every(s => s.homeId && s.awayId), 'semis definidas');

  const [s1, s2] = semis;
  assert.ok(scoreError(c, s1, 1, 1, null, null));
  play(s1, 1, 1, 4, 3);
  play(s2, 0, 2);
  assert.ok(isDecided(s1));
  resolveKnockout(c, plan.games, plan.teams);
  const final = plan.games.find(g => g.label === 'Final')!;
  assert.equal(final.homeId, s1.homeId);
  assert.equal(final.awayId, s2.awayId);
  play(final, 2, 1);
  assert.equal(champion(c, plan.games, plan.teams)?.id, final.homeId);

  // mudar uma semi apaga o placar da final, que perdeu um dos times
  play(s2, 3, 0);
  const changed = resolveKnockout(c, plan.games, plan.teams);
  assert.ok(changed.includes(final.id));
  assert.equal(final.homeScore, null);
  assert.equal(winnerId(final), null);
});

test('artilharia só conta jogos com resultado', () => {
  const plan = buildPlan({ format: 'pontos', teamCount: 3, schedule });
  const [t1, t2] = plan.teams;
  const players: Player[] = [{ id: 'p1', teamId: t1.id, name: 'Lucas', number: '10' }, { id: 'p2', teamId: t2.id, name: 'Bruno', number: '9' }];
  const [g1, g2] = plan.games;
  play(g1, 2, 1);
  const goals: Goal[] = [
    { gameId: g1.id, playerId: 'p1', teamId: t1.id, count: 2 },
    { gameId: g1.id, playerId: 'p2', teamId: t2.id, count: 1 },
    { gameId: g2.id, playerId: 'p2', teamId: t2.id, count: 5 },
  ];
  const top = topScorers(plan.games, goals, players, plan.teams);
  assert.deepEqual(top.map(r => [r.player.name, r.total]), [['Lucas', 2], ['Bruno', 1]]);
});

test('reagendar mantém jogos já realizados', () => {
  const plan = buildPlan({ format: 'pontos', teamCount: 4, schedule });
  play(plan.games[0], 1, 0);
  const keepDate = plan.games[0].date;
  applySchedule(plan.games, { ...schedule, start: '2026-12-05' }, g => isDecided(g));
  assert.equal(plan.games[0].date, keepDate);
  assert.equal(plan.games[1].date, '2026-12-05');
});

test('tabelas por grupo carregam o número de classificados', () => {
  const c = champ({ format: 'grupos', rules: { qualify: 1, tiebreak: ['v'] } });
  const plan = buildPlan({ format: 'grupos', teamCount: 8, schedule, qualify: 1 });
  const ts = tables(c, plan.games, plan.teams);
  assert.deepEqual(ts.map(t => [t.title, t.rows.length, t.qualify]), [['Grupo A', 4, 1], ['Grupo B', 4, 1]]);
  assert.equal(plan.games.filter(g => g.stage === 'ko').length, 1);
});

test('sorteio: novos grupos e jogos com os mesmos times', () => {
  const { teams } = buildPlan({ format: 'grupos', teamCount: 8, schedule });
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const order = shuffled(teams, rng);
  assert.deepEqual([...order].map(t => t.id).sort(), teams.map(t => t.id).sort(), 'mesmos times');
  assert.notDeepEqual(order.map(t => t.id), teams.map(t => t.id), 'ordem mudou');
  const { games } = gamesFor('grupos', order, schedule);
  const ga = teams.filter(t => t.group === 'A').map(t => t.id);
  assert.equal(ga.length, 4);
  assert.deepEqual(ga.sort(), [order[0], order[2], order[4], order[6]].map(t => t.id).sort());
  // cada time joga 3 vezes na fase de grupos, só contra o próprio grupo
  for (const t of teams) {
    const mine = games.filter(g => g.stage === 'grupo' && (g.homeId === t.id || g.awayId === t.id));
    assert.equal(mine.length, 3);
    assert.ok(mine.every(g => g.group === t.group));
  }
});

test('sorteio do mata-mata: confrontos do primeiro com o último da ordem sorteada', () => {
  const { teams } = buildPlan({ format: 'mata', teamCount: 4, schedule });
  const order = [teams[2], teams[0], teams[3], teams[1]];
  const { games } = gamesFor('mata', order, schedule);
  const first = games.filter(g => g.label === 'Semifinal');
  assert.deepEqual(first.map(g => [(g.srcHome as { id: string }).id, (g.srcAway as { id: string }).id]),
    [[teams[2].id, teams[1].id], [teams[0].id, teams[3].id]]);
});
