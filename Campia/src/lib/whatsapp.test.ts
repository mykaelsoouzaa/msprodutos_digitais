import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendWhatsapp, templatePayload, waNumber, whatsappEnabled } from './whatsapp';

test('número no formato do WhatsApp', () => {
  assert.equal(waNumber('(19) 99999-8888'), '5519999998888');
  assert.equal(waNumber('1933334444'), '551933334444');
  assert.equal(waNumber('+55 19 99999-8888'), '5519999998888');
  assert.equal(waNumber('9999'), null);
});

test('modelo com variáveis e desligado sem configuração', async () => {
  const p = templatePayload('5519999998888', 'campia_lembrete_jogo', ['Real Várzea x Tsunami', 'hoje às 10:00\\n(Campo 1)']);
  assert.equal(p.template.language.code, 'pt_BR');
  assert.deepEqual(p.template.components[0].parameters.map(x => x.text), ['Real Várzea x Tsunami', 'hoje às 10:00\\n(Campo 1)'.replace(/\\s+/g, ' ')]);
  delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_PHONE_ID;
  assert.equal(whatsappEnabled(), false);
  assert.equal(await sendWhatsapp('19999998888', 'x', []), 'skipped');
});
