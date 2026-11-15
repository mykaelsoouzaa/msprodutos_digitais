// Testes da 6.8: TikTok Shop (link do app, sai direto; no espelhamento o link de outra pessoa bloqueia).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plataformaDe, ehProdutoTikTok, linkCurtoTikTok, idTikTok } from '../src/links.ts';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';
import * as v10 from '../src/v10.ts';

test('reconhece links do TikTok Shop; vídeo comum não é loja', () => {
  assert.equal(plataformaDe('https://www.tiktok.com/view/product/1729384756123456789?region=BR'), 'tiktok');
  assert.equal(plataformaDe('https://shop.tiktok.com/view/product/1729384756123456789'), 'tiktok');
  assert.equal(plataformaDe('https://www.tiktok.com/@loja/video/7300000000000000000'), 'outra');
  assert.equal(linkCurtoTikTok('https://vt.tiktok.com/ZSabc123/'), true);
  assert.equal(linkCurtoTikTok('https://www.tiktok.com/t/ZT8abc/'), true);
  assert.equal(ehProdutoTikTok('https://vt.tiktok.com/ZSabc123/'), false);
  assert.equal(idTikTok('https://www.tiktok.com/view/product/1729384756123456789?x=1'), '1729384756123456789');
  assert.equal(v10.chaveProduto('https://www.tiktok.com/view/product/1729384756123456789?u=2'), 'tiktok:1729384756123456789');
});

function ambiente(destino: string) {
  const db = abrirBanco(':memory:');
  const f = (async (u: string, o: any = {}) => {
    const url = String(u);
    if (o.redirect === 'manual' && /vt\.tiktok\.com/.test(url)) return new Response(null, { status: 301, headers: { location: destino } });
    if (/tiktok\.com\/view\/product/.test(url)) return new Response('<meta property="og:title" content="Garrafa Térmica 1L - TikTok Shop"><meta property="og:image" content="https://p16.tiktokcdn.com/garrafa.jpg">', { headers: { 'content-type': 'text/html' } });
    return new Response('', { status: 404 });
  }) as any;
  const ctx = { db, wpp: new WhatsAppSimulado(), f, urlPublica: 'https://ofertix.teste' };
  const conta = contaPorEmail(db, 'ana@exemplo.com', 'Ana').id;
  return { db, ctx, conta };
}

test('link do app vira oferta: o link sai exatamente como foi colado', async () => {
  const e = ambiente('https://www.tiktok.com/view/product/1729384756123456789?region=BR&share=1');
  const o = await s.converterLink(e.ctx, e.conta, 'https://vt.tiktok.com/ZSabc123/');
  assert.equal(o.plataforma, 'tiktok');
  assert.equal(o.urlAfiliado, 'https://vt.tiktok.com/ZSabc123/', 'o link do app leva a comissão: não muda');
  assert.equal(o.urlOriginal, 'https://www.tiktok.com/view/product/1729384756123456789');
  assert.equal(o.titulo, 'Garrafa Térmica 1L');
  assert.match(o.imagem, /garrafa\.jpg/);
});

test('link curto do TikTok que não é produto é recusado', async () => {
  const e = ambiente('https://www.tiktok.com/@loja/video/7300000000000000000');
  await assert.rejects(s.converterLink(e.ctx, e.conta, 'https://vt.tiktok.com/ZSvideo/'), /não é de um produto do TikTok Shop/);
});
