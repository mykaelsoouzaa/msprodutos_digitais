import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCode, displayName, initialsOf, needsMfaStep } from './account';

test('nome e iniciais', () => {
  assert.equal(displayName('  Mykael Souza ', 'x@y.com'), 'Mykael Souza');
  assert.equal(displayName('', 'mykael.souzaa@gmail.com'), 'mykael.souzaa');
  assert.equal(displayName(undefined, null), 'Minha conta');
  assert.equal(initialsOf('Mykael Souza'), 'MS');
  assert.equal(initialsOf('mykael.souzaa'), 'MS');
  assert.equal(initialsOf('Rafa'), 'R');
});

test('quando pedir o código do app', () => {
  const pend = { currentLevel: 'aal1', nextLevel: 'aal2' };
  assert.ok(needsMfaStep('/painel', pend));
  assert.ok(needsMfaStep('/admin', pend));
  assert.ok(needsMfaStep('/atleta', pend));
  assert.ok(!needsMfaStep('/atleta/rafinha', pend));
  assert.ok(!needsMfaStep('/c/copa', pend));
  assert.ok(!needsMfaStep('/painel', { currentLevel: 'aal2', nextLevel: 'aal2' }));
  assert.ok(!needsMfaStep('/painel', { currentLevel: 'aal1', nextLevel: 'aal1' }));
  assert.equal(cleanCode(' 123 456 '), '123456');
});
