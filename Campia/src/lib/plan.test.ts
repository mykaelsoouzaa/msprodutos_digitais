import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extendPaidUntil, feeFor, isProActive, proFeePercent, proPriceCents } from './plan';

test('preço e taxa do Pro', () => {
  assert.equal(proPriceCents(undefined), 4990);
  assert.equal(proPriceCents('59,90'), 5990);
  assert.equal(proPriceCents('abc'), 4990);
  assert.equal(proFeePercent(undefined), 5);
  assert.equal(proFeePercent('3'), 3);
  delete process.env.CAMPIA_TAXA_PERCENT; delete process.env.CAMPIA_TAXA_PERCENT_PRO;
  assert.equal(feeFor(false), 10);
  assert.equal(feeFor(true), 5);
});

test('validade do Pro', () => {
  assert.equal(extendPaidUntil(null, '2026-10-27').slice(0, 10), '2026-12-02');
  assert.equal(extendPaidUntil(null, '2027-01-31').slice(0, 10), '2027-03-05');
  const later = '2027-06-01T00:00:00.000Z';
  assert.equal(extendPaidUntil(later, '2026-10-27'), later);
  assert.ok(isProActive({ paid_until: '2099-01-01T00:00:00Z' }));
  assert.ok(!isProActive({ paid_until: '2020-01-01T00:00:00Z' }));
  assert.ok(!isProActive(null));
});
