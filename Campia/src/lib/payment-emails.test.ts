import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captainConfirmedEmail, methodLabel, organizerNewTeamEmail } from './payment-emails';

test('e-mails do pagamento confirmado', () => {
  assert.equal(methodLabel('cartao', 3), 'Cartão de crédito em 3x');
  assert.equal(methodLabel('pix'), 'PIX');
  const c = captainConfirmedEmail({ team: '<b>Real</b>', championship: 'Copa', amountCents: 30000, method: 'PIX', paidAt: '2026-10-28T15:00:00Z', code: 'A1B2C3D4', receiptUrl: 'https://x/pagamento/1', championshipUrl: 'https://x/c/copa' });
  assert.ok(!c.html.includes('<b>Real</b>'));
  assert.match(c.html, /28\/10\/2026/);
  assert.match(c.html, /https:\/\/x\/meus-times/);
  const o = organizerNewTeamEmail({ team: 'Real', championship: 'Copa', amountCents: 30000, method: 'PIX', signed: 16, total: 16, panelUrl: 'u' });
  assert.match(o.subject, /lotou/);
  assert.match(organizerNewTeamEmail({ team: 'Real', championship: 'Copa', amountCents: 0, method: 'PIX', signed: 3, total: 8, panelUrl: 'u' }).subject, /3 de 8/);
});
