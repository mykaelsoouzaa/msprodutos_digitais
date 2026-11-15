// Testes da 6.6: busca na Shopee com categoria, preço e grupo; grupos de monitoramento; Conectar plataformas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';
import * as v6 from '../src/v6.ts';
import * as v10 from '../src/v10.ts';
import { criarServidor } from '../src/servidor.ts';
import { semearDemo } from '../src/demo.ts';

function ambiente(demo = true) {
  const db = abrirBanco(':memory:');
  const ctx: s.Ctx = { db, wpp: new WhatsAppSimulado(), f: (async () => new Response('', { status: 200 })) as any, urlPublica: 'https://ofertix.teste', agora: () => new Date('2026-11-13T12:00:00').getTime(), demo };
  const conta = contaPorEmail(db, 'ana@exemplo.com', 'Ana').id;
  db.prepare("UPDATE contas SET plano = 'pro' WHERE id = ?").run(conta);
  return { db, ctx, conta };
}
async function grupos(e: ReturnType<typeof ambiente>) {
  const inst = await s.novaInstancia(e.ctx, e.conta, 'Principal');
  await s.atualizarEstado(e.ctx, e.conta, inst);
  return (e.db.prepare('SELECT id FROM grupos WHERE conta_id = ? ORDER BY id').all(e.conta) as any[]).map((g) => Number(g.id));
}

test('busca na Shopee: só por categoria, com preço máximo e para um grupo (tema)', async () => {
  const e = ambiente();
  // Só a categoria: nada de outra categoria aparece.
  const b = await v6.buscarShopee(e.ctx, e.conta, '', 'vendidos', 1, { categoria: 'beleza' });
  assert.ok(b.itens.length > 0);
  assert.ok(b.itens.every((x) => x.categoria === 'beleza' || x.categoria === 'outros'), 'só beleza');
  assert.equal(b.categoria, 'beleza');
  // Preço até R$ 50.
  const p = await v6.buscarShopee(e.ctx, e.conta, 'potes', 'vendidos', 1, { precoMax: 5000 });
  assert.ok(p.itens.length > 0 && p.itens.every((x) => x.precoPor && x.precoPor <= 5000));
  // Para o grupo "até R$ 50": usa o preço do tema, mesmo sem palavra nem categoria.
  const g = await grupos(e);
  s.alternarGrupo(e.db, e.conta, g[0]!, 'enviar', true);
  v10.salvarTemaGrupo(e.db, e.conta, g[0]!, { precoMax: 3000 });
  const pg = await v6.buscarShopee(e.ctx, e.conta, '', 'vendidos', 1, { grupo: g[0] });
  assert.ok(pg.itens.length > 0 && pg.itens.every((x) => x.precoPor && x.precoPor <= 3000));
  assert.equal(pg.grupo!.id, g[0]);
  await assert.rejects(v6.buscarShopee(e.ctx, e.conta, '', 'vendidos', 1, { grupo: g[3] }), /Grupo de envio não encontrado/);
  await assert.rejects(v6.buscarShopee(e.ctx, e.conta, '', 'vendidos', 1, {}), /escolha uma categoria/);
  // O que está na vitrine some da busca.
  const id = await v6.adicionarDaBusca(e.ctx, e.conta, b.itens[0], true);
  assert.ok(id);
  const de_novo = await v6.buscarShopee(e.ctx, e.conta, '', 'vendidos', 1, { categoria: 'beleza' });
  assert.ok(!de_novo.itens.some((x) => x.link === b.itens[0]!.link));
});

test('grupo de monitoramento não vira grupo de envio, e vice-versa', async () => {
  const e = ambiente(false);
  const g = await grupos(e);
  s.alternarGrupo(e.db, e.conta, g[0]!, 'monitorar', true);
  assert.throws(() => s.alternarGrupo(e.db, e.conta, g[0]!, 'enviar', true), /monitoramento \(captura ligada\)/);
  s.alternarGrupo(e.db, e.conta, g[1]!, 'enviar', true);
  assert.throws(() => s.alternarGrupo(e.db, e.conta, g[1]!, 'monitorar', true), /é de envio/);
  v10.salvarEspelho(e.db, e.conta, { origem: g[2] });
  assert.throws(() => s.alternarGrupo(e.db, e.conta, g[2]!, 'enviar', true), /origem de um espelhamento/);
  // Desligar continua livre.
  s.alternarGrupo(e.db, e.conta, g[0]!, 'monitorar', false);
  s.alternarGrupo(e.db, e.conta, g[0]!, 'enviar', true);
});

test('Conectar plataformas salva as lojas; Configurações não apaga as lojas', async () => {
  const demoDb = abrirBanco(':memory:'); semearDemo(demoDb);
  const db = abrirBanco(':memory:');
  const ctx = { db, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'https://ofertix.teste' };
  const app = { cfg: { porta: 0, urlPublica: 'https://ofertix.teste', arquivoBanco: ':memory:', segredoSessao: 'x'.repeat(32), portalUrl: 'https://portal.exemplo', portalChavePublica: '', dev: true, evolutionUrl: '', evolutionApiKey: '', adminEmails: [], whatsappContato: '' }, real: ctx, demo: { ...ctx, db: demoDb, demo: true } };
  const srv = criarServidor(app as any).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  try {
    const cookie = String((await fetch(base + '/demo', { redirect: 'manual' })).headers.get('set-cookie')).split(';')[0];
    const h = { cookie, 'x-ofertix': '1', 'content-type': 'application/json' };
    assert.equal((await fetch(base + '/api/plataformas', { method: 'POST', headers: h, body: JSON.stringify({ shopee_app_id: '123', shopee_segredo: 'abc', amazon_tag: 'carla-20', ml_modelo: 'matt_tool=1' }) })).status, 200);
    assert.equal((await fetch(base + '/api/config', { method: 'POST', headers: h, body: JSON.stringify({ modelo_mensagem: '', intervalo_min: 30, intervalo_max: 60 }) })).status, 200);
    const c = await (await fetch(base + '/api/config', { headers: { cookie } })).json() as any;
    assert.deepEqual([c.shopee_app_id, c.amazon_tag, c.ml_modelo, c.shopee_segredo], ['123', 'carla-20', 'matt_tool=1', '••••••••']);
    // Lista de grupos traz a marca de espelho.
    const gs = await (await fetch(base + '/api/grupos', { headers: { cookie } })).json() as any;
    assert.ok(gs.lista.some((x: any) => x.espelho === 1));
  } finally { srv.close(); }
});
