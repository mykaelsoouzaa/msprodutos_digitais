import { test } from 'node:test';
import assert from 'node:assert/strict';
import { champStatus, likeTerm, sortForListing } from './explore';

test('situação do campeonato', () => {
  assert.equal(champStatus({ open: 3, played: 0, total: 6 }), 'abertas');
  assert.equal(champStatus({ open: 0, played: 0, total: 6 }), 'embreve');
  assert.equal(champStatus({ open: 0, played: 2, total: 6 }), 'andamento');
  assert.equal(champStatus({ open: 1, played: 2, total: 6 }), 'andamento');
  assert.equal(champStatus({ open: 0, played: 6, total: 6 }), 'encerrado');
});

test('ordem da listagem', () => {
  const r = sortForListing([
    { id: 'a', status: 'encerrado' as const, start: '2026-01-01' },
    { id: 'b', status: 'encerrado' as const, start: '2026-05-01' },
    { id: 'c', status: 'andamento' as const, start: '2026-10-01' },
    { id: 'd', status: 'abertas' as const, start: '2026-12-01' },
    { id: 'e', status: 'abertas' as const, start: '2026-11-01' },
  ]).map(x => x.id);
  assert.deepEqual(r, ['e', 'd', 'c', 'b', 'a']);
});

test('busca não quebra o filtro', () => {
  assert.equal(likeTerm(' São Paulo '), '%São Paulo%');
  assert.equal(likeTerm('a,b(c)%_'), '%a b c   %');
});
