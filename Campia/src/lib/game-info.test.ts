import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanVideos, videoLabel, youtubeId } from './game-info';

test('lances em vídeo', () => {
  assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://instagram.com/reel/abc'), null);
  assert.deepEqual(cleanVideos('https://youtu.be/a1 http://x.com javascript:alert(1)\nhttps://instagram.com/reel/abc https://youtu.be/a1'), ['https://youtu.be/a1', 'https://instagram.com/reel/abc']);
  assert.equal(cleanVideos(Array.from({ length: 9 }, (_, i) => `https://x.com/${i}`).join(' ')).length, 5);
  assert.equal(videoLabel('https://www.instagram.com/reel/x'), 'Instagram');
});
