// Testes da página do anúncio, do botão de WhatsApp e da animação do topo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as v6 from '../src/v6.ts';
import { criarServidor } from '../src/servidor.ts';
import { paginaVendas, paginaAnuncio } from '../src/vendas.ts';
import { GRUPOS_CENA } from '../src/cena.ts';

async function subir(whatsappContato?: string) {
  const db = abrirBanco(':memory:');
  const ctx = { db, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'http://localhost' };
  const app = { cfg: { porta: 0, urlPublica: 'https://ofertix.cloud', arquivoBanco: ':memory:', segredoSessao: 'x'.repeat(32), portalUrl: 'https://portal.exemplo', portalChavePublica: '', dev: false, evolutionUrl: '', evolutionApiKey: '', adminEmails: [], whatsappContato }, real: ctx, demo: { ...ctx, db: abrirBanco(':memory:') } };
  const srv = criarServidor(app as any).listen(0);
  await new Promise((r) => srv.once('listening', r));
  return { db, srv, base: `http://127.0.0.1:${(srv.address() as any).port}` };
}
const nav = { 'user-agent': 'Mozilla/5.0 (iPhone)' };

test('página do anúncio: origem "anuncio" por padrão, botões levam a origem adiante e não é indexada', async () => {
  const { db, srv, base } = await subir();
  try {
    const html = await (await fetch(base + '/quero-testar', { headers: nav })).text();
    assert.match(html, /grupos recebendo a mesma oferta/);
    assert.match(html, /href="\/quero\?o=anuncio"/);
    assert.match(html, /href="\/zap\?o=anuncio"/);
    assert.match(html, /name="robots" content="noindex"/);
    await fetch(base + '/quero-testar?o=reels', { headers: nav });
    const rel = v6.relatorioSite(db, 30);
    assert.equal(rel.visitas, 2);
    assert.deepEqual(rel.origens.map((o) => o.origem).sort(), ['anuncio', 'reels']);
  } finally { srv.close(); }
});

test('botão de WhatsApp: conta o clique e abre a conversa com o número configurado', async () => {
  const { db, srv, base } = await subir('5511988887777');
  try {
    const r = await fetch(base + '/zap?o=stories', { headers: nav, redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location')!, /^https:\/\/wa\.me\/5511988887777\?text=Ol%C3%A1/);
    await fetch(base + '/zap', { headers: { 'user-agent': 'facebookexternalhit/1.1' }, redirect: 'manual' }); // robô não conta
    const rel = v6.relatorioSite(db, 30);
    assert.equal(rel.zaps, 1);
    assert.equal(rel.origens[0]!.zaps, 1);
    const home = await (await fetch(base + '/?o=stories', { headers: nav })).text();
    assert.match(home, /class="zap-flut" href="\/zap\?o=stories"/);
  } finally { srv.close(); }
});

test('animação do topo: lista todos os grupos, funciona sem script e não tem estilo inline', () => {
  for (const html of [paginaVendas({ urlPublica: 'https://x', portalUrl: 'https://p', origem: '' }), paginaAnuncio({ urlPublica: 'https://x', portalUrl: 'https://p', origem: 'anuncio' })]) {
    assert.equal((html.match(/class="pe-l[ "]/g) ?? []).length, GRUPOS_CENA.length);
    assert.match(html, /id="pe-trilho"/);
    assert.match(html, /prefers-reduced-motion/);
    const cena = html.slice(html.indexOf('id="cena"'), html.indexOf('</section>', html.indexOf('id="cena"')));
    assert.doesNotMatch(cena, / style="/);
  }
});
