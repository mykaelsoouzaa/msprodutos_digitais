import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSize, sortPhotos } from './photos';

test('fotos', () => {
  assert.deepEqual(fitSize(4000, 3000), { w: 1600, h: 1200 });
  assert.deepEqual(fitSize(3000, 4000), { w: 1200, h: 1600 });
  assert.deepEqual(fitSize(800, 600), { w: 800, h: 600 });
  assert.deepEqual(sortPhotos([{ url: 'a', path: 'a', at: '1' }, { url: 'b', path: 'b', at: '2' }]).map(p => p.url), ['b', 'a']);
});
