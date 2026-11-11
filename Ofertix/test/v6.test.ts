// Testes das novidades da v6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';
import * as v6 from '../src/v6.ts';
import { criarEntrada } from '../src/entradas.ts';
import { buscarProdutosShopee } from '../src/shopee.ts';
import { criarServidor } from '../src/servidor.ts';
import { paginaVendas } from '../src/vendas.ts';

function ambiente(quando = '2026-11-11T12:00:00', demo = false) {
  const db = abrirBanco(':memory:');
  const wpp = new WhatsAppSimulado();
  let relogio = new Date(quando).getTime();
  const f = (async () => new Response('<meta property="og:title" content="Produto">', { status: 200 })) as any;
  const ctx: s.Ctx = { db, wpp, f, urlPublica: 'https://ofertix.teste', agora: () => relogio, demo };
  const conta = contaPorEmail(db, 'ana@exemplo.com', 'Ana').id;
  return { db, wpp, ctx, conta, ir: (q: string) => { relogio = new Date(q).getTime(); }, avancar: (ms: number) => { relogio += ms; } };
}
async function preparar(e: ReturnType<typeof ambiente>, n = 2) {
  const inst = await s.novaInstancia(e.ctx, e.conta, 'Principal');
  await s.atualizarEstado(e.ctx, e.conta, inst);
  const grupos = (e.db.prepare('SELECT id FROM grupos WHERE conta_id = ? ORDER BY id').all(e.conta) as any[]).map((g) => Number(g.id));
  for (const g of grupos.slice(0, n)) s.alternarGrupo(e.db, e.conta, g, 'enviar', true);
  e.db.prepare('UPDATE config_conta SET aquecimento = 0').run();
  return { inst, grupos, chave: (e.db.prepare('SELECT chave, token_webhook FROM instancias WHERE id = ?').get(inst) as any) };
}
async function esvaziarFila(e: ReturnType<typeof ambiente>) {
  await s.despachar(e.ctx);
  for (let i = 0; i < 30; i++) { e.avancar(120_000); await s.processarFila(e.ctx); }
}

test('busca na Shopee: sem credenciais pede o cadastro; na demonstração usa o catálogo de exemplo', async () => {
  const e = ambiente();
  await assert.rejects(v6.buscarShopee(e.ctx, e.conta, 'potes'), /AppID/);
  const d = ambiente(undefined, true);
  const r = await v6.buscarShopee(d.ctx, d.conta, 'potes de vidro');
  assert.ok(r.itens.length >= 1);
  assert.match(r.itens[0].titulo, /Potes/);
  // Curadoria: preço acima do limite aparece com o motivo.
  d.db.prepare('UPDATE config_conta SET nicho = ?').run(JSON.stringify({ regras: { precoMax: 3000 } }));
  const r2 = await v6.buscarShopee(d.ctx, d.conta, 'escova secadora');
  assert.equal(r2.itens.find((x) => /Escova/.test(x.titulo))!.motivo, 'Preço acima do limite');
  // Adicionar vira oferta da Shopee, na vitrine, e a busca passa a marcar como "já tem".
  const id = await v6.adicionarDaBusca(d.ctx, d.conta, r.itens[0], true);
  const o = s.oferta(d.db, d.conta, id);
  assert.equal(o.plataforma, 'shopee'); assert.equal(o.vitrine, 1); assert.equal(o.origem, 'busca');
  assert.ok((await v6.buscarShopee(d.ctx, d.conta, 'potes de vidro')).itens[0].ja);
  await assert.rejects(v6.adicionarDaBusca(d.ctx, d.conta, { ...r.itens[0], link: 'https://golpe.com/x' }), /inválido/);
});

test('busca na Shopee: monta a consulta e tenta de novo sem nota e vendas se a API recusar', async () => {
  const consultas: string[] = [];
  const f = (async (_u: string, op: any) => {
    const q = JSON.parse(op.body).query as string;
    consultas.push(q);
    if (q.includes('ratingStar')) return new Response(JSON.stringify({ errors: [{ message: 'campo desconhecido' }] }), { status: 200 });
    return new Response(JSON.stringify({ data: { productOfferV2: { nodes: [{ itemId: 1, shopId: 2, productName: 'Sérum', imageUrl: 'https://img/x.jpg', priceMin: '27.9', priceDiscountRate: 50, commissionRate: '0.12', productLink: 'https://shopee.com.br/product/2/1?x=1', offerLink: 'https://s.shopee.com.br/abc' }], pageInfo: { hasNextPage: true } } } }), { status: 200 });
  }) as any;
  const r = await buscarProdutosShopee({ appId: 'a', segredo: 'b' }, 'sérum', 'comissao', 1, 20, f);
  assert.equal(consultas.length, 2);
  assert.match(consultas[0], /keyword:"sérum",sortType:5/);
  assert.equal(r.temMais, true);
  assert.deepEqual({ ...r.itens[0] }, { itemId: '1', shopId: '2', titulo: 'Sérum', imagem: 'https://img/x.jpg', link: 'https://shopee.com.br/product/2/1', linkAfiliado: 'https://s.shopee.com.br/abc', precoDe: 5580, precoPor: 2790, comissaoPct: 12, nota: null, vendas: null });
});

test('vitrine abastecida sozinha: usa palavras e coleção do dia, respeita o nicho e não repete', async () => {
  const d = ambiente('2026-11-10T07:40:00', true); // terça
  d.db.prepare('UPDATE config_conta SET nicho = ?').run(JSON.stringify({ colecoes: ['', '', 'beleza', '', '', '', ''] }));
  assert.throws(() => v6.salvarAbastecer(d.db, d.conta, { ativo: true, palavras: '', colecao: false }), /palavra/);
  v6.salvarAbastecer(d.db, d.conta, { ativo: true, palavras: 'organizador, potes', quantidade: 4, hora: '07:30', colecao: true });
  const termos = v6.termosDoDia(d.db, d.conta, v6.lerAbastecer(d.db, d.conta), d.ctx.agora!());
  assert.deepEqual(termos.slice(0, 2), ['organizador', 'potes']);
  assert.equal(termos.length, 5);
  const n = await v6.rodarAbastecer(d.ctx);
  assert.equal(n, 4);
  assert.equal(Number((d.db.prepare('SELECT COUNT(*) AS n FROM ofertas WHERE vitrine = 1').get() as any).n), 4);
  assert.equal(await v6.rodarAbastecer(d.ctx), 0, 'uma vez por dia');
  const r = await v6.abastecerAgora(d.ctx, d.conta);
  const total = Number((d.db.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT url_original) AS u FROM ofertas').get() as any).n);
  assert.equal(total, 4 + r.adicionadas.length, 'não adiciona o que já existe');
});

test('enquete: vai pela fila como enquete do WhatsApp e pode ser enviada de novo', async () => {
  const e = ambiente();
  const { grupos } = await preparar(e);
  assert.throws(() => v6.criarEnquete(e.ctx, e.conta, { pergunta: 'Qual?', opcoes: ['Só uma'] }), /2 opções/);
  const id = v6.criarEnquete(e.ctx, e.conta, { pergunta: 'O que vocês querem amanhã?', opcoes: 'Cozinha\nBeleza\nBeleza\nOrganização', grupos: [grupos[0]] });
  await esvaziarFila(e);
  assert.equal(e.wpp.enviados.length, 1);
  assert.deepEqual(e.wpp.enviados[0].enquete, ['Cozinha', 'Beleza', 'Organização']);
  assert.equal((e.db.prepare('SELECT status FROM agendamentos WHERE id = ?').get(id) as any).status, 'enviado');
  const novo = v6.enviarDeNovo(e.ctx, e.conta, id);
  assert.notEqual(novo, id);
  await esvaziarFila(e);
  assert.equal(e.wpp.enviados.length, 2);
  assert.ok(e.wpp.enviados[1].enquete);
  s.alternarGrupo(e.db, e.conta, grupos[0], 'enviar', false);
  assert.throws(() => v6.enviarDeNovo(e.ctx, e.conta, id), /não estão mais/);
});

test('lista do dia: junta as ofertas de hoje, mais clicadas primeiro, com o link da vitrine', async () => {
  const e = ambiente('2026-11-11T09:00:00');
  await preparar(e);
  assert.equal(v6.textoListaDia(e.ctx, e.conta), '');
  const ids = ['Kit Potes de Vidro', 'Organizador de Gaveta', 'Sérum Vitamina C'].map((t, i) => s.salvarOferta(e.ctx, e.conta, {
    plataforma: 'amazon', urlOriginal: 'https://www.amazon.com.br/dp/' + i, urlAfiliado: 'https://www.amazon.com.br/dp/' + i + '?tag=a-20', titulo: t, imagem: '', precoDe: null, precoPor: 2990 + i * 1000, comissaoPct: null,
  }));
  for (const id of ids) { const o = s.oferta(e.db, e.conta, id); s.agendar(e.ctx, e.conta, { ofertaId: id, texto: s.textoOferta(e.db, e.conta, o) }); }
  await esvaziarFila(e);
  // Cliques na terceira oferta: ela vem primeiro.
  const cod = (e.db.prepare('SELECT codigo FROM links WHERE oferta_id = ? LIMIT 1').get(ids[2]) as any).codigo;
  s.registrarClique(e.ctx, cod, 'Mozilla/5.0'); s.registrarClique(e.ctx, cod, 'Mozilla/5.0');
  let txt = v6.textoListaDia(e.ctx, e.conta);
  assert.match(txt, /1\. Sérum Vitamina C · \*R\$ 49,90\*/);
  assert.match(txt, /amazon\.com\.br\/dp\/0/, 'sem link de entrada, vai o link de cada oferta');
  criarEntrada(e.ctx, e.conta, { titulo: 'Achadinhos', slug: 'achadinhos-teste' });
  txt = v6.textoListaDia(e.ctx, e.conta);
  assert.match(txt, /https:\/\/ofertix\.teste\/v\/achadinhos-teste/);
  assert.doesNotMatch(txt, /dp\/0/);
  v6.salvarListaDia(e.db, e.conta, { ativo: true, hora: '21:30', quantas: 3 });
  e.ir('2026-11-11T21:31:00');
  assert.equal(v6.rodarListaDia(e.ctx), 1);
  assert.equal(v6.rodarListaDia(e.ctx), 0);
  assert.equal((e.db.prepare("SELECT origem FROM agendamentos ORDER BY id DESC LIMIT 1").get() as any).origem, 'lista');
});

test('respostas no privado: palavra-chave, campos, uma vez a cada 12 h por contato e nada em grupo', async () => {
  const e = ambiente();
  const { chave } = await preparar(e);
  criarEntrada(e.ctx, e.conta, { titulo: 'Achadinhos', slug: 'achadinhos-moca' });
  e.db.prepare("INSERT INTO cupons (conta_id, codigo, plataforma, descricao) VALUES (?, 'MOCA10', 'shopee', '10% off')").run(e.conta);
  assert.throws(() => v6.salvarResposta(e.db, e.conta, { palavras: '', texto: 'x' }), /palavra/);
  v6.salvarResposta(e.db, e.conta, { palavras: 'grupo, link', texto: 'Oi, {nome}! Entre aqui: {link_grupos}' });
  v6.salvarResposta(e.db, e.conta, { palavras: 'cupom', texto: 'Cupons:\n{cupons}' });
  const msg = (jid: string, texto: string, pushName = 'Joana Silva') => ({ event: 'messages.upsert', data: { key: { remoteJid: jid, fromMe: false }, pushName, message: { conversation: texto } } });
  await s.eventoWhatsApp(e.ctx, chave.chave, chave.token_webhook, msg('5511999990001@s.whatsapp.net', 'Oi! Qual o link do GRUPO?'));
  assert.equal(e.wpp.enviados.at(-1)!.texto, 'Oi, Joana! Entre aqui: https://ofertix.teste/g/achadinhos-moca');
  assert.equal(e.wpp.enviados.at(-1)!.jid, '5511999990001@s.whatsapp.net');
  const antes = e.wpp.enviados.length;
  await s.eventoWhatsApp(e.ctx, chave.chave, chave.token_webhook, msg('5511999990001@s.whatsapp.net', 'grupo de novo'));
  assert.equal(e.wpp.enviados.length, antes, 'não repete para o mesmo contato em 12 h');
  await s.eventoWhatsApp(e.ctx, chave.chave, chave.token_webhook, msg('5511999990001@s.whatsapp.net', 'tem cupom?'));
  assert.match(e.wpp.enviados.at(-1)!.texto, /MOCA10\* \(10% off\)/);
  await s.eventoWhatsApp(e.ctx, chave.chave, chave.token_webhook, msg('120363001@g.us', 'link do grupo'));
  assert.equal(e.wpp.enviados.at(-1)!.jid.endsWith('@g.us'), false, 'mensagem em grupo não ganha resposta');
  e.avancar(13 * 3600_000);
  await s.eventoWhatsApp(e.ctx, chave.chave, chave.token_webhook, msg('5511999990001@s.whatsapp.net', 'grupo'));
  assert.match(e.wpp.enviados.at(-1)!.texto, /Entre aqui/);
  // Pausa geral também segura as respostas.
  e.db.prepare('UPDATE config_conta SET pausado = 1').run();
  const n = e.wpp.enviados.length;
  await s.eventoWhatsApp(e.ctx, chave.chave, chave.token_webhook, msg('5511999990002@s.whatsapp.net', 'grupo'));
  assert.equal(e.wpp.enviados.length, n);
});

test('próximas datas: Black Friday de 2026 cai em 27/11', () => {
  const d = v6.proximasDatas(new Date('2026-11-11T10:00:00').getTime(), 6);
  assert.deepEqual(d[0], { nome: '11.11 da Shopee', data: '2026-11-11', dias: 0, dica: d[0].dica });
  const bf = d.find((x) => x.nome === 'Black Friday')!;
  assert.equal(bf.data, '2026-11-27'); assert.equal(bf.dias, 16);
  assert.equal(d.find((x) => x.nome === 'Cyber Monday')!.data, '2026-11-30');
  assert.equal(v6.proximasDatas(new Date('2027-04-20T10:00:00').getTime()).find((x) => x.nome === 'Dia das Mães')!.data, '2027-05-09');
});

test('página de vendas: conta visitas e cliques por origem e ignora robôs', async () => {
  const db = abrirBanco(':memory:');
  const ctx = { db, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'http://localhost' };
  const app = { cfg: { porta: 0, urlPublica: 'https://ofertix.cloud', arquivoBanco: ':memory:', segredoSessao: 'x'.repeat(32), portalUrl: 'https://portal.exemplo', portalChavePublica: '', dev: false, evolutionUrl: '', evolutionApiKey: '', adminEmails: [] }, real: ctx, demo: { ...ctx, db: abrirBanco(':memory:') } };
  const srv = criarServidor(app as any).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  try {
    const nav = { 'user-agent': 'Mozilla/5.0 (iPhone)' };
    const html = await (await fetch(base + '/?o=instagram', { headers: nav })).text();
    assert.match(html, /piloto automático/);
    assert.match(html, /href="\/quero\?o=instagram&amp;p=pro"|href="\/quero\?o=instagram&p=pro"/);
    assert.match(html, /R\$ 97/);
    await fetch(base + '/', { headers: { 'user-agent': 'facebookexternalhit/1.1' } });
    const r = await fetch(base + '/quero?o=instagram&p=pro', { headers: nav, redirect: 'manual' });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), 'https://portal.exemplo/teste?sis=ofertix');
    const r2 = await fetch(base + '/ver-demo?o=instagram', { headers: nav, redirect: 'manual' });
    assert.equal(r2.headers.get('location'), '/demo');
    const rel = v6.relatorioSite(db, 30);
    assert.deepEqual([rel.visitas, rel.testes, rel.demos], [1, 1, 1]);
    assert.deepEqual(rel.origens[0], { origem: 'instagram', visitas: 1, testes: 1, demos: 1, zaps: 0 });
    assert.deepEqual(rel.planos, [{ plano: 'pro', n: 1 }]);
    assert.match(await (await fetch(base + '/robots.txt')).text(), /Disallow: \/painel/);
  } finally { srv.close(); }
  // Origem estranha não entra no HTML.
  assert.doesNotMatch(paginaVendas({ urlPublica: 'https://x', portalUrl: 'https://p', origem: v6.limparOrigemSite('"><script>') }), /"><script>/);
});
