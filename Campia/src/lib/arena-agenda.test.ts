import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agendaDays, todayBr } from './arena-agenda';

const g = (id: string, date: string, time: string, field: string) => ({ id, date, time, field, champ: { name: 'C', slug: 'c' }, home: 'A', away: 'B', score: null });

test('agrupa por dia e ordena por horário e campo', () => {
  const days = agendaDays([
    g('1', '2026-11-02', '10:00', 'Campo 2'), g('2', '2026-11-01', '09:00', 'Campo 1'),
    g('3', '2026-11-02', '10:00', 'Campo 10'), g('4', '2026-11-02', '08:00', 'Campo 1'),
    g('5', '2026-10-30', '09:00', 'Campo 1'), g('6', '2026-11-20', '09:00', 'Campo 1'), g('7', '', '', ''),
  ], '2026-11-01');
  assert.deepEqual(days.map(d => [d.date, d.games.map(x => x.id)]), [['2026-11-01', ['2']], ['2026-11-02', ['4', '1', '3']]]);
});

test('hoje no horário de Brasília', () => {
  assert.equal(todayBr(new Date('2026-11-02T02:00:00Z')), '2026-11-01');
  assert.equal(todayBr(new Date('2026-11-02T04:00:00Z')), '2026-11-02');
});
