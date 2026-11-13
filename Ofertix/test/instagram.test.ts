// Testes da 6.7: Instagram (comentou a palavra-chave → link no direct).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as ig from '../src/instagram.ts';
import { criarServidor } from '../src/servidor.ts';
import { semearDemo } from '../src/demo.ts';

const SEGREDO = 'segredo-do-app';
function ambiente() {
  const db = abrirBanco(':memory:');
  const chamadas: { url: string; corpo: any; metodo: string }[] = [];
  let falhaPublica = false;
  const f = (async (u: string, o: any = {}) => {
    const url = String(u);
    chamadas.push({ url, corpo: o.body instanceof URLSearchParams ? Object.fromEntries(o.body) : o.body ? JSON.parse(o.body) : null, metodo: o.method ?? 'GET' });
    if (url.startsWith('https://api.instagram.com/oauth/access_token')) return Response.json({ access_token: 'curto', user_id: 99 });
    if (url.includes('/access_token?')) return Response.json({ access_token: 'longo', expires_in: 5184000 });
    if (url.includes('/refresh_access_token')) return Response.json({ access_token: 'renovado' });
    if (url.includes('/me?fields=')) return Response.json({ user_id: '1789', username: 'ofertix.cloud', id: 'x' });
    if (url.includes('/subscribed_apps')) return Response.json({ success: true });
    if (url.includes('/replies') && falhaPublica) return Response.json({ error: { message: 'sem permissão' } }, { status: 400 });
    return Response.json({ id: 'ok' });
  }) as any;
  let relogio = new Date('2026-11-13T19:00:00').getTime();
  const ctx = { db, wpp: new WhatsAppSimulado(), f, urlPublica: 'https://ofertix.teste', agora: () => relogio };
  const conta = contaPorEmail(db, 'ana@exemplo.com', 'Ana').id;
  const cfg: ig.CfgInsta = { appId: '123', appSecret: SEGREDO, verifyToken: 'vt', urlPublica: 'https://ofertix.teste', segredo: 'x'.repeat(32) };
  return { db, ctx, conta, cfg, chamadas, avancar: (ms: number) => { relogio += ms; }, falharPublica: () => { falhaPublica = true; } };
}
const comentario = (id: string, de: string, usuario: string, texto: string, midia = 'post1') =>
  ({ object: 'instagram', entry: [{ id: '1789', time: 1, changes: [{ field: 'comments', value: { id, text: texto, from: { id: de, username: usuario }, media: { id: midia, media_product_type: 'FEED' } } }] }] });

test('palavra-chave: sem acento, maiúscula e pontuação; palavra inteira', () => {
  const p = ig.palavrasDe('Eu quero, LINK');
  assert.equal(ig.bate('EU QUERO!!! 😍', p), true);
  assert.equal(ig.bate('eu quéro', p), true);
  assert.equal(ig.bate('me manda o link', p), true);
  assert.equal(ig.bate('linkedin', p), false);
  assert.equal(ig.bate('que lindo', p), false);
});

test('conexão: estado assinado, troca do código, token longo e webhook assinado', async () => {
  const e = ambiente();
  const url = new URL(ig.linkConectar(e.cfg, e.conta));
  assert.equal(url.searchParams.get('client_id'), '123');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://ofertix.teste/instagram/retorno');
  assert.match(url.searchParams.get('scope')!, /manage_comments/);
  assert.equal(ig.lerEstado('1.2.abc', e.cfg.segredo), null);
  const r = await ig.concluirConexao(e.ctx, e.cfg, 'codigo#_', url.searchParams.get('state')!);
  assert.deepEqual(r, { conta: e.conta, usuario: 'ofertix.cloud' });
  assert.equal(e.chamadas[0]!.corpo.code, 'codigo', 'tira o #_ do fim do código');
  const salvo = e.db.prepare('SELECT * FROM insta_contas WHERE conta_id = ?').get(e.conta) as any;
  assert.equal(salvo.ig_id, '1789');
  assert.equal(salvo.token, 'longo');
  assert.ok(e.chamadas.some((c) => c.url.includes('subscribed_fields=comments,messages') && c.metodo === 'POST'));
  // Token renovado depois de 20 dias.
  assert.equal(await ig.renovarTokens(e.ctx), 0);
  e.avancar(21 * 86400_000);
  assert.equal(await ig.renovarTokens(e.ctx), 1);
  assert.equal((e.db.prepare('SELECT token FROM insta_contas').get() as any).token, 'renovado');
  // Assinatura do webhook.
  const corpo = '{"a":1}';
  assert.equal(ig.assinaturaValida(corpo, 'sha256=' + createHmac('sha256', SEGREDO).update(corpo).digest('hex'), SEGREDO), true);
  assert.equal(ig.assinaturaValida(corpo, 'sha256=00', SEGREDO), false);
});

test('comentário com a palavra → link no direct e resposta no post; uma vez por pessoa e post', async () => {
  const e = ambiente();
  e.db.prepare("INSERT INTO insta_contas (conta_id, ig_id, usuario, token, token_em, conectado_em) VALUES (?, '1789', 'ofertix.cloud', 'tok', ?, ?)").run(e.conta, Date.now(), Date.now());
  const rid = ig.salvarRegra(e.db, e.conta, { nome: 'Teste grátis', palavras: 'eu quero, quero', mensagem: 'Oi, {nome}! Aqui está: https://ofertix.cloud/?o=insta', publica: 'Te mandei no direct! 💌' });
  assert.throws(() => ig.salvarRegra(e.db, e.conta, { palavras: ' , ', mensagem: 'x' }), /palavra-chave/);
  // Comentário comum: nada acontece e nada é registrado.
  assert.equal(await ig.eventoInstagram(e.ctx, comentario('c0', 'u1', 'mari', 'que lindo!')), 0);
  assert.equal(await ig.eventoInstagram(e.ctx, comentario('c1', 'u1', 'mari', 'Eu quero!!')), 1);
  const priv = e.chamadas.find((c) => c.url.endsWith('/1789/messages'))!;
  assert.deepEqual(priv.corpo, { recipient: { comment_id: 'c1' }, message: { text: 'Oi, @mari! Aqui está: https://ofertix.cloud/?o=insta' } });
  const pub = e.chamadas.find((c) => c.url.endsWith('/c1/replies'))!;
  assert.equal(pub.corpo.message, 'Te mandei no direct! 💌');
  // O mesmo webhook de novo (a Meta repete): ignorado em silêncio.
  assert.equal(await ig.eventoInstagram(e.ctx, comentario('c1', 'u1', 'mari', 'Eu quero!!')), 0);
  // A mesma pessoa comenta de novo no mesmo post: registrada como ignorada, sem direct.
  assert.equal(await ig.eventoInstagram(e.ctx, comentario('c2', 'u1', 'mari', 'quero')), 0);
  // Em outro post, recebe.
  assert.equal(await ig.eventoInstagram(e.ctx, comentario('c3', 'u1', 'mari', 'quero', 'post2')), 1);
  // Comentário do próprio perfil (respondendo) não dispara.
  assert.equal(await ig.eventoInstagram(e.ctx, comentario('c4', '1789', 'ofertix.cloud', 'quero mais comentários')), 0);
  // Resposta pública falhou: o direct conta e o motivo aparece.
  e.falharPublica();
  assert.equal(await ig.eventoInstagram(e.ctx, comentario('c5', 'u2', 'bia', 'EU QUERO')), 1);
  const p = ig.painel(e.db, e.conta, { appId: '123', urlPublica: 'https://ofertix.teste' }, Date.now());
  assert.equal(p.conectado?.usuario, 'ofertix.cloud');
  assert.deepEqual(p.hoje, { enviadas: 3, ignoradas: 1, erros: 0 });
  assert.match((p.registro as any[])[0].motivo, /resposta no post falhou: .*sem permissão/);
  assert.equal(p.regras.find((r) => r.id === rid)!.respondidas, 3);
  // Conta de outro Instagram (não conectado aqui): ignora.
  assert.equal(await ig.eventoInstagram(e.ctx, { object: 'instagram', entry: [{ id: '555', changes: [] }] }), 0);
});

test('direct com a palavra também recebe o link; eco e repetidas não', async () => {
  const e = ambiente();
  e.db.prepare("INSERT INTO insta_contas (conta_id, ig_id, usuario, token, token_em, conectado_em) VALUES (?, '1789', 'ofertix.cloud', 'tok', ?, ?)").run(e.conta, Date.now(), Date.now());
  ig.salvarRegra(e.db, e.conta, { palavras: 'eu quero', mensagem: 'Oi{nome}! Link: https://ofertix.cloud', publica: '' });
  const dm = (mid: string, texto: string, eco = false) => ({ object: 'instagram', entry: [{ id: '1789', messaging: [{ sender: { id: eco ? '1789' : 'u9' }, recipient: { id: '1789' }, message: { mid, text: texto, is_echo: eco || undefined } }] }] });
  assert.equal(await ig.eventoInstagram(e.ctx, dm('m1', 'eu quero')), 1);
  assert.deepEqual(e.chamadas.at(-1)!.corpo, { recipient: { id: 'u9' }, message: { text: 'Oi! Link: https://ofertix.cloud' } });
  assert.equal(await ig.eventoInstagram(e.ctx, dm('m2', 'EU QUERO')), 0, 'já recebeu hoje');
  assert.equal(await ig.eventoInstagram(e.ctx, dm('m3', 'eu quero', true)), 0, 'eco da própria mensagem');
  assert.equal(ig.simular(e.db, e.conta, 'oi').regra, '');
  assert.match(ig.simular(e.db, e.conta, 'Eu quero', 'ana').mensagem, /Oi@ana! Link/);
});

test('rotas: webhook com verificação e assinatura; página Instagram na demonstração', async () => {
  const db = abrirBanco(':memory:');
  const ctx = { db, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'https://ofertix.teste' };
  const demoDb = abrirBanco(':memory:'); semearDemo(demoDb);
  const app = { cfg: { porta: 0, urlPublica: 'https://ofertix.teste', arquivoBanco: ':memory:', segredoSessao: 'x'.repeat(32), portalUrl: 'https://portal.exemplo', portalChavePublica: '', dev: true, evolutionUrl: '', evolutionApiKey: '', adminEmails: [], whatsappContato: '', instagramAppId: '123', instagramAppSecret: SEGREDO, instagramVerifyToken: 'vt' }, real: ctx, demo: { ...ctx, db: demoDb, demo: true } };
  const srv = criarServidor(app as any).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  try {
    const v = await fetch(base + '/webhook/instagram?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=4321');
    assert.equal(v.status, 200); assert.equal(await v.text(), '4321');
    assert.equal((await fetch(base + '/webhook/instagram?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1')).status, 403);
    const corpo = JSON.stringify({ object: 'instagram', entry: [] });
    assert.equal((await fetch(base + '/webhook/instagram', { method: 'POST', body: corpo, headers: { 'x-hub-signature-256': 'sha256=00' } })).status, 403);
    const sig = 'sha256=' + createHmac('sha256', SEGREDO).update(corpo).digest('hex');
    assert.equal((await fetch(base + '/webhook/instagram', { method: 'POST', body: corpo, headers: { 'x-hub-signature-256': sig } })).status, 200);
    assert.equal((await fetch(base + '/instagram/retorno?code=x&state=errado')).status, 400);
    const login = await fetch(base + '/demo', { redirect: 'manual' });
    const cookie = String(login.headers.get('set-cookie')).split(';')[0];
    const h = { cookie, 'x-ofertix': '1', 'content-type': 'application/json' };
    const p = await (await fetch(base + '/api/instagram', { headers: { cookie } })).json() as any;
    assert.equal(p.conectado.usuario, 'achadinhos.da.carla');
    assert.equal(p.regras.length, 1);
    assert.ok(p.registro.length >= 5);
    const sim = await (await fetch(base + '/api/instagram/simular', { method: 'POST', headers: h, body: JSON.stringify({ texto: 'Eu quero!' }) })).json() as any;
    assert.match(sim.mensagem, /achadinhos-da-carla/);
    const con = await fetch(base + '/api/instagram/conectar', { method: 'POST', headers: h });
    assert.equal(con.status, 400, 'na demonstração não abre o login de verdade');
  } finally { srv.close(); }
});
