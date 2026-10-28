import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlayers } from './format';
import { playersText } from './previous-team-text';

test('elenco volta no mesmo formato que o capitão digita', () => {
  const list = [{ name: 'João', number: '10' }, { name: 'Carlos', number: '' }];
  const text = playersText(list);
  assert.equal(text, '10 João\nCarlos');
  assert.deepEqual(parsePlayers(text).map(p => [p.number, p.name]), [['10', 'João'], ['', 'Carlos']]);
});
