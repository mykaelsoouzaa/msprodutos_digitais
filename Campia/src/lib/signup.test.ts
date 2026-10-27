import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, webhookAction } from './signup';

const base = { baseCents: 30000, tiers: [{ until: '2026-11-01', cents: 25000 }], today: '2026-10-27', couponCode: '', coupon: null, couponUses: 0, pro: false, walletId: null };
delete process.env.CAMPIA_TAXA_PERCENT; delete process.env.CAMPIA_TAXA_PERCENT_PRO;

test('preço do lote, taxa e repasse', () => {
  const q = quote({ ...base, walletId: 'w1' });
  assert.ok(q.ok);
  if (!q.ok) return;
  assert.deepEqual([q.price, q.amount, q.fee, q.split?.percent], [25000, 25000, 10, 90]);
  const late = quote({ ...base, today: '2026-11-02' });
  assert.ok(late.ok && late.amount === 30000);
  const pro = quote({ ...base, pro: true, walletId: 'w1' });
  assert.ok(pro.ok && pro.fee === 5 && pro.split?.percent === 95);
});

test('cupom: desconto, limite e cupom inexistente', () => {
  const c = { code: 'AMIGO', percent: 20, amount_cents: null, max_uses: 2 };
  const ok = quote({ ...base, couponCode: ' amigo ', coupon: c, couponUses: 1 });
  assert.ok(ok.ok && ok.code === 'AMIGO' && ok.discount === 5000 && ok.amount === 20000);
  assert.deepEqual(quote({ ...base, couponCode: 'AMIGO', coupon: c, couponUses: 2 }), { ok: false, error: 'Esse cupom já foi usado o número máximo de vezes' });
  assert.deepEqual(quote({ ...base, couponCode: 'XYZ', coupon: null }), { ok: false, error: 'Cupom inválido para este campeonato' });
  const free = quote({ ...base, couponCode: 'FREE', coupon: { code: 'FREE', percent: 100, amount_cents: null, max_uses: null } });
  assert.ok(free.ok && free.amount === 0);
});

test('aviso do Asaas: inscrição, mensalidade do Pro ou ignorar', () => {
  assert.deepEqual(webhookAction({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', externalReference: 'abc' } }, '2026-10-27'), { type: 'inscricao', asaasId: 'pay_1', reference: 'abc' });
  assert.deepEqual(webhookAction({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_2', subscription: 'sub_1', dueDate: '2026-10-20' } }, '2026-10-27'), { type: 'plano', subscription: 'sub_1', dueDate: '2026-10-20' });
  assert.deepEqual(webhookAction({ event: 'PAYMENT_CREATED', payment: { id: 'pay_3' } }, '2026-10-27'), { type: 'ignorar' });
  assert.deepEqual(webhookAction(null, '2026-10-27'), { type: 'ignorar' });
});
