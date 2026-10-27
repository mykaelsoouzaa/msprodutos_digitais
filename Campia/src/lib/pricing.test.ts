import { test } from 'node:test';
import assert from 'node:assert/strict';
import { couponDiscount, currentPrice, normalizeCode } from './pricing';

const tiers = [{ until: '2026-11-15', cents: 30000 }, { until: '2026-11-01', cents: 25000 }];

test('lotes de preço por data', () => {
  assert.deepEqual(currentPrice(35000, tiers, '2026-10-27'), { cents: 25000, lot: 1, until: '2026-11-01', next: 30000 });
  assert.deepEqual(currentPrice(35000, tiers, '2026-11-01'), { cents: 25000, lot: 1, until: '2026-11-01', next: 30000 }); // vale até o fim do dia
  assert.deepEqual(currentPrice(35000, tiers, '2026-11-02'), { cents: 30000, lot: 2, until: '2026-11-15', next: 35000 });
  assert.deepEqual(currentPrice(35000, tiers, '2026-11-20'), { cents: 35000, lot: 3, until: null, next: null });
  assert.deepEqual(currentPrice(35000, [], '2026-11-20'), { cents: 35000, lot: null, until: null, next: null });
});

test('cupom de desconto', () => {
  assert.equal(couponDiscount(30000, { percent: 10, amount_cents: null }), 3000);
  assert.equal(couponDiscount(30000, { percent: null, amount_cents: 5000 }), 5000);
  assert.equal(couponDiscount(3000, { percent: null, amount_cents: 5000 }), 3000); // não fica negativo
  assert.equal(normalizeCode(' parceiro-10 '), 'PARCEIRO10');
});
