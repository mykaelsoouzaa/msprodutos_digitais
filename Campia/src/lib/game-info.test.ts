import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanVideos, resultText, videoLabel, youtubeId } from './game-info';

test('lances em vídeo', () => {
  assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://instagram.com/reel/abc'), null);
  assert.deepEqual(cleanVideos('https://youtu.be/a1 http://x.com javascript:alert(1)\nhttps://instagram.com/reel/abc https://youtu.be/a1'), ['https://youtu.be/a1', 'https://instagram.com/reel/abc']);
  assert.equal(cleanVideos(Array.from({ length: 9 }, (_, i) => `https://x.com/${i}`).join(' ')).length, 5);
  assert.equal(videoLabel('https://www.instagram.com/reel/x'), 'Instagram');
});

const base = { homeScore: 2, awayScore: 1, penHome: null, penAway: null, wo: null } as const;
test('placar normal', () => assert.equal(resultText(base, 'A', 'B'), 'A 2 × 1 B'));
test('pênaltis só no empate', () => {
  assert.equal(resultText({ ...base, awayScore: 2, penHome: 4, penAway: 3 }, 'A', 'B'), 'A 2 × 2 B (4 × 3)');
  assert.equal(resultText({ ...base, penHome: 4, penAway: 3 }, 'A', 'B'), 'A 2 × 1 B');
});
test('W.O.', () => {
  assert.equal(resultText({ ...base, homeScore: 0, awayScore: 3, wo: 'home' }, 'A', 'B'), 'A 0 × 3 B · W.O.');
  assert.equal(resultText({ ...base, wo: 'both' }, 'A', 'B'), 'A e B: W.O. duplo');
});
