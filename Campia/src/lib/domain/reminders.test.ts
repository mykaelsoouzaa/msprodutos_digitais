import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from './build';
import { dueReminders, gameStart } from './reminders';

const game = (date: string, time: string, extra = {}) => newGame({ date, time, homeId: 'a', awayId: 'b', ...extra });
const at = (iso: string) => Date.parse(iso);

test('horário do jogo é de Brasília (UTC−3)', () => {
  assert.equal(gameStart(game('2026-10-31', '09:00')), at('2026-10-31T12:00:00Z'));
  assert.equal(gameStart(game('', '09:00')), null);
  assert.equal(gameStart(game('2026-10-31', '')), null);
});

test('lembrete de 1 hora sai entre 8h e o fim da janela, e só uma vez por rodada do agendador', () => {
  const g = game('2026-10-31', '09:00');
  assert.deepEqual(dueReminders([g], at('2026-10-31T10:59:00Z')), []);                      // 7h59 em Brasília
  assert.deepEqual(dueReminders([g], at('2026-10-31T11:00:00Z')).map(r => r.lead), [60]);   // 8h00
  assert.deepEqual(dueReminders([g], at('2026-10-31T11:10:00Z')).map(r => r.lead), [60]);   // 8h10, dentro da janela de 20 min
  assert.deepEqual(dueReminders([g], at('2026-10-31T11:25:00Z')), []);                       // passou da janela
});

test('lembrete da véspera', () => {
  const g = game('2026-10-31', '09:00');
  assert.deepEqual(dueReminders([g], at('2026-10-30T12:05:00Z')).map(r => r.lead), [1440]);
});

test('não lembra jogos sem os dois times, já jogados ou que já começaram', () => {
  const now = at('2026-10-31T11:05:00Z');
  assert.deepEqual(dueReminders([game('2026-10-31', '09:00', { awayId: null })], now), []);
  assert.deepEqual(dueReminders([game('2026-10-31', '09:00', { homeScore: 1, awayScore: 0 })], now), []);
  assert.deepEqual(dueReminders([game('2026-10-31', '08:00')], now, [60, 0]), []);
});

test('antecedências personalizadas', () => {
  const g = game('2026-10-31', '09:00');
  assert.deepEqual(dueReminders([g], at('2026-10-31T11:31:00Z'), [30]).map(r => r.lead), [30]);
});
