// Testes do link de entrada inteligente (v3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';
import * as ent from '../src/entradas.ts';

async function ambiente() {
  const db = abrirBanco(':memory:');
  const wpp = new WhatsAppSimulado();
  let relogio = new Date('2026-11-11T12:00:00').getTime();
  const ctx: s.Ctx = { db, wpp, f: fetch, urlPublica: 'https://ofertix.teste', agora: () => relogio };
  const conta = contaPorEmail(db, 'moca@exemplo.com', 'Moça').id;
  const inst = await s.novaInstancia(ctx, conta, 'Principal');
  await s.atualizarEstado(ctx, conta, inst);
  db.prepare('UPDATE grupos SET participantes = 100').run();
  const grupos = (db.prepare('SELECT id, jid FROM grupos WHERE conta_id = ? ORDER BY id').all(conta) as any[]).map((g) => Number(g.id));
  return { db, wpp, ctx, conta, inst, grupos, avancar: (ms: number) => { relogio += ms; } };
}

test('endereço da página: validação, reservados e uso único', async () => {
  const e = await ambiente();
  assert.equal(ent.slugValido('achadinhos-da-moca'), true);
  for (const ruim of ['ab', 'Achadinhos', 'com espaço', '-comeca', 'termina-', 'duplo--hifen', 'admin', 'exemplo-achadinhos', 'a'.repeat(41)]) assert.equal(ent.slugValido(ruim), false, ruim);
  ent.criarEntrada(e.ctx, e.conta, { slug: 'achadinhos-da-moca', titulo: 'Achadinhos da Moça' });
  assert.throws(() => ent.criarEntrada(e.ctx, e.conta, { slug: 'achadinhos-da-moca', titulo: 'Outro' }), /já está em uso/);
  assert.throws(() => ent.criarEntrada(e.ctx, e.conta, { slug: 'sem-titulo', titulo: ' ' }), /nome/);
  for (let i = 0; i < 4; i++) ent.criarEntrada(e.ctx, e.conta, { slug: `pagina-${i}`, titulo: 'P' });
  assert.throws(() => ent.criarEntrada(e.ctx, e.conta, { slug: 'pagina-extra', titulo: 'P' }), /no máximo 5/);
});

test('rodízio: manda para o primeiro grupo com vaga e passa para o próximo quando lota', async () => {
  const e = await ambiente();
  const id = ent.criarEntrada(e.ctx, e.conta, { slug: 'achadinhos-da-moca', titulo: 'Achadinhos da Moça', cor: '#E8457C', foto: 'javascript:alert(1)' });
  assert.equal((e.db.prepare('SELECT foto, cor FROM entradas WHERE id = ?').get(id) as any).foto, '', 'só aceita foto https');
  const beleza = ent.adicionarTema(e.ctx, e.conta, id, { nome: 'Beleza e skincare', emoji: '💄' });
  ent.definirGruposTema(e.ctx, e.conta, beleza, [e.grupos[0], e.grupos[1]]);
  // Sem convite, o grupo fica fora do rodízio.
  assert.equal(ent.irParaGrupo(e.ctx, 'achadinhos-da-moca', beleza, 'bio')!.url, null);
  const conv = await ent.buscarConvite(e.ctx, e.conta, e.grupos[0]);
  assert.match(conv, /^https:\/\/chat\.whatsapp\.com\//);
  ent.ajustarGrupo(e.ctx, e.conta, e.grupos[1], { convite: 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOp', limite: 1000 });
  assert.throws(() => ent.ajustarGrupo(e.ctx, e.conta, e.grupos[1], { convite: 'https://golpe.com/x' }), /chat\.whatsapp\.com/);
  assert.equal(ent.irParaGrupo(e.ctx, 'achadinhos-da-moca', beleza, 'stories')!.url, conv);
  e.db.prepare('UPDATE grupos SET participantes = 1000 WHERE id = ?').run(e.grupos[0]);
  assert.equal(ent.irParaGrupo(e.ctx, 'achadinhos-da-moca', beleza, 'stories')!.url, 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOp');
  e.db.prepare('UPDATE grupos SET participantes = 1000 WHERE id = ?').run(e.grupos[1]);
  assert.equal(ent.irParaGrupo(e.ctx, 'achadinhos-da-moca', beleza, 'reels')!.url, null, 'todos lotados');
  const av = s.avisos(e.ctx, e.conta);
  assert.ok(av.some((a) => a.nivel === 'erro' && /lotaram/.test(a.texto)));
  assert.equal(ent.irParaGrupo(e.ctx, 'nao-existe', beleza, '')?.url, undefined);
  assert.equal(ent.irParaGrupo(e.ctx, 'achadinhos-da-moca', 99999, ''), null, 'tema de outra página');
});

test('página pública: temas, prova social, aviso de afiliado e escape de texto', async () => {
  const e = await ambiente();
  const id = ent.criarEntrada(e.ctx, e.conta, { slug: 'achadinhos-da-moca', titulo: 'Achadinhos <da> Moça', descricao: 'Ofertas "garimpadas"' });
  const t1 = ent.adicionarTema(e.ctx, e.conta, id, { nome: 'Casa', emoji: '🏠' });
  const t2 = ent.adicionarTema(e.ctx, e.conta, id, { nome: 'Moda', emoji: '👗' });
  ent.definirGruposTema(e.ctx, e.conta, t1, [e.grupos[0]]);
  ent.definirGruposTema(e.ctx, e.conta, t2, [e.grupos[1]]);
  await ent.buscarConvite(e.ctx, e.conta, e.grupos[0]);
  const d = ent.abrirEntrada(e.ctx, 'achadinhos-da-moca', 'Stories!!')!;
  assert.equal(d.temas.length, 2);
  assert.deepEqual(d.temas.map((x) => x.vagas), [true, false]);
  const html = ent.paginaEntrada(d, '/g/achadinhos-da-moca', ent.limparOrigem('Stories!!'));
  assert.ok(html.includes('Achadinhos &lt;da&gt; Moça'));
  assert.ok(html.includes(`/g/achadinhos-da-moca/${t1}?o=stories`), 'origem segue no clique');
  assert.ok(html.includes('pessoas já estão nos grupos'));
  assert.ok(html.includes('links de afiliado'));
  assert.ok(html.includes('Lotado'));
  ent.atualizarEntrada(e.ctx, e.conta, id, { aviso_afiliado: false, ativo: false });
  assert.equal(ent.abrirEntrada(e.ctx, 'achadinhos-da-moca', ''), null, 'página desativada');
});

test('painel: visitas, cliques, lotados e origem de cada acesso', async () => {
  const e = await ambiente();
  const id = ent.criarEntrada(e.ctx, e.conta, { slug: 'achadinhos-da-moca', titulo: 'Achadinhos' });
  const t1 = ent.adicionarTema(e.ctx, e.conta, id, { nome: 'Casa' });
  ent.definirGruposTema(e.ctx, e.conta, t1, [e.grupos[0]]);
  await ent.buscarConvite(e.ctx, e.conta, e.grupos[0]);
  for (let i = 0; i < 4; i++) ent.abrirEntrada(e.ctx, 'achadinhos-da-moca', 'stories');
  ent.abrirEntrada(e.ctx, 'achadinhos-da-moca', 'bio');
  for (let i = 0; i < 3; i++) ent.irParaGrupo(e.ctx, 'achadinhos-da-moca', t1, 'stories');
  ent.irParaGrupo(e.ctx, 'achadinhos-da-moca', t1, 'bio');
  const i = e.db.prepare('SELECT chave, token_webhook FROM instancias').get() as any;
  const jid = (e.db.prepare('SELECT jid FROM grupos WHERE id = ?').get(e.grupos[0]) as any).jid;
  await s.eventoWhatsApp(e.ctx, i.chave, i.token_webhook, { event: 'group-participants.update', data: { id: jid, participants: ['a', 'b', 'c'], action: 'add' } });
  const [p] = ent.painelEntradas(e.ctx, e.conta, 'hoje');
  assert.equal(p.visitas, 5);
  assert.equal(p.cliques, 4);
  assert.equal(p.entraram, 3);
  assert.deepEqual(p.origens[0], { origem: 'stories', visitas: 4, cliques: 3 });
  assert.equal(p.temas[0].ativo, e.grupos[0]);
  assert.equal(p.temas[0].cliques, 4);
});

test('servidor: /g/ mostra a página e o clique redireciona para o convite', async () => {
  const { criarServidor } = await import('../src/servidor.ts');
  const e = await ambiente();
  const id = ent.criarEntrada(e.ctx, e.conta, { slug: 'achadinhos-da-moca', titulo: 'Achadinhos da Moça' });
  const t1 = ent.adicionarTema(e.ctx, e.conta, id, { nome: 'Casa', emoji: '🏠' });
  ent.definirGruposTema(e.ctx, e.conta, t1, [e.grupos[0]]);
  const conv = await ent.buscarConvite(e.ctx, e.conta, e.grupos[0]);
  const app = {
    cfg: { porta: 0, urlPublica: 'http://localhost', arquivoBanco: ':memory:', segredoSessao: 'seg', portalUrl: 'https://mssolucoestech.com.br', portalChavePublica: '', dev: false, evolutionUrl: '', evolutionApiKey: '', adminEmails: [] },
    real: { ...e.ctx, agora: undefined }, demo: { db: abrirBanco(':memory:'), wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'http://localhost' },
  };
  const srv = criarServidor(app as any).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://localhost:${(srv.address() as any).port}`;
  try {
    const pg = await fetch(base + '/g/achadinhos-da-moca?o=bio');
    assert.equal(pg.status, 200);
    assert.match(await pg.text(), /Achadinhos da Moça/);
    const ir = await fetch(base + `/g/achadinhos-da-moca/${t1}?o=bio`, { redirect: 'manual' });
    assert.equal(ir.status, 302);
    assert.equal(ir.headers.get('location'), conv);
    e.db.prepare('UPDATE grupos SET participantes = 2000 WHERE id = ?').run(e.grupos[0]);
    const lot = await fetch(base + `/g/achadinhos-da-moca/${t1}`, { redirect: 'manual' });
    assert.equal(lot.status, 200);
    assert.match(await lot.text(), /lotaram/);
    assert.equal((await fetch(base + '/g/nao-existe')).status, 404);
  } finally { srv.close(); }
});
