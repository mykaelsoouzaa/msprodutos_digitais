import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { conferirAcessoPortal, usarAcesso, assinarSessao, lerSessao } from '../src/portal.ts';
import { extrairLinks, plataformaDe, idsShopee, linkAmazon, linkModelo, lerPagina } from '../src/links.ts';
import { montarMensagem } from '../src/mensagem.ts';
import { cabecalhoShopee, linkCurtoShopee, produtoShopee, comissoesShopee } from '../src/shopee.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import { semearDemo } from '../src/demo.ts';
import * as s from '../src/servico.ts';
import { criarServidor } from '../src/servidor.ts';

// ---------------- auxiliares ----------------
function ambiente(f: typeof fetch = (async () => new Response('', { status: 404 })) as any) {
  const db = abrirBanco(':memory:');
  const wpp = new WhatsAppSimulado();
  let relogio = new Date('2026-11-10T12:00:00').getTime();
  const ctx: s.Ctx = { db, wpp, f, urlPublica: 'https://ofertix.teste', agora: () => relogio };
  const c = contaPorEmail(db, 'ana@exemplo.com', 'Ana');
  return { db, wpp, ctx, conta: c.id, avancar: (ms: number) => { relogio += ms; }, agora: () => relogio };
}

async function comGrupos(e: ReturnType<typeof ambiente>) {
  const inst = await s.novaInstancia(e.ctx, e.conta, 'Principal');
  await s.atualizarEstado(e.ctx, e.conta, inst);
  const grupos = e.db.prepare('SELECT id FROM grupos WHERE conta_id = ? ORDER BY id').all(e.conta) as any[];
  return { inst, grupos: grupos.map((g) => Number(g.id)) };
}

const chaves = generateKeyPairSync('ed25519');
const PEM = chaves.publicKey.export({ type: 'spki', format: 'pem' }).toString();
function tokenPortal(dados: Record<string, unknown>) {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  const cab = b({ alg: 'EdDSA', typ: 'JWT' });
  const corpo = b({ iss: 'https://mssolucoestech.com.br', aud: 'ofertix', iat: agora, exp: agora + 60, jti: 'j' + Math.random(), email: 'Ana@Exemplo.com', nome: 'Ana', ...dados });
  return `${cab}.${corpo}.${sign(null, Buffer.from(`${cab}.${corpo}`), chaves.privateKey).toString('base64url')}`;
}

// ---------------- portal e sessão ----------------
test('acesso do portal: confere assinatura, sistema, validade e uso único', () => {
  const opts = { chave: PEM, emissor: 'https://mssolucoestech.com.br' };
  const ok = conferirAcessoPortal(tokenPortal({}), opts);
  assert.equal(ok?.email, 'ana@exemplo.com');
  assert.equal(conferirAcessoPortal(tokenPortal({ aud: 'nina' }), opts), null);
  assert.equal(conferirAcessoPortal(tokenPortal({ exp: 1 }), opts), null);
  assert.equal(conferirAcessoPortal(tokenPortal({ iss: 'https://outro.com' }), opts), null);
  const t = tokenPortal({});
  assert.equal(conferirAcessoPortal(t.slice(0, -3) + 'abc', opts), null);
  const db = abrirBanco(':memory:');
  assert.equal(usarAcesso(db, 'x1', 9e9), true);
  assert.equal(usarAcesso(db, 'x1', 9e9), false);
});

test('sessão em cookie: assinada e com validade', () => {
  const v = assinarSessao({ conta: 1, email: 'a@b.c', nome: '', demo: false, admin: false, leitura: false, exp: Date.now() + 1000 }, 'seg');
  assert.equal(lerSessao(v, 'seg')?.conta, 1);
  assert.equal(lerSessao(v, 'outro'), null);
  assert.equal(lerSessao(v.replace(/^./, 'x'), 'seg'), null);
  assert.equal(lerSessao(v, 'seg', Date.now() + 5000), null);
});

// ---------------- links e mensagem ----------------
test('links: extrai, reconhece a loja e gera link de afiliado', () => {
  assert.deepEqual(extrairLinks('Olha! https://s.shopee.com.br/abc). e https://amzn.to/x*'), ['https://s.shopee.com.br/abc', 'https://amzn.to/x']);
  assert.equal(plataformaDe('https://shopee.com.br/x-i.1.2'), 'shopee');
  assert.equal(plataformaDe('https://produto.mercadolivre.com.br/MLB-1'), 'mercadolivre');
  assert.equal(plataformaDe('https://www.amazon.com.br/dp/B0'), 'amazon');
  assert.equal(plataformaDe('https://www.magazineluiza.com.br/p/1'), 'magalu');
  assert.equal(plataformaDe('https://golpe.com/shopee.com.br'), 'outra');
  assert.deepEqual(idsShopee('https://shopee.com.br/Air-Fryer-i.123.456?sp=1'), { shopId: '123', itemId: '456' });
  assert.deepEqual(idsShopee('https://shopee.com.br/product/9/8'), { shopId: '9', itemId: '8' });
  assert.equal(linkAmazon('https://www.amazon.com.br/dp/B0?tag=outro-20&x=1', 'ana-20'), 'https://www.amazon.com.br/dp/B0?x=1&tag=ana-20');
  assert.equal(linkModelo('https://ml.com/p', 'matt_tool=1&matt_word=ana'), 'https://ml.com/p?matt_tool=1&matt_word=ana');
  assert.equal(linkModelo('https://ml.com/p', 'https://go.ml/?u={url}'), 'https://go.ml/?u=https%3A%2F%2Fml.com%2Fp');
  const pg = lerPagina('<meta property="og:title" content="Fone &amp; Estojo"><meta content="https://img/x.jpg" property="og:image"><meta property="product:price:amount" content="79.90">');
  assert.deepEqual(pg, { titulo: 'Fone & Estojo', imagem: 'https://img/x.jpg', preco: 7990 });
});

test('mensagem: modelo padrão com preço riscado, desconto e cupom', () => {
  const t = montarMensagem({ titulo: 'Air Fryer', precoDe: 39990, precoPor: 21990, link: 'https://l', cupom: 'PIPOCA10' });
  assert.match(t, /\*Air Fryer\*/);
  assert.match(t, /De ~R\$\s399,90~/);
  assert.match(t, /Por \*R\$\s219,90\* \(45% OFF\)/);
  assert.match(t, /Cupom: \*PIPOCA10\*/);
  const sem = montarMensagem({ titulo: 'X', precoPor: 1000, link: 'https://l' });
  assert.doesNotMatch(sem, /De ~|Cupom|\n\n\n/);
  assert.equal(montarMensagem({ titulo: 'X', link: 'L' }, '{titulo} -> {link} {nada}'), 'X -> L {nada}');
});

// ---------------- Shopee ----------------
test('Shopee: assinatura e leitura das respostas', async () => {
  const payload = '{"query":"x"}';
  const h = cabecalhoShopee({ appId: '123', segredo: 'abc' }, payload, 1700000000);
  assert.equal(h, `SHA256 Credential=123, Timestamp=1700000000, Signature=${createHash('sha256').update(`1231700000000${payload}abc`).digest('hex')}`);
  const pedidos: string[] = [];
  const f = (async (_u: string, init: any) => {
    const q = JSON.parse(init.body).query as string;
    pedidos.push(q);
    assert.match(init.headers.authorization, /^SHA256 Credential=123/);
    if (q.includes('generateShortLink')) return Response.json({ data: { generateShortLink: { shortLink: 'https://s.shopee.com.br/curto' } } });
    if (q.includes('productOfferV2')) return Response.json({ data: { productOfferV2: { nodes: [{ productName: 'Air Fryer', imageUrl: 'https://img', priceMin: '219.90', priceDiscountRate: 45, commissionRate: '0.08' }] } } });
    return Response.json({ data: { conversionReport: { nodes: [{ purchaseTime: 1700000000, orders: [{ orderId: 'P1', orderStatus: 'COMPLETED', items: [{ itemName: 'Air Fryer', actualAmount: '219.90', itemTotalCommission: '17.59' }] }] }], pageInfo: { hasNextPage: false } } } });
  }) as any;
  const cred = { appId: '123', segredo: 'abc' };
  assert.equal(await linkCurtoShopee(cred, 'https://shopee.com.br/x-i.1.2', 'ofertix', f), 'https://s.shopee.com.br/curto');
  const p = await produtoShopee(cred, '1', '2', f);
  assert.equal(p?.precoPor, 21990);
  assert.equal(p?.precoDe, 39982);
  assert.equal(p?.comissaoPct, 8);
  const c = await comissoesShopee(cred, 0, 1, f);
  assert.deepEqual(c[0], { pedido: 'P1', produto: 'Air Fryer', valor: 21990, comissao: 1759, status: 'concluido', em: 1700000000000 });
  const erro = (async () => Response.json({ errors: [{ message: 'Invalid Signature' }] })) as any;
  await assert.rejects(linkCurtoShopee(cred, 'u', 'x', erro), /Invalid Signature/);
});

test('converter link da Shopee com credenciais usa a API; Amazon usa a tag', async () => {
  const f = (async (u: string, init: any) => {
    if (u.includes('affiliate.shopee')) {
      const q = JSON.parse(init.body).query;
      if (q.includes('generateShortLink')) return Response.json({ data: { generateShortLink: { shortLink: 'https://s.shopee.com.br/aff' } } });
      return Response.json({ data: { productOfferV2: { nodes: [{ productName: 'Fone', imageUrl: 'https://img', priceMin: '79.90', priceDiscountRate: 60, commissionRate: '0.15' }] } } });
    }
    if (u.startsWith('https://s.shopee.com.br/orig')) return new Response('', { status: 302, headers: { location: 'https://shopee.com.br/Fone-i.10.20?x=1' } });
    return new Response('<meta property="og:title" content="Kindle">', { status: 200 });
  }) as any;
  const e = ambiente(f);
  e.db.prepare("UPDATE config_conta SET shopee_app_id = '1', shopee_segredo = 's', amazon_tag = 'ana-20' WHERE conta_id = ?").run(e.conta);
  const o = await s.converterLink(e.ctx, e.conta, 'https://s.shopee.com.br/orig');
  assert.equal(o.urlOriginal, 'https://shopee.com.br/Fone-i.10.20');
  assert.equal(o.urlAfiliado, 'https://s.shopee.com.br/aff');
  assert.equal(o.titulo, 'Fone');
  assert.equal(o.comissaoPct, 15);
  const a = await s.converterLink(e.ctx, e.conta, 'https://www.amazon.com.br/dp/B01');
  assert.equal(a.urlAfiliado, 'https://www.amazon.com.br/dp/B01?tag=ana-20');
  assert.equal(a.titulo, 'Kindle');
  await assert.rejects(s.converterLink(e.ctx, e.conta, 'https://loja-qualquer.com/p'), /aceita links/);
  await assert.rejects(s.converterLink(e.ctx, e.conta, 'javascript:alert(1)'), /Link inválido/);
});

// ---------------- envios ----------------
test('agendamento vira envios espaçados por número e respeita o horário', async () => {
  const e = ambiente();
  const { grupos } = await comGrupos(e);
  for (const g of grupos.slice(0, 3)) s.alternarGrupo(e.db, e.conta, g, 'enviar', true);
  s.agendar(e.ctx, e.conta, { texto: 'Oferta A', quando: e.agora() + 60_000 });
  assert.equal(await s.despachar(e.ctx), 0, 'ainda não chegou a hora');
  e.avancar(60_000);
  assert.equal(await s.despachar(e.ctx), 1);
  const envios = e.db.prepare('SELECT enviar_em FROM envios ORDER BY enviar_em').all() as any[];
  assert.equal(envios.length, 3);
  for (let i = 1; i < envios.length; i++) {
    const d = envios[i].enviar_em - envios[i - 1].enviar_em;
    assert.ok(d >= 25_000 && d <= 70_000, `intervalo ${d}`);
  }
  // Manda um por rodada, quando chega a hora de cada um.
  e.avancar(70_000);
  assert.equal(await s.processarFila(e.ctx), 1);
  e.avancar(300_000);
  assert.equal(await s.processarFila(e.ctx), 1);
  assert.equal(await s.processarFila(e.ctx), 1);
  assert.equal(e.wpp.enviados.length, 3);
  assert.equal((e.db.prepare('SELECT status FROM agendamentos').get() as any).status, 'enviado');
});

test('segundo agendamento continua a fila do número, sem envios colados', async () => {
  const e = ambiente();
  const { grupos } = await comGrupos(e);
  for (const g of grupos.slice(0, 2)) s.alternarGrupo(e.db, e.conta, g, 'enviar', true);
  s.agendar(e.ctx, e.conta, { texto: 'A' });
  s.agendar(e.ctx, e.conta, { texto: 'B' });
  await s.despachar(e.ctx);
  const t = (e.db.prepare('SELECT enviar_em FROM envios ORDER BY enviar_em').all() as any[]).map((x) => x.enviar_em);
  assert.equal(t.length, 4);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= 25_000);
});

test('erro em um grupo não trava os outros; cancelar remove da fila', async () => {
  const e = ambiente();
  const { grupos } = await comGrupos(e);
  for (const g of grupos.slice(0, 2)) s.alternarGrupo(e.db, e.conta, g, 'enviar', true);
  e.wpp.falharEm.add('120363001@g.us');
  s.agendar(e.ctx, e.conta, { texto: 'A' });
  await s.despachar(e.ctx);
  e.avancar(10 * 60_000);
  await s.processarFila(e.ctx); await s.processarFila(e.ctx);
  const st = (e.db.prepare('SELECT status FROM envios ORDER BY id').all() as any[]).map((x) => x.status);
  assert.deepEqual(st, ['erro', 'enviado']);
  assert.equal((e.db.prepare('SELECT status FROM agendamentos').get() as any).status, 'enviado');
  const id = s.agendar(e.ctx, e.conta, { texto: 'B', quando: e.agora() + 3600_000 });
  s.cancelarAgendamento(e.db, e.conta, id);
  assert.throws(() => s.cancelarAgendamento(e.db, e.conta, id), /não pode/);
});

test('limites do plano: números, grupos de envio, captura e envios por dia', async () => {
  const e = ambiente();
  const { grupos } = await comGrupos(e);
  await assert.rejects(s.novaInstancia(e.ctx, e.conta, 'Outro'), /1 número/);
  for (const g of grupos.slice(0, 3)) s.alternarGrupo(e.db, e.conta, g, 'enviar', true);
  assert.throws(() => s.alternarGrupo(e.db, e.conta, grupos[3], 'enviar', true), /3 grupo/);
  e.db.prepare("UPDATE contas SET plano = 'inicial' WHERE id = ?").run(e.conta);
  assert.throws(() => s.alternarGrupo(e.db, e.conta, grupos[3], 'monitorar', true), /captura/);
  assert.throws(() => s.agendar(e.ctx, e.conta, { texto: '' }), /texto/);
  // Limite diário: plano de teste = 100 por número (aquecimento desligado, ele tem teste próprio).
  e.db.prepare('UPDATE config_conta SET aquecimento = 0').run();
  e.db.prepare("UPDATE contas SET plano = 'teste' WHERE id = ?").run(e.conta);
  const ag = s.agendar(e.ctx, e.conta, { texto: 'x' });
  const ins = e.db.prepare("INSERT INTO envios (conta_id, agendamento_id, grupo_id, instancia_id, enviar_em, status, enviado_em) VALUES (?, ?, ?, 1, ?, 'enviado', ?)");
  for (let i = 0; i < 100; i++) ins.run(e.conta, ag, grupos[0], e.agora(), e.agora());
  e.db.prepare("UPDATE agendamentos SET status = 'pendente' WHERE id = ?").run(ag);
  await s.despachar(e.ctx);
  e.avancar(5 * 60_000);
  await s.processarFila(e.ctx);
  assert.match((e.db.prepare("SELECT erro FROM envios WHERE status = 'erro'").get() as any).erro, /Limite diário/);
});

test('WhatsApp desconectado: o envio falha com aviso', async () => {
  const e = ambiente();
  const { grupos, inst } = await comGrupos(e);
  s.alternarGrupo(e.db, e.conta, grupos[0], 'enviar', true);
  e.db.prepare("UPDATE instancias SET status = 'desconectado' WHERE id = ?").run(inst);
  s.agendar(e.ctx, e.conta, { texto: 'x' });
  await s.despachar(e.ctx);
  e.avancar(5 * 60_000);
  await s.processarFila(e.ctx);
  assert.equal((e.db.prepare('SELECT erro FROM envios').get() as any).erro, 'WhatsApp desconectado');
  assert.equal(e.wpp.enviados.length, 0);
});

// ---------------- webhook ----------------
test('webhook: captura links de grupo monitorado, publica sozinho e conta membros', async () => {
  const f = (async () => new Response('<meta property="og:title" content="Tênis">', { status: 200 })) as any;
  const e = ambiente(f);
  const { grupos, inst } = await comGrupos(e);
  const i = e.db.prepare('SELECT chave, token_webhook FROM instancias WHERE id = ?').get(inst) as any;
  s.alternarGrupo(e.db, e.conta, grupos[0], 'enviar', true);
  s.alternarGrupo(e.db, e.conta, grupos[3], 'monitorar', true);
  e.db.prepare("UPDATE config_conta SET auto_publicar = 1, ml_modelo = 'matt_tool=7' WHERE conta_id = ?").run(e.conta);
  const msg = (jid: string, texto: string) => ({ event: 'messages.upsert', data: { key: { remoteJid: jid, fromMe: false }, message: { extendedTextMessage: { text: texto } } } });

  await assert.rejects(s.eventoWhatsApp(e.ctx, i.chave, 'errado', msg('120363099@g.us', 'x')), /autorizado/);
  assert.equal(await s.eventoWhatsApp(e.ctx, i.chave, i.token_webhook, msg('120363001@g.us', 'https://produto.mercadolivre.com.br/MLB-1')), 0, 'grupo não monitorado');
  assert.equal(await s.eventoWhatsApp(e.ctx, i.chave, i.token_webhook, msg('120363099@g.us', '🔥 Tênis https://produto.mercadolivre.com.br/MLB-1 e https://site.com')), 1);
  const o = e.db.prepare('SELECT * FROM ofertas').get() as any;
  assert.equal(o.origem, 'captura');
  assert.equal(o.url_afiliado, 'https://produto.mercadolivre.com.br/MLB-1?matt_tool=7');
  assert.equal((e.db.prepare('SELECT COUNT(*) AS n FROM agendamentos').get() as any).n, 1);
  // A mesma oferta de novo não agenda outra vez.
  await s.eventoWhatsApp(e.ctx, i.chave, i.token_webhook, msg('120363099@g.us', 'https://produto.mercadolivre.com.br/MLB-1'));
  assert.equal((e.db.prepare('SELECT COUNT(*) AS n FROM agendamentos').get() as any).n, 1);

  await s.eventoWhatsApp(e.ctx, i.chave, i.token_webhook, { event: 'GROUP_PARTICIPANTS_UPDATE', data: { id: '120363001@g.us', participants: ['a', 'b'], action: 'add' } });
  await s.eventoWhatsApp(e.ctx, i.chave, i.token_webhook, { event: 'group-participants.update', data: { id: '120363001@g.us', participants: ['a'], action: 'remove' } });
  const m = s.membros(e.ctx, e.conta, 'hoje');
  assert.equal(m.serie.at(-1)?.entrou, 2);
  assert.equal(m.serie.at(-1)?.saiu, 1);
  assert.equal((e.db.prepare('SELECT participantes FROM grupos WHERE id = ?').get(grupos[0]) as any).participantes, 1025);
});

// ---------------- demonstração ----------------
test('demonstração: dados fictícios coerentes', () => {
  const db = abrirBanco(':memory:');
  const conta = semearDemo(db);
  assert.equal(semearDemo(db), conta, 'semear de novo não duplica');
  const ctx: s.Ctx = { db, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: '' };
  const v = s.visaoGeral(ctx, conta, '7d');
  assert.equal(v.serie.length, 7);
  assert.ok(v.enviados > 0 && v.pendentes === 5 && v.numeros.conectados === 2);
  const c = s.resumoComissoes(ctx, conta, '30d');
  assert.ok(c.comissao > 0 && c.pedidos > 0 && c.taxa <= 100);
  assert.equal(s.membros(ctx, conta, '30d').serie.length, 30);
});

// ---------------- servidor ----------------
test('servidor: entrada pelo portal, sessão, proteção de requisição e API', async () => {
  const db = abrirBanco(':memory:');
  const demo = abrirBanco(':memory:'); semearDemo(demo);
  const app = {
    cfg: { porta: 0, urlPublica: 'http://localhost', arquivoBanco: ':memory:', segredoSessao: 'segredo', portalUrl: 'https://mssolucoestech.com.br', portalChavePublica: PEM, dev: false, evolutionUrl: '', evolutionApiKey: '', adminEmails: ['ana@exemplo.com'] },
    real: { db, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'http://localhost' },
    demo: { db: demo, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'http://localhost' },
  };
  const srv = criarServidor(app).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://localhost:${(srv.address() as any).port}`;
  try {
    assert.equal((await fetch(base + '/api/eu')).status, 401);
    assert.equal((await fetch(base + '/dev-login', { redirect: 'manual' })).status, 404, 'dev-login fechado em produção');
    const tok = tokenPortal({ admin: true, codigo: 'admin' });
    const r = await fetch(base + '/sso', { method: 'POST', body: new URLSearchParams({ token: tok }), redirect: 'manual' });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), '/painel#admin');
    const cookie = r.headers.get('set-cookie')!.split(';')[0];
    const repetido = await fetch(base + '/sso', { method: 'POST', body: new URLSearchParams({ token: tok }), redirect: 'manual' });
    assert.equal(repetido.status, 403);

    const eu = await (await fetch(base + '/api/eu', { headers: { cookie } })).json();
    assert.equal(eu.email, 'ana@exemplo.com');
    assert.equal(eu.admin, true);
    assert.equal((await fetch(base + '/painel', { headers: { cookie } })).status, 200);

    const semCabecalho = await fetch(base + '/api/cupons', { method: 'POST', headers: { cookie }, body: '{"codigo":"X"}' });
    assert.equal(semCabecalho.status, 403);
    const h = { cookie, 'x-ofertix': '1', 'content-type': 'application/json' };
    assert.equal((await fetch(base + '/api/cupons', { method: 'POST', headers: h, body: '{"codigo":"abc10","plataforma":"shopee"}' })).status, 201);
    const cupons = await (await fetch(base + '/api/cupons', { headers: { cookie } })).json();
    assert.equal(cupons[0].codigo, 'ABC10');
    assert.equal((await fetch(base + '/api/numeros', { method: 'POST', headers: h, body: '{"nome":"P"}' })).status, 201);
    const cfg = await (await fetch(base + '/api/config', { method: 'POST', headers: h, body: '{"shopee_app_id":"1","shopee_segredo":"segredo-real"}' })).json();
    assert.equal(cfg.ok, true);
    assert.equal((await (await fetch(base + '/api/config', { headers: { cookie } })).json()).shopee_segredo, '••••••••');
    await fetch(base + '/api/config', { method: 'POST', headers: h, body: '{"shopee_app_id":"1","shopee_segredo":"••••••••"}' });
    assert.equal((db.prepare('SELECT shopee_segredo FROM config_conta').get() as any).shopee_segredo, 'segredo-real', 'máscara não apaga a senha');
    const admin = await (await fetch(base + '/api/admin/contas', { headers: { cookie } })).json();
    assert.equal(admin.lista.length, 1);

    // Teste grátis ("demo") abre o painel de demonstração; "leitura" não pode mudar nada.
    const rd = await fetch(base + '/sso', { method: 'POST', body: new URLSearchParams({ token: tokenPortal({ codigo: 'demo' }) }), redirect: 'manual' });
    const cd = rd.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await (await fetch(base + '/api/eu', { headers: { cookie: cd } })).json()).demo, true);
    const rl = await fetch(base + '/sso', { method: 'POST', body: new URLSearchParams({ token: tokenPortal({ codigo: 'leitura' }) }), redirect: 'manual' });
    const cl = rl.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(base + '/api/cupons', { method: 'POST', headers: { ...h, cookie: cl }, body: '{"codigo":"Y"}' })).status, 403);

    // Webhook com token errado é recusado.
    assert.equal((await fetch(base + '/webhook/whatsapp/ofx-1-abc?t=x', { method: 'POST', body: '{}' })).status, 401);
  } finally {
    srv.close();
  }
});
