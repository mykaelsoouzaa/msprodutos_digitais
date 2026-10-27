import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brDateTime, csvCell, money, toCsv } from './csv';

test('células da planilha', () => {
  assert.equal(csvCell('Bola Cheia'), 'Bola Cheia');
  assert.equal(csvCell('A; B'), '"A; B"');
  assert.equal(csvCell('diz "oi"'), '"diz ""oi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell(-5), '-5');
  assert.equal(csvCell(true), 'sim');
  assert.equal(csvCell(null), '');
});

test('planilha completa', () => {
  const csv = toCsv(['Time', 'Valor'], [['Bola', money(30000)]]);
  assert.ok(csv.startsWith('﻿Time;Valor\r\n'));
  assert.ok(csv.includes('Bola;300,00'));
  assert.equal(brDateTime('2026-10-27T17:05:00Z'), '27/10/2026 14:05');
  assert.equal(brDateTime(null), '');
});
