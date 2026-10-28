import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSelfDelete } from './my-data';

test('exclusão da própria conta só sem inscrições pagas', () => {
  assert.equal(canSelfDelete(0), true);
  assert.equal(canSelfDelete(3), false);
});
