import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campiaFeePercent, organizerPercent, walletFromResponse } from './payout';

test('taxa da Campia e parte do organizador', () => {
  assert.equal(campiaFeePercent(undefined), 10);
  assert.equal(campiaFeePercent(''), 10);
  assert.equal(campiaFeePercent('7,5'), 7.5);
  assert.equal(campiaFeePercent('150'), 100);
  assert.equal(campiaFeePercent('-3'), 0);
  assert.equal(organizerPercent(10), 90);
  assert.equal(organizerPercent(7.5), 92.5);
  assert.equal(organizerPercent(0), 100);
});

test('walletId vindo da Asaas', () => {
  const id = '0e1f2a3b-4c5d-6e7f-8091-a2b3c4d5e6f7';
  assert.equal(walletFromResponse({ object: 'list', data: [{ id }] }), id);
  assert.equal(walletFromResponse({ walletId: id }), id);
  assert.equal(walletFromResponse({ data: [] }), null);
  assert.equal(walletFromResponse({ id: 'cus_123' }), null);
});
