import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type FinPayment, financeSummary, monthLabel } from './finance';

const p = (o: Partial<FinPayment>): FinPayment => ({ championship_id: 'c1', amount_cents: 30000, discount_cents: 0, status: 'pago', payout: 'automatico', manual_payout_done_at: null, fee_percent: 10, method: 'pix', paid_at: '2026-10-20T12:00:00Z', refunded_at: null, ...o });

test('relatório financeiro', () => {
  const { total, byChamp, months } = financeSummary([
    p({}),
    p({ fee_percent: 5, discount_cents: 5000, amount_cents: 25000 }),
    p({ payout: 'manual', manual_payout_done_at: '2026-10-25' }),
    p({ payout: 'manual', championship_id: 'c2', paid_at: '2026-11-02T12:00:00Z' }),
    p({ status: 'estornado' }),
    p({ status: 'pendente' }),
    p({ status: 'pago_tarde' }),
    p({ fee_percent: null }),
  ], 10);
  assert.equal(total.count, 5);
  assert.equal(total.paid, 145000);
  assert.equal(total.campia, 3000 + 1250 + 3000 + 3000 + 3000);
  assert.equal(total.yours, total.paid - total.campia);
  assert.equal(total.auto, 27000 + 23750 + 27000);
  assert.equal(total.manualDone, 27000);
  assert.equal(total.manualPending, 27000);
  assert.equal(total.discounts, 5000);
  assert.deepEqual([total.refunded, total.refundedCount, total.late], [30000, 1, 30000]);
  assert.equal(byChamp.get('c2')!.paid, 30000);
  assert.deepEqual(months.map(m => [m[0], m[1].count]), [['2026-11', 1], ['2026-10', 4]]);
  assert.equal(monthLabel('2026-10'), 'outubro de 2026');
});
