import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveMinute } from './live';

const t0 = Date.parse('2026-11-07T13:00:00Z');
test('minuto do jogo ao vivo', () => {
  assert.equal(liveMinute('2026-11-07T13:00:00Z', t0 + 10_000), 1);
  assert.equal(liveMinute('2026-11-07T13:00:00Z', t0 + 22.5 * 60000), 23);
  assert.equal(liveMinute('2026-11-07T13:00:00Z', t0 + 4 * 3600000), null);
  assert.equal(liveMinute(null, t0), null);
});
