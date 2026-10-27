import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duePixReminders, pixReminderEmail } from './payment-reminder';

const now = Date.parse('2026-10-27T15:00:00Z');
const min = (m: number) => new Date(now + m * 60_000).toISOString();
const row = (over: Partial<Parameters<typeof duePixReminders>[0][number]>) =>
  ({ id: 'p', created_at: min(-12), reminder_sent_at: null, reserved_until: min(18), status: 'pendente', ...over });

test('quem recebe o lembrete do PIX', () => {
  assert.equal(duePixReminders([row({})], now).length, 1);                         // 12 min depois, 18 min restando
  assert.equal(duePixReminders([row({ created_at: min(-5) })], now).length, 0);    // cedo demais
  assert.equal(duePixReminders([row({ reserved_until: min(3) })], now).length, 0); // quase vencendo
  assert.equal(duePixReminders([row({ reminder_sent_at: min(-1) })], now).length, 0); // já enviado
  assert.equal(duePixReminders([row({ status: 'pago' })], now).length, 0);
  assert.equal(duePixReminders([row({ reserved_until: null })], now).length, 0);
});

test('e-mail do lembrete escapa o nome do time', () => {
  const m = pixReminderEmail({ team: '<Os Brabos>', championship: 'Copa', amountCents: 30000, url: 'https://campia.app.br/pagamento/x', minutesLeft: 18 });
  assert.ok(m.html.includes('&lt;Os Brabos&gt;'));
  assert.ok(!m.html.includes('<Os Brabos>'));
  assert.ok(m.html.includes('R$') && m.html.includes('18 minutos'));
  assert.equal(m.subject, 'Falta o PIX da inscrição do <Os Brabos>');
});
