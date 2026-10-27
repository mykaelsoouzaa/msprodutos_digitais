import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFERRAL_RE, addMonth, newReferralCode } from './referral';

test('código de indicação', () => {
  const c = newReferralCode();
  assert.match(c, REFERRAL_RE);
  assert.ok(!/[l1o0i]/.test(c));
});

test('mês de presente soma ao que já estava pago', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  assert.equal(addMonth(null, now).slice(0, 10), '2026-11-27');
  assert.equal(addMonth('2026-12-10T00:00:00Z', now).slice(0, 10), '2027-01-10');
  assert.equal(addMonth('2026-01-01T00:00:00Z', now).slice(0, 10), '2026-11-27');
  assert.equal(addMonth(null, new Date('2027-01-31T12:00:00Z')).slice(0, 10), '2027-02-28');
});
