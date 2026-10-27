import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editionInviteEmail, nextEditionName } from './edition';

test('nome da próxima edição', () => {
  assert.equal(nextEditionName('Copa Verão 2026'), 'Copa Verão 2027');
  assert.equal(nextEditionName('Copa da Arena 3ª edição'), 'Copa da Arena 4ª edição');
  assert.equal(nextEditionName('Copa 2a Edição'), 'Copa 3ª edição');
  assert.equal(nextEditionName('Copa da Arena'), 'Copa da Arena · 2ª edição');
});

test('convite escapa nomes', () => {
  const e = editionInviteEmail({ team: '<b>X</b>', previous: 'A', championship: 'B', feeCents: 30000, start: '2027-01-09', url: 'https://x', organizer: 'Arena' });
  assert.ok(!e.html.includes('<b>X</b>'));
  assert.ok(e.html.includes('09/01/2027'));
  assert.ok(e.html.includes('R$'));
});
