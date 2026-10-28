import { test } from 'node:test';
import assert from 'node:assert/strict';
import { announcementEmail, textToHtml, uniqueEmails } from './announcement';

test('recado para os capitães', () => {
  assert.equal(textToHtml('Oi <b>time</b>\nlinha 2\n\nParágrafo 2'), '<p>Oi &lt;b&gt;time&lt;/b&gt;<br>linha 2</p>\n<p>Parágrafo 2</p>');
  const e = announcementEmail({ championship: 'Copa', from: 'Arena', subject: 'Jogo adiado', text: 'Choveu', url: 'https://x' });
  assert.equal(e.subject, '[Copa] Jogo adiado');
  assert.deepEqual(uniqueEmails(['A@x.com', 'a@x.com ', '', null, 'ruim', 'b@y.com.br']), ['a@x.com', 'b@y.com.br']);
});
