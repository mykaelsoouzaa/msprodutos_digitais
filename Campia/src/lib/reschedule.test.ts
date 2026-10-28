import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftDate, validShift } from './reschedule';

test('soma e subtrai dias, virando mês e ano', () => {
  assert.equal(shiftDate('2026-11-28', 7), '2026-12-05');
  assert.equal(shiftDate('2026-12-29', 7), '2027-01-05');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
});
test('limites', () => {
  assert.ok(validShift(7)); assert.ok(validShift(-3));
  assert.ok(!validShift(0)); assert.ok(!validShift(91)); assert.ok(!validShift(1.5));
});
