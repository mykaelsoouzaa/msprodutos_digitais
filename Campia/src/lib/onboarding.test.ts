import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onboardingSteps, progress } from './onboarding';

test('primeiros passos', () => {
  const zero = progress(onboardingSteps({ hasArena: false, hasPayout: false, championships: 0, signedTeams: 0, results: 0 }));
  assert.deepEqual([zero.done, zero.total, zero.complete, zero.next?.key], [0, 5, false, 'campeonato']);
  const steps = onboardingSteps({ hasArena: true, hasPayout: false, championships: 1, signedTeams: 3, results: 0, firstChampionshipId: 'c1' });
  const p = progress(steps);
  assert.deepEqual([p.done, p.next?.key], [3, 'recebimento']);
  assert.equal(steps.find(s => s.key === 'resultado')!.href, '/painel/c1?aba=jogos');
  assert.ok(progress(onboardingSteps({ hasArena: true, hasPayout: true, championships: 2, signedTeams: 1, results: 1 })).complete);
});
