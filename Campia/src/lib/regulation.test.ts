import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHeading, paragraphs, regulationTemplate } from './regulation';

test('modelo de regulamento por esporte', () => {
  const futsal = regulationTemplate('Futsal', 3);
  assert.match(futsal, /CARTÕES/);
  assert.match(futsal, /3 amarelos/);
  const volei = regulationTemplate('Vôlei');
  assert.ok(!/CARTÕES/.test(volei));
  assert.match(volei, /não há empate/);
  assert.match(volei, /sets vencidos/);
  assert.ok(isHeading('3. HORÁRIOS E W.O.'));
  assert.ok(!isHeading('Tolerância de 10 minutos'));
  assert.ok(!isHeading('1.'));
  assert.deepEqual(paragraphs('a\nb\n\nc'), [['a', 'b'], ['c']]);
});
