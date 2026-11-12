// Testes das melhorias da v2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { expandirVariacoes, montarMensagem, temVariacoes } from '../src/mensagem.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';

const MIN = 60_000, HORA = 3600_000;

function ambiente(hora = '12:00', f: typeof fetch = (async () => new Response('<meta property="og:title" content="Produto">', { status: 200 })) as any) {
  const db = abrirBanco(':memory:');
  const wpp = new WhatsAppSimulado();
  let relogio = new Date(`2026-11-10T${hora}:00`).getTime();
  const ctx: s.Ctx = { db, wpp, f, urlPublica: 'https://ofertix.teste', agora: () => relogio };
  const conta = contaPorEmail(db, 'ana@exemplo.com', 'Ana').id;
  return { db, wpp, ctx, conta, avancar: (ms: number) => { relogio += ms; }, ir: (h: string) => { relogio = new Date(`2026-11-10T${h}:00`).getTime(); }, agora: () => relogio };
}

async function preparar(e: ReturnType<typeof ambiente>, gruposEnvio = 2) {
  const inst = await s.novaInstancia(e.ctx, e.conta, 'Principal');
  await s.atualizarEstado(e.ctx, e.conta, inst);
  const grupos = (e.db.prepare('SELECT id FROM grupos WHERE conta_id = ? ORDER BY id').all(e.conta) as any[]).map((g) => Number(g.id));
  for (const g of grupos.slice(0, gruposEnvio)) s.alternarGrupo(e.db, e.conta, g, 'enviar', true);
  return { inst, grupos };
}

function novaOferta(e: ReturnType<typeof ambiente>, extra: Partial<s.NovaOferta> = {}) {
  return s.salvarOferta(e.ctx, e.conta, {
    plataforma: 'mercadolivre', urlOriginal: 'https://produto.mercadolivre.com.br/MLB-0' + Math.random(), urlAfiliado: 'https://produto.mercadolivre.com.br/MLB-0?matt_tool=ana-20',
    titulo: 'Kindle', imagem: '', precoDe: 59900, precoPor: 44900, comissaoPct: 4, ...extra,
  });
}

async function mandarTudo(e: ReturnType<typeof ambiente>) {
  await s.despachar(e.ctx);
  for (let i = 0; i < 10; i++) { e.avancar(2 * MIN); await s.processarFila(e.ctx); }
}

// 1 e 2: cliques e ranking
test('link curto por grupo conta cliques (sem robôs) e alimenta o ranking', async () => {
  const e = ambiente();
  const { grupos } = await preparar(e);
  const id = novaOferta(e);
  const o = s.oferta(e.db, e.conta, id);
  s.agendar(e.ctx, e.conta, { ofertaId: id, texto: s.textoOferta(e.db, e.conta, o) });
  await mandarTudo(e);
  assert.equal(e.wpp.enviados.length, 2);
  const codigos = e.wpp.enviados.map((m) => m.texto.match(/https:\/\/ofertix\.teste\/r\/(\w+)/)?.[1]);
  assert.ok(codigos[0] && codigos[1] && codigos[0] !== codigos[1], 'um link por grupo');
  assert.ok(!e.wpp.enviados[0].texto.includes('matt_tool=ana-20'), 'o link de afiliado fica escondido atrás do link curto');
  assert.equal(s.registrarClique(e.ctx, codigos[0]!, 'Mozilla/5.0 (iPhone)'), 'https://produto.mercadolivre.com.br/MLB-0?matt_tool=ana-20');
  s.registrarClique(e.ctx, codigos[0]!, 'Mozilla/5.0 (Android)');
  s.registrarClique(e.ctx, codigos[1]!, 'WhatsApp/2.23.20 A');
  s.registrarClique(e.ctx, codigos[1]!, 'facebookexternalhit/1.1');
  assert.equal(s.registrarClique(e.ctx, 'naoexiste', 'Mozilla'), null);
  const v = s.visaoGeral(e.ctx, e.conta, 'hoje');
  assert.equal(v.cliques, 2);
  assert.equal(v.cliquesPorEnvio, 1);
  assert.equal(v.topOfertas[0].cliques, 2);
  assert.equal(v.topOfertas[0].envios, 2);
  assert.equal(v.topGrupos[0].id, grupos[0]);
  // Desligado: o link de afiliado vai direto.
  e.db.prepare('UPDATE config_conta SET contar_cliques = 0, repeticao_horas = 0').run();
  s.agendar(e.ctx, e.conta, { ofertaId: id, texto: s.textoOferta(e.db, e.conta, o) });
  await mandarTudo(e);
  assert.ok(e.wpp.enviados.at(-1)!.texto.includes('matt_tool=ana-20'));
});

// 3: lote
test('vários links de uma vez viram ofertas agendadas e espaçadas', async () => {
  const e = ambiente();
  await preparar(e);
  const r = await s.ofertasEmLote(e.ctx, e.conta, ['https://www.amazon.com.br/dp/A1', 'https://site-qualquer.com/x', 'https://www.amazon.com.br/dp/A2', 'https://www.amazon.com.br/dp/A1'], { espacoMin: 30 });
  assert.equal(r.criadas.length, 2, 'repetido conta uma vez');
  assert.equal(r.erros.length, 1);
  assert.equal(r.criadas[1].quando - r.criadas[0].quando, 30 * MIN);
  const origem = (e.db.prepare('SELECT DISTINCT origem FROM agendamentos').all() as any[]).map((x) => x.origem);
  assert.deepEqual(origem, ['lote']);
  await assert.rejects(s.ofertasEmLote(e.ctx, e.conta, Array.from({ length: 21 }, (_, i) => `https://amazon.com.br/dp/${i}`), {}), /20 links/);
});

// 4: vitrine e horários
test('horários automáticos publicam a oferta mais antiga da vitrine, uma vez por horário', async () => {
  assert.deepEqual(s.lerHorarios('9h, 12:30; 18:00 21h 25:00 abc 9:00'), ['09:00', '12:30', '18:00', '21:00']);
  const e = ambiente('12:05');
  await preparar(e);
  const a = novaOferta(e, { titulo: 'Primeira' });
  const b = novaOferta(e, { titulo: 'Segunda' });
  s.alternarVitrine(e.db, e.conta, a, true);
  s.alternarVitrine(e.db, e.conta, b, true);
  e.db.prepare("UPDATE ofertas SET vitrine_em = id WHERE vitrine = 1").run();
  e.db.prepare("UPDATE config_conta SET horarios_auto = '09:00, 12:00, 18:00'").run();
  assert.equal(s.rodarHorarios(e.ctx), 1);
  assert.equal(s.rodarHorarios(e.ctx), 0, 'o mesmo horário não publica duas vezes');
  const ag = e.db.prepare('SELECT oferta_id, origem FROM agendamentos').all() as any[];
  assert.deepEqual(ag.map((x) => [x.oferta_id, x.origem]), [[a, 'vitrine']]);
  assert.equal((e.db.prepare('SELECT vitrine FROM ofertas WHERE id = ?').get(a) as any).vitrine, 0);
  // Servidor desligado às 18h e ligado às 18:40: esse horário passou e é ignorado.
  e.ir('18:40');
  assert.equal(s.rodarHorarios(e.ctx), 0);
  assert.equal((e.db.prepare('SELECT vitrine FROM ofertas WHERE id = ?').get(b) as any).vitrine, 1);
  assert.ok(s.avisos(e.ctx, e.conta).every((x) => !x.texto.includes('vitrine está vazia')));
});

// 5: janela
test('janela de envio: nada sai de madrugada e a fila espera a próxima abertura', async () => {
  assert.equal(s.dentroDaJanela(new Date('2026-11-10T07:59:00').getTime(), 8, 22), false);
  assert.equal(s.dentroDaJanela(new Date('2026-11-10T08:00:00').getTime(), 8, 22), true);
  assert.equal(s.dentroDaJanela(new Date('2026-11-10T23:30:00').getTime(), 18, 2), true, 'janela que passa da meia-noite');
  assert.equal(s.dentroDaJanela(new Date('2026-11-10T03:00:00').getTime(), 0, 0), true, 'mesmo horário = 24 h');
  assert.equal(s.proximaAbertura(new Date('2026-11-10T23:00:00').getTime(), 8, 22), new Date('2026-11-11T08:00:00').getTime());

  const e = ambiente('23:00');
  await preparar(e);
  s.agendar(e.ctx, e.conta, { texto: 'Oferta da noite' });
  assert.equal(await s.despachar(e.ctx), 0);
  assert.equal((e.db.prepare('SELECT status FROM agendamentos').get() as any).status, 'pendente');

  // Fila que já estava montada quando a janela fechou vai inteira para as 8h, com o mesmo espaçamento.
  e.ir('21:59');
  s.cancelarAgendamento(e.db, e.conta, 1);
  s.agendar(e.ctx, e.conta, { texto: 'Oferta das 21:59' });
  await s.despachar(e.ctx);
  const antes = (e.db.prepare("SELECT enviar_em FROM envios ORDER BY id").all() as any[]).map((x) => x.enviar_em);
  e.ir('22:30');
  await s.processarFila(e.ctx);
  const depois = (e.db.prepare("SELECT enviar_em FROM envios ORDER BY id").all() as any[]).map((x) => x.enviar_em);
  assert.equal(e.wpp.enviados.length, 0);
  assert.equal(antes.length, 2);
  assert.equal(depois[0], new Date('2026-11-11T08:00:00').getTime());
  assert.equal(depois[1] - depois[0], antes[1] - antes[0]);
});

// 6: repetição
test('a mesma oferta não volta ao mesmo grupo dentro do prazo', async () => {
  const e = ambiente();
  const { grupos } = await preparar(e);
  const id = novaOferta(e);
  s.agendar(e.ctx, e.conta, { ofertaId: id, texto: 'A', grupos: [grupos[0]] });
  await mandarTudo(e);
  const segundo = s.agendar(e.ctx, e.conta, { ofertaId: id, texto: 'A' });
  await mandarTudo(e);
  const st = e.db.prepare('SELECT status FROM envios WHERE agendamento_id = ? ORDER BY grupo_id').all(segundo) as any[];
  assert.deepEqual(st.map((x) => x.status), ['pulado', 'enviado']);
  const terceiro = s.agendar(e.ctx, e.conta, { ofertaId: id, texto: 'A' });
  await s.despachar(e.ctx);
  const a = e.db.prepare('SELECT status, obs FROM agendamentos WHERE id = ?').get(terceiro) as any;
  assert.equal(a.status, 'cancelado');
  assert.match(a.obs, /últimas 24 h/);
  e.avancar(25 * HORA);
  s.agendar(e.ctx, e.conta, { ofertaId: id, texto: 'A' });
  assert.equal(await s.despachar(e.ctx), 1, 'depois do prazo pode de novo');
});

// 7: variações
test('variações de texto: cada envio sorteia uma opção; a prévia mostra a primeira', async () => {
  assert.equal(expandirVariacoes('{Oi|Olá|Eai} *{x}* {a|b}', true), 'Oi *{x}* a');
  let i = 0;
  const seq = [0.1, 0.9, 0.5, 0.2];
  assert.equal(expandirVariacoes('{Oi|Olá|Eai} {a|b}', false, () => seq[i++]), 'Oi b');
  assert.equal(temVariacoes(montarMensagem({ titulo: 'X', link: 'L' })), true);
  assert.equal(temVariacoes('sem chaves {titulo}'), false);
  const e = ambiente();
  await preparar(e, 3);
  s.agendar(e.ctx, e.conta, { texto: '{A|B|C|D|E|F|G|H}{1|2|3|4|5|6|7|8}' });
  await mandarTudo(e);
  assert.equal(e.wpp.enviados.length, 3);
  assert.ok(e.wpp.enviados.every((m) => /^[A-H][1-8]$/.test(m.texto)));
});

// 8: conferência de preço
test('conferência na Shopee: barra preço que subiu e produto esgotado, atualiza o resto', async () => {
  let resposta: any = { productName: 'Fone', priceMin: '99.90', priceDiscountRate: 0, commissionRate: '0.1' };
  const f = (async (u: string) => u.includes('affiliate.shopee')
    ? Response.json({ data: { productOfferV2: { nodes: resposta ? [resposta] : [] } } })
    : new Response('')) as any;
  const e = ambiente('12:00', f);
  await preparar(e);
  e.db.prepare("UPDATE config_conta SET shopee_app_id = '1', shopee_segredo = 's'").run();
  const id = novaOferta(e, { plataforma: 'shopee', urlOriginal: 'https://shopee.com.br/Fone-i.10.20', urlAfiliado: 'https://s.shopee.com.br/x', precoPor: 7990 });
  const a1 = s.agendar(e.ctx, e.conta, { ofertaId: id, texto: 'Fone' });
  await s.despachar(e.ctx);
  assert.deepEqual({ ...(e.db.prepare('SELECT status, obs FROM agendamentos WHERE id = ?').get(a1) as any) }, { status: 'cancelado', obs: 'Preço subiu de R$ 79,90 para R$ 99,90' });
  resposta = null;
  const a2 = s.agendar(e.ctx, e.conta, { ofertaId: id, texto: 'Fone' });
  await s.despachar(e.ctx);
  assert.equal((e.db.prepare('SELECT obs FROM agendamentos WHERE id = ?').get(a2) as any).obs, 'Produto indisponível na Shopee');
  assert.equal((e.db.prepare('SELECT esgotada FROM ofertas WHERE id = ?').get(id) as any).esgotada, 1);
  resposta = { productName: 'Fone', priceMin: '95.00', priceDiscountRate: 20, commissionRate: '0.12' };
  const a3 = s.agendar(e.ctx, e.conta, { ofertaId: id, texto: 'Fone' });
  await s.despachar(e.ctx);
  assert.equal((e.db.prepare('SELECT status FROM agendamentos WHERE id = ?').get(a3) as any).status, 'enviando');
  const o = e.db.prepare('SELECT esgotada, preco_por, comissao_pct FROM ofertas WHERE id = ?').get(id) as any;
  assert.deepEqual({ ...o }, { esgotada: 0, preco_por: 9500, comissao_pct: 12 });
});

// 9: resumo e avisos
test('resumo diário vai uma vez por dia no horário; avisos apontam o que precisa de atenção', async () => {
  const e = ambiente('20:30');
  const { inst } = await preparar(e);
  e.db.prepare("UPDATE config_conta SET resumo_numero = '5511988887777', resumo_hora = 21").run();
  assert.equal(await s.rodarResumos(e.ctx), 0, 'antes do horário');
  e.ir('21:01');
  assert.equal(await s.rodarResumos(e.ctx), 1);
  assert.equal(await s.rodarResumos(e.ctx), 0, 'uma vez por dia');
  const msg = e.wpp.enviados.at(-1)!;
  assert.equal(msg.jid, '5511988887777@s.whatsapp.net');
  assert.match(msg.texto, /Resumo do Ofertix/);
  e.db.prepare("UPDATE instancias SET status = 'desconectado' WHERE id = ?").run(inst);
  const av = s.avisos(e.ctx, e.conta);
  assert.ok(av.some((a) => a.nivel === 'erro' && /desconectado/.test(a.texto)));
  e.db.prepare("UPDATE config_conta SET horarios_auto = '10:00'").run();
  assert.ok(s.avisos(e.ctx, e.conta).some((a) => /vitrine está vazia/.test(a.texto)));
});

// 10: CSV
test('CSV para Excel: separador ;, acentos e proteção contra fórmulas', async () => {
  const t = s.csv([['Nome', 'Valor'], ['=HYPERLINK("x")', '1,50'], ['Ação; "teste"', -2]]);
  assert.ok(t.startsWith('﻿Nome;Valor\r\n'));
  assert.ok(t.includes(`"'=HYPERLINK(""x"")";1,50`));
  assert.ok(t.includes('"Ação; ""teste""";-2'));
  const e = ambiente();
  await preparar(e);
  s.agendar(e.ctx, e.conta, { ofertaId: novaOferta(e), texto: 'x' });
  await mandarTudo(e);
  const env = s.csvEnvios(e.ctx, e.conta, 'hoje').split('\r\n');
  assert.equal(env[0], '﻿Data;Grupo;Oferta;Loja;Origem;Situação;Cliques;Erro');
  assert.equal(env.filter(Boolean).length, 3);
  assert.match(s.csvComissoes(e.ctx, e.conta, '30d'), /Comissão \(R\$\)/);
});

test('banco da v1 ganha as colunas novas ao abrir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ofx-'));
  const arq = join(dir, 'v1.db');
  const velho = new DatabaseSync(arq);
  velho.exec("CREATE TABLE contas (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, nome TEXT NOT NULL DEFAULT '', plano TEXT NOT NULL DEFAULT 'teste', criado_em INTEGER NOT NULL);");
  velho.exec('CREATE TABLE config_conta (conta_id INTEGER PRIMARY KEY, shopee_app_id TEXT NOT NULL DEFAULT \'\');');
  velho.exec("INSERT INTO contas (email, criado_em) VALUES ('a@b.c', 1); INSERT INTO config_conta (conta_id) VALUES (1);");
  velho.close();
  const db = abrirBanco(arq);
  const c = db.prepare('SELECT janela_inicio, janela_fim, repeticao_horas, contar_cliques FROM config_conta').get() as any;
  assert.deepEqual({ ...c }, { janela_inicio: 8, janela_fim: 22, repeticao_horas: 24, contar_cliques: 1 });
});

test('servidor: /r/ redireciona e conta; CSV sai com cabeçalho de download', async () => {
  const { criarServidor } = await import('../src/servidor.ts');
  const { assinarSessao } = await import('../src/portal.ts');
  const e = ambiente();
  const demo = abrirBanco(':memory:');
  e.db.prepare("INSERT INTO links (codigo, conta_id, destino, criado_em) VALUES ('abc1234', ?, 'https://loja.com/p', 1)").run(e.conta);
  const app = {
    cfg: { porta: 0, urlPublica: 'http://localhost', arquivoBanco: ':memory:', segredoSessao: 'seg', portalUrl: 'https://mssolucoestech.com.br', portalChavePublica: '', dev: false, evolutionUrl: '', evolutionApiKey: '', adminEmails: [] },
    real: { ...e.ctx, agora: undefined }, demo: { db: demo, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'http://localhost' },
  };
  const srv = criarServidor(app as any).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://localhost:${(srv.address() as any).port}`;
  try {
    const r = await fetch(base + '/r/abc1234', { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0' } });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), 'https://loja.com/p');
    assert.equal((e.db.prepare('SELECT COUNT(*) AS n FROM cliques').get() as any).n, 1);
    assert.equal((await fetch(base + '/r/zzzzzzz', { redirect: 'manual' })).status, 404);
    const cookie = 'ofx=' + assinarSessao({ conta: e.conta, email: 'ana@exemplo.com', nome: 'Ana', demo: false, admin: false, leitura: false, exp: Date.now() + 60_000 }, 'seg');
    const c = await fetch(base + '/api/exportar/envios.csv?periodo=30d', { headers: { cookie } });
    assert.equal(c.status, 200);
    assert.match(c.headers.get('content-disposition') ?? '', /ofertix-envios-30d\.csv/);
    const av = await (await fetch(base + '/api/avisos', { headers: { cookie } })).json();
    assert.ok(Array.isArray(av) && av.some((a: any) => a.link === '#whatsapp'));
    const h = { cookie, 'x-ofertix': '1', 'content-type': 'application/json' };
    const bad = await fetch(base + '/api/config', { method: 'POST', headers: h, body: JSON.stringify({ resumo_numero: '1199' }) });
    assert.equal(bad.status, 400);
    await fetch(base + '/api/config', { method: 'POST', headers: h, body: JSON.stringify({ janela_inicio: 7, janela_fim: 23, repeticao_horas: 12, horarios_auto: '9h,21h', contar_cliques: true, resumo_numero: '+55 (11) 98888-7777', resumo_hora: 20 }) });
    const cfg = await (await fetch(base + '/api/config', { headers: { cookie } })).json();
    assert.deepEqual([cfg.janela_inicio, cfg.janela_fim, cfg.repeticao_horas, cfg.horarios_auto, cfg.resumo_numero, cfg.conferir_preco], [7, 23, 12, '09:00, 21:00', '5511988887777', 0]);
    const pv = await (await fetch(base + '/api/previa', { method: 'POST', headers: h, body: '{"modelo":""}' })).json();
    assert.equal(pv.variacoes, true);
    assert.ok(pv.texto.startsWith('🔥 *Air Fryer'));
  } finally { srv.close(); }
});
