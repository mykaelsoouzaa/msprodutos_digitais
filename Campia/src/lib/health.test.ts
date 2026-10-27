import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_ENV, healthChecks, shouldAlert } from './health';

const now = Date.parse('2026-10-27T18:00:00Z');
const env = { ...Object.fromEntries(REQUIRED_ENV.map(([k]) => [k, 'x'])), WHATSAPP_TOKEN: 'x', WHATSAPP_PHONE_ID: 'x' };

test('alerta no máximo a cada 30 min por tipo', () => {
  assert.ok(shouldAlert(null, now));
  assert.ok(!shouldAlert('2026-10-27T17:45:00Z', now));
  assert.ok(shouldAlert('2026-10-27T17:00:00Z', now));
});

test('quadro de saúde', () => {
  const ok = healthChecks({ now, cronAt: '2026-10-27T17:55:00Z', webhookAt: '2026-10-27T12:00:00Z', events: [], env, provider: 'asaas' });
  assert.ok(ok.every(c => c.state === 'ok'), JSON.stringify(ok.filter(c => c.state !== 'ok')));
  const bad = healthChecks({
    now, cronAt: null, webhookAt: null, provider: 'asaas', env: { ...env, BREVO_API_KEY: undefined },
    events: [{ kind: 'pix', message: 'Asaas: CPF inválido', created_at: '2026-10-27T17:30:00Z' }, { kind: 'pix', message: 'antigo', created_at: '2026-10-20T10:00:00Z' }],
  });
  const by = Object.fromEntries(bad.map(c => [c.key, c]));
  assert.equal(by.agendador.state, 'erro');
  assert.equal(by.pix.state, 'erro');
  assert.match(by.pix.detail, /^1 em 24 h: Asaas: CPF inválido/);
  assert.equal(by.config.state, 'erro');
  assert.match(by.config.detail, /Brevo/);
  const semWa = healthChecks({ now, cronAt: '2026-10-27T17:55:00Z', webhookAt: null, events: [], env: { ...env, WHATSAPP_TOKEN: undefined }, provider: 'asaas' });
  assert.equal(semWa.find(c => c.key === 'whatsapp')!.state, 'atencao');
});
