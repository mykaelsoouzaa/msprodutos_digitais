import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriesFor, ranking } from './voting';

test('categorias por esporte', () => {
  assert.deepEqual(categoriesFor('Futebol society').map(c => c[0]), ['craque', 'goleiro', 'revelacao']);
  assert.deepEqual(categoriesFor('Basquete').map(c => c[0]), ['craque', 'revelacao']);
  assert.deepEqual(categoriesFor('Futevôlei').map(c => c[0]), ['craque', 'revelacao']);
  assert.deepEqual(categoriesFor('Handebol').map(c => c[0]), ['craque', 'goleiro', 'revelacao']);
});

test('ranking da votação', () => {
  const players = [{ id: 'a', teamId: 't', name: 'Ana', number: '' }, { id: 'b', teamId: 't', name: 'Bia', number: '' }, { id: 'c', teamId: 't', name: 'Cris', number: '' }];
  const teams = [{ id: 't', slot: 1, name: 'Time', short: 'TIM', color: '#000', group: null, status: 'inscrita' as const, paid: true, captainName: '', captainPhone: '' }];
  const r = ranking([
    { category: 'craque', player_id: 'b', total: 5 }, { category: 'craque', player_id: 'a', total: 9 },
    { category: 'craque', player_id: 'c', total: 5 }, { category: 'goleiro', player_id: 'a', total: 1 },
    { category: 'craque', player_id: 'x', total: 50 },
  ], players, teams, 'craque');
  assert.deepEqual(r.map(x => [x.player.name, x.total]), [['Ana', 9], ['Bia', 5], ['Cris', 5]]);
});
