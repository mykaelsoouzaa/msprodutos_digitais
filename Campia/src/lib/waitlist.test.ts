import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeSlots, waitlistToNotify } from './waitlist';

const now = Date.parse('2026-10-27T15:00:00Z');
const at = (m: number) => new Date(now + m * 60_000).toISOString();

test('vagas livres: abertas e reservas vencidas', () => {
  assert.equal(freeSlots([
    { status: 'aberta', reserved_until: null },
    { status: 'reservada', reserved_until: at(-1) },
    { status: 'reservada', reserved_until: at(10) },
    { status: 'inscrita', reserved_until: null },
  ], now), 2);
});

test('quem avisar da lista de espera', () => {
  const fila = [
    { id: 'c', created_at: at(-10), notified_at: null },
    { id: 'a', created_at: at(-30), notified_at: null },
    { id: 'b', created_at: at(-20), notified_at: null },
  ];
  assert.deepEqual(waitlistToNotify(fila, 2, now).map(e => e.id), ['a', 'b']);   // ordem de chegada
  assert.deepEqual(waitlistToNotify(fila, 0, now), []);
  // 1 vaga e alguém avisado há 5 min: ainda é a vez dele
  const avisado = [{ id: 'x', created_at: at(-60), notified_at: at(-5) }, ...fila];
  assert.deepEqual(waitlistToNotify(avisado, 1, now), []);
  // avisado há 40 min e não se inscreveu: avisa o próximo
  const velho = [{ id: 'x', created_at: at(-60), notified_at: at(-40) }, ...fila];
  assert.deepEqual(waitlistToNotify(velho, 1, now).map(e => e.id), ['a']);
});
