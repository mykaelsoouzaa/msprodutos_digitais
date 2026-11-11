// Testes dos recursos de nicho da v3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';
import { PACOTE_ACHADINHOS, classificar, colecaoDoDia, limparNicho, motivoRecusa } from '../src/nicho.ts';

function ambiente(quando = '2026-11-10T12:05:00') { // 10/11/2026 é terça-feira
  const db = abrirBanco(':memory:');
  const f = (async () => new Response('<meta property="og:title" content="Organizador de Gaveta"><meta property="product:price:amount" content="29.90">', { status: 200 })) as any;
  let relogio = new Date(quando).getTime();
  const ctx: s.Ctx = { db, wpp: new WhatsAppSimulado(), f, urlPublica: 'https://ofertix.teste', agora: () => relogio };
  return { db, ctx, conta: contaPorEmail(db, 'ana@exemplo.com', 'Ana').id };
}
const oferta = (e: ReturnType<typeof ambiente>, titulo: string, precoPor = 3990) => s.salvarOferta(e.ctx, e.conta, {
  plataforma: 'shopee', urlOriginal: 'https://shopee.com.br/p-' + Math.random(), urlAfiliado: 'https://s.shopee.com.br/x', titulo, imagem: '', precoDe: 7990, precoPor, comissaoPct: 10,
});
const usarNicho = (e: ReturnType<typeof ambiente>, n: unknown) => e.db.prepare('UPDATE config_conta SET nicho = ? WHERE conta_id = ?').run(JSON.stringify(limparNicho(n)), e.conta);

test('classifica pelo título e grava a categoria na oferta', () => {
  assert.equal(classificar('Kit Skincare Sérum Vitamina C'), 'beleza');
  assert.equal(classificar('Organizador de Maquiagem Acrílico'), 'organizacao');
  assert.equal(classificar('Jogo de Panelas Cerâmica 5 peças'), 'cozinha');
  assert.equal(classificar('Vestido Midi Canelado'), 'moda');
  assert.equal(classificar('Parafusadeira 12V'), 'outros');
  const e = ambiente();
  const id = oferta(e, 'Tapete Antiderrapante para Sala');
  assert.equal(s.oferta(e.db, e.conta, id).categoria, 'casa');
});

test('regras do nicho: categoria, palavras, preço, nota e vendas', () => {
  const r = limparNicho({ regras: { categorias: ['beleza', 'xyz'], excluir: ['réplica'], precoMax: 5000, notaMin: '4,7', vendasMin: 100 } }).regras;
  assert.deepEqual(r.categorias, ['beleza']);
  assert.equal(r.notaMin, 4.7);
  assert.equal(motivoRecusa(r, { titulo: 'Sérum Facial', precoPor: 3990, nota: 4.9, vendas: 300 }), null);
  assert.match(motivoRecusa(r, { titulo: 'Panela de Pressão', precoPor: 3990 })!, /Categoria/);
  assert.match(motivoRecusa(r, { titulo: 'Perfume Réplica Importado', precoPor: 3990 })!, /bloqueada/);
  assert.match(motivoRecusa(r, { titulo: 'Perfume Importado', precoPor: 8990 })!, /Preço/);
  assert.match(motivoRecusa(r, { titulo: 'Perfume Importado', precoPor: 3990, nota: 4.2 })!, /Nota 4,2/);
  assert.match(motivoRecusa(r, { titulo: 'Perfume Importado', precoPor: 3990, vendas: 12 })!, /vendas/);
  // Sem nota ou vendas informadas pela loja, a oferta não é barrada por isso.
  assert.equal(motivoRecusa(r, { titulo: 'Perfume Importado', precoPor: 3990, nota: null, vendas: null }), null);
});

test('captura respeita o nicho: oferta fora da categoria fica de fora', async () => {
  const e = ambiente();
  const inst = await s.novaInstancia(e.ctx, e.conta, 'Principal');
  await s.atualizarEstado(e.ctx, e.conta, inst);
  const g = (e.db.prepare('SELECT id, jid FROM grupos WHERE conta_id = ? ORDER BY id').all(e.conta) as any[]).at(-1);
  s.alternarGrupo(e.db, e.conta, g.id, 'monitorar', true);
  const i = e.db.prepare('SELECT chave, token_webhook FROM instancias WHERE id = ?').get(inst) as any;
  e.db.prepare("UPDATE contas SET plano = 'pro' WHERE id = ?").run(e.conta);
  const msg = { event: 'messages.upsert', data: { key: { remoteJid: g.jid, fromMe: false }, message: { conversation: 'https://produto.mercadolivre.com.br/MLB-9' } } };
  usarNicho(e, { regras: { categorias: ['beleza'] } });
  assert.equal(await s.eventoWhatsApp(e.ctx, i.chave, i.token_webhook, msg), 0, 'organizador não é beleza');
  usarNicho(e, { regras: { categorias: ['organizacao'] } });
  assert.equal(await s.eventoWhatsApp(e.ctx, i.chave, i.token_webhook, msg), 1);
});

test('vitrine publica a coleção do dia primeiro e o rodapé de afiliado entra no texto', async () => {
  const e = ambiente();
  const inst = await s.novaInstancia(e.ctx, e.conta, 'Principal');
  await s.atualizarEstado(e.ctx, e.conta, inst);
  for (const g of (e.db.prepare('SELECT id FROM grupos WHERE conta_id = ?').all(e.conta) as any[]).slice(0, 2)) s.alternarGrupo(e.db, e.conta, g.id, 'enviar', true);
  const panela = oferta(e, 'Panela Antiaderente 24cm');
  const serum = oferta(e, 'Sérum Facial Vitamina C');
  s.alternarVitrine(e.db, e.conta, panela, true);
  s.alternarVitrine(e.db, e.conta, serum, true);
  e.db.prepare('UPDATE ofertas SET vitrine_em = id').run();
  e.db.prepare("UPDATE config_conta SET nicho = ?, horarios_auto = '12:00' WHERE conta_id = ?").run(JSON.stringify(PACOTE_ACHADINHOS.nicho), e.conta);
  assert.equal(colecaoDoDia(PACOTE_ACHADINHOS.nicho, new Date('2026-11-10T12:00:00').getTime()), 'beleza');
  assert.equal(s.rodarHorarios(e.ctx), 1);
  const ag = e.db.prepare('SELECT oferta_id, texto FROM agendamentos').get() as any;
  assert.equal(ag.oferta_id, serum, 'terça é dia de beleza: o sérum passa na frente da panela, mais antiga');
  assert.match(ag.texto, /Link de afiliado/);
});

test('desempenho por categoria na visão geral', () => {
  const e = ambiente();
  oferta(e, 'Sérum Facial');
  const v = s.visaoGeral(e.ctx, e.conta, '7d');
  assert.deepEqual(v.porCategoria, []);
});
