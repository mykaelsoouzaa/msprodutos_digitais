import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawableLogo, normalizeUrl, sortSponsors } from './sponsors';

test('links de patrocinador', () => {
  assert.equal(normalizeUrl(''), '');
  assert.equal(normalizeUrl('paobom.com.br'), 'https://paobom.com.br/');
  assert.equal(normalizeUrl('instagram.com/paobom'), 'https://instagram.com/paobom');
  assert.equal(normalizeUrl('http://x.com'), 'http://x.com/');
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('padaria'), null);
});

test('ordem e logos', () => {
  assert.deepEqual(sortSponsors([{ tier: 'apoio', n: 1 }, { tier: 'master', n: 2 }, { tier: 'apoio', n: 3 }]).map(s => s.n), [2, 1, 3]);
  assert.ok(drawableLogo('https://x/a.png'));
  assert.ok(!drawableLogo('https://x/a.webp'));
});
