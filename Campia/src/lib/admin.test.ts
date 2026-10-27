import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, splitGross } from './admin';

test('quem é dono da plataforma', () => {
  assert.ok(isAdmin('Mykael@Campia.app.br', 'mykael@campia.app.br, outro@x.com'));
  assert.ok(isAdmin('outro@x.com', 'mykael@campia.app.br, outro@x.com'));
  assert.ok(!isAdmin('estranho@x.com', 'mykael@campia.app.br'));
  assert.ok(!isAdmin('x@x.com', ''));
  assert.ok(!isAdmin(null, 'x@x.com'));
});

test('divisão estimada entre organizador e Campia', () => {
  assert.deepEqual(splitGross(30000, 10), { campia: 3000, organizer: 27000 });
  assert.deepEqual(splitGross(10000, 0), { campia: 0, organizer: 10000 });
});
