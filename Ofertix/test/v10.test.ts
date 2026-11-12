// Testes da v10: envio por tema e espelhamento de grupos (página Automação).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';
import * as v10 from '../src/v10.ts';
import { criarServidor } from '../src/servidor.ts';
import { semearDemo } from '../src/demo.ts';

function ambiente(quando = '2026-11-12T12:00:00') {
  const db = abrirBanco(':memory:');
  const wpp = new WhatsAppSimulado();
  let relogio = new Date(quando).getTime();
  // Lojas: página do produto com título; encurtador "bit.ly" leva para a Amazon.
  const f = (async (u: string) => {
    if (String(u).includes('bit.ly/promo')) return new Response('', { status: 301, headers: { location: 'https://www.amazon.com.br/dp/B0BIT?tag=outro-20' } });
    if (String(u).includes('bit.ly/insta')) return new Response('', { status: 301, headers: { location: 'https://instagram.com/zezinho' } });
    return new Response('<meta property="og:title" content="Fone Bluetooth com Estojo"><meta property="og:image" content="https://img.exemplo/fone.jpg">', { status: 200 });
  }) as any;
  const ctx: s.Ctx = { db, wpp, f, urlPublica: 'https://ofertix.teste', agora: () => relogio };
  const conta = contaPorEmail(db, 'ana@exemplo.com', 'Ana').id;
  db.prepare("UPDATE contas SET plano = 'pro' WHERE id = ?").run(conta);
  db.prepare("UPDATE config_conta SET amazon_tag = 'ana-20', aquecimento = 0 WHERE conta_id = ?").run(conta);
  return { db, wpp, ctx, conta, avancar: (ms: number) => { relogio += ms; } };
}

async function preparar(e: ReturnType<typeof ambiente>) {
  const inst = await s.novaInstancia(e.ctx, e.conta, 'Principal');
  await s.atualizarEstado(e.ctx, e.conta, inst);
  const g = (e.db.prepare('SELECT id, jid FROM grupos WHERE conta_id = ? ORDER BY id').all(e.conta) as any[]);
  // Três primeiros = envio; o quarto ("Promoções da Concorrência") = origem do espelhamento.
  for (const x of g.slice(0, 3)) s.alternarGrupo(e.db, e.conta, x.id, 'enviar', true);
  const chave = e.db.prepare('SELECT chave, token_webhook FROM instancias WHERE id = ?').get(inst) as any;
  return { inst, envio: g.slice(0, 3).map((x) => Number(x.id)), origem: Number(g[3].id), jidOrigem: String(g[3].jid), chave };
}
async function esvaziarFila(e: ReturnType<typeof ambiente>) {
  await s.despachar(e.ctx);
  for (let i = 0; i < 30; i++) { e.avancar(120_000); await s.processarFila(e.ctx); }
}
const evento = (jid: string, msg: any, id = 'M' + Math.random()) => ({ event: 'messages.upsert', data: { key: { remoteJid: jid, id, fromMe: false }, message: msg } });

test('tema do grupo: categorias e preço máximo decidem quem recebe', () => {
  assert.equal(v10.aceitaOferta({ categorias: '', preco_max: 0 }, { categoria: 'casa', preco_por: 9990 }), true);
  assert.equal(v10.aceitaOferta({ categorias: 'beleza', preco_max: 0 }, { categoria: 'casa', preco_por: 9990 }), false);
  assert.equal(v10.aceitaOferta({ categorias: 'beleza,moda', preco_max: 0 }, { categoria: 'moda', preco_por: null }), true);
  assert.equal(v10.aceitaOferta({ categorias: '', preco_max: 5000 }, { categoria: 'casa', preco_por: 4990 }), true);
  assert.equal(v10.aceitaOferta({ categorias: '', preco_max: 5000 }, { categoria: 'casa', preco_por: 5990 }), false);
  assert.equal(v10.aceitaOferta({ categorias: '', preco_max: 5000 }, { categoria: 'casa', preco_por: null }), false, 'sem preço não entra no grupo de até R$ 50');
  assert.equal(v10.aceitaOferta({ categorias: 'outros', preco_max: 0 }, { categoria: '', preco_por: 100 }), true, 'sem categoria conta como Outros');
  assert.equal(v10.descreverTema({ categorias: 'beleza', preco_max: 5000 }), 'Beleza e autocuidado · até R$ 50,00');
});

test('envio por tema: "todos" vai só para os grupos do tema; sem grupo, cancela com o motivo', async () => {
  const e = ambiente();
  const p = await preparar(e);
  v10.salvarTemaGrupo(e.db, e.conta, p.envio[0], { categorias: ['beleza'] });
  v10.salvarTemaGrupo(e.db, e.conta, p.envio[1], { categorias: ['casa', 'cozinha', 'inexistente'] });
  v10.salvarTemaGrupo(e.db, e.conta, p.envio[2], { precoMax: 5000 });
  assert.equal((e.db.prepare('SELECT categorias FROM grupos WHERE id = ?').get(p.envio[1]) as any).categorias, 'casa,cozinha');
  assert.throws(() => v10.salvarTemaGrupo(e.db, e.conta, 99999, { categorias: ['beleza'] }), /não encontrado/);
  const nova = (titulo: string, preco: number, url: string) => s.salvarOferta(e.ctx, e.conta, { plataforma: 'amazon', urlOriginal: url, urlAfiliado: url + '?tag=ana-20', titulo, imagem: '', precoDe: null, precoPor: preco, comissaoPct: null });
  const serum = nova('Sérum Facial Vitamina C', 3990, 'https://www.amazon.com.br/dp/A1');
  const panela = nova('Jogo de Panela Antiaderente', 19990, 'https://www.amazon.com.br/dp/A2');
  const fone = nova('Fone Bluetooth', 9990, 'https://www.amazon.com.br/dp/A3');
  const a1 = s.agendar(e.ctx, e.conta, { ofertaId: serum, texto: 'Sérum https://www.amazon.com.br/dp/A1?tag=ana-20' });
  const a2 = s.agendar(e.ctx, e.conta, { ofertaId: panela, texto: 'Panela' });
  const a3 = s.agendar(e.ctx, e.conta, { ofertaId: fone, texto: 'Fone' });
  await esvaziarFila(e);
  const grupos = (ag: number) => (e.db.prepare("SELECT grupo_id FROM envios WHERE agendamento_id = ? AND status = 'enviado' ORDER BY grupo_id").all(ag) as any[]).map((x) => Number(x.grupo_id));
  assert.deepEqual(grupos(a1), [p.envio[0], p.envio[2]], 'sérum: grupo de beleza e o de até R$ 50');
  assert.deepEqual(grupos(a2), [p.envio[1]], 'panela: só casa e cozinha');
  const c3 = e.db.prepare('SELECT status, obs FROM agendamentos WHERE id = ?').get(a3) as any;
  assert.equal(c3.status, 'cancelado');
  assert.match(c3.obs, /Nenhum grupo de envio recebe Eletrônicos de R\$ 99,90/);
  // Escolher os grupos à mão continua mandando para quem foi escolhido, sem olhar o tema.
  const a4 = s.agendar(e.ctx, e.conta, { ofertaId: fone, texto: 'Fone de novo', grupos: [p.envio[0]] });
  await esvaziarFila(e);
  assert.deepEqual(grupos(a4), [p.envio[0]]);
});

test('horários automáticos com temas: cada grupo recebe a oferta do seu tema no mesmo horário', async () => {
  const e = ambiente('2026-11-12T08:55:00');
  const p = await preparar(e);
  v10.salvarTemaGrupo(e.db, e.conta, p.envio[0], { categorias: ['beleza'] });
  v10.salvarTemaGrupo(e.db, e.conta, p.envio[1], { categorias: ['casa'] });
  v10.salvarTemaGrupo(e.db, e.conta, p.envio[2], { categorias: ['moda'] });
  e.db.prepare("UPDATE config_conta SET horarios_auto = '09:00' WHERE conta_id = ?").run(e.conta);
  const vit = (titulo: string, url: string, min: number) => { const id = s.salvarOferta(e.ctx, e.conta, { plataforma: 'amazon', urlOriginal: url, urlAfiliado: url, titulo, imagem: '', precoDe: null, precoPor: 2990, comissaoPct: null }); e.db.prepare('UPDATE ofertas SET vitrine = 1, vitrine_em = ? WHERE id = ?').run(min, id); return id; };
  const t1 = vit('Tapete Sala Grande', 'https://www.amazon.com.br/dp/T1', 1);
  const t2 = vit('Toalha de Banho Kit', 'https://www.amazon.com.br/dp/T2', 2);
  const b1 = vit('Batom Matte Vermelho', 'https://www.amazon.com.br/dp/B1', 3);
  e.avancar(6 * 60_000);
  assert.equal(s.rodarHorarios(e.ctx), 2, 'uma oferta para casa e uma para beleza; moda fica sem (vitrine sem moda)');
  const ags = e.db.prepare("SELECT oferta_id, grupos FROM agendamentos WHERE origem = 'vitrine' ORDER BY oferta_id").all() as any[];
  assert.deepEqual(ags.map((a) => [Number(a.oferta_id), JSON.parse(a.grupos)]), [[t1, [p.envio[1]]], [b1, [p.envio[0]]]]);
  assert.equal((e.db.prepare('SELECT vitrine FROM ofertas WHERE id = ?').get(t2) as any).vitrine, 1, 'a segunda de casa espera o próximo horário');
});

test('espelhamento: copia texto, imagem e cupom, troca o link, tira convite e assinatura', async () => {
  const e = ambiente();
  const p = await preparar(e);
  assert.throws(() => v10.salvarEspelho(e.db, e.conta, { origem: p.envio[0] }), /não pode ser um dos seus grupos de envio/);
  const id = v10.salvarEspelho(e.db, e.conta, { origem: p.origem, destino: 'todos', remover: 'Siga @zezinho\nGrupo do Zé' });
  assert.throws(() => v10.salvarEspelho(e.db, e.conta, { origem: p.origem }), /já tem um espelhamento/);
  const texto = ['🔥 *Fone Bluetooth com Estojo*', 'De ~R$ 199~ por *R$ 99*', '🎟️ Cupom: FONE10', '👉 https://www.amazon.com.br/dp/B0XYZ?tag=outro-20', '',
    'Entre no grupo: https://chat.whatsapp.com/ABCdef123', 'Siga @zezinho no Insta', 'Mais no nosso site: https://bit.ly/insta'].join('\n');
  const n = await s.eventoWhatsApp(e.ctx, p.chave.chave, p.chave.token_webhook, evento(p.jidOrigem, { imageMessage: { caption: texto, mimetype: 'image/jpeg' } }));
  assert.equal(n, 1);
  const ag = e.db.prepare("SELECT * FROM agendamentos WHERE origem = 'espelho'").get() as any;
  assert.ok(ag, 'agendou a cópia');
  assert.match(ag.texto, /Fone Bluetooth com Estojo/);
  assert.match(ag.texto, /Cupom: FONE10/);
  assert.match(ag.texto, /De ~R\$ 199~ por \*R\$ 99\*/);
  assert.match(ag.texto, /https:\/\/www\.amazon\.com\.br\/dp\/B0XYZ\?tag=ana-20/);
  assert.doesNotMatch(ag.texto, /outro-20|chat\.whatsapp|zezinho|bit\.ly/);
  assert.match(ag.texto, /Mais no nosso site:/, 'link que não é de loja sai, a frase fica');
  assert.match(ag.imagem, /^https:\/\/ofertix\.teste\/m\/[\w-]{16}$/);
  const midia = v10.lerMidia(e.db, ag.imagem.split('/m/')[1]);
  assert.equal(midia!.tipo, 'image/png');
  assert.equal(JSON.parse(ag.grupos).length, 3);
  const of = s.oferta(e.db, e.conta, ag.oferta_id);
  assert.equal(of.origem, 'espelho');
  // Sai nos grupos com o link curto que conta clique no lugar do link de afiliado.
  await esvaziarFila(e);
  const enviados = e.wpp.enviados.filter((x) => x.texto.includes('Fone Bluetooth'));
  assert.equal(enviados.length, 3);
  assert.match(enviados[0]!.texto, /https:\/\/ofertix\.teste\/r\/\w+/);
  assert.equal(enviados[0]!.imagem, ag.imagem);
  // A mesma mensagem de novo: ignorada como repetida.
  assert.equal(await s.eventoWhatsApp(e.ctx, p.chave.chave, p.chave.token_webhook, evento(p.jidOrigem, { conversation: texto })), 0);
  const reg = v10.registroEspelhos(e.db, e.conta) as any[];
  assert.equal(reg[0].status, 'ignorada');
  assert.match(reg[0].motivo, /Repetida/);
  assert.equal(reg[1].status, 'agendada');
  assert.equal((e.db.prepare('SELECT copiadas FROM espelhos WHERE id = ?').get(id) as any).copiadas, 1);
});

test('espelhamento: nunca manda o link de outra pessoa; sem link, ignora; encurtador que leva à loja é trocado', async () => {
  const e = ambiente();
  const p = await preparar(e);
  v10.salvarEspelho(e.db, e.conta, { origem: p.origem, destino: 'grupos', grupos: [p.envio[1]] });
  const env = (msg: any) => s.eventoWhatsApp(e.ctx, p.chave.chave, p.chave.token_webhook, evento(p.jidOrigem, msg));
  // Shopee sem Open API cadastrada: bloqueia.
  assert.equal(await env({ conversation: 'Air fryer barata https://s.shopee.com.br/abc123' }), 0);
  // Magalu: o Ofertix ainda não gera o link de afiliado, então bloqueia.
  assert.equal(await env({ conversation: 'Liquidificador https://www.magazineluiza.com.br/p/123' }), 0);
  // Conversa sem link: ignora.
  assert.equal(await env({ conversation: 'Bom dia, grupo! Hoje tem cupom às 19h' }), 0);
  // Figurinha: nem entra no registro.
  assert.equal(await env({ stickerMessage: {} }), 0);
  // Encurtador que leva para a Amazon: troca pelo link da conta.
  assert.equal(await env({ conversation: 'Kindle em promoção https://bit.ly/promo' }), 1);
  const reg = (v10.registroEspelhos(e.db, e.conta) as any[]).reverse();
  assert.deepEqual(reg.map((r) => r.status), ['bloqueada', 'bloqueada', 'ignorada', 'agendada']);
  assert.match(reg[0].motivo, /Shopee.*Open API/);
  assert.match(reg[1].motivo, /Magalu/);
  assert.equal(reg[2].motivo, 'Sem link de loja');
  const ag = e.db.prepare("SELECT texto, grupos FROM agendamentos WHERE origem = 'espelho'").get() as any;
  assert.match(ag.texto, /amazon\.com\.br\/dp\/B0BIT\?tag=ana-20/);
  assert.doesNotMatch(ag.texto, /bit\.ly|outro-20/);
  assert.deepEqual(JSON.parse(ag.grupos), [p.envio[1]]);
  assert.equal(e.db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE origem = 'espelho'").get()!.n, 1, 'nada bloqueado foi agendado');
});

test('espelhamento: plano, limite, desligado e curadoria', async () => {
  const e = ambiente();
  const p = await preparar(e);
  e.db.prepare("UPDATE contas SET plano = 'inicial' WHERE id = ?").run(e.conta);
  assert.throws(() => v10.salvarEspelho(e.db, e.conta, { origem: p.origem }), /planos Pro e Escala/);
  e.db.prepare("UPDATE contas SET plano = 'teste' WHERE id = ?").run(e.conta); // teste: 2 grupos monitorados
  const id = v10.salvarEspelho(e.db, e.conta, { origem: p.origem, ativo: false });
  // Desligado: a mensagem segue o caminho comum (sem captura, porque o grupo não é monitorado).
  assert.equal(await s.eventoWhatsApp(e.ctx, p.chave.chave, p.chave.token_webhook, evento(p.jidOrigem, { conversation: 'Fone https://www.amazon.com.br/dp/X1' })), 0);
  assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM espelho_log').get()!.n, 0);
  // Curadoria ligada com preço máximo de R$ 10: o produto (sem preço na página) passa; com palavra bloqueada, não.
  e.db.prepare('UPDATE config_conta SET nicho = ? WHERE conta_id = ?').run(JSON.stringify({ regras: { excluir: ['fone'] } }), e.conta);
  v10.salvarEspelho(e.db, e.conta, { origem: p.origem, curadoria: true }, id);
  assert.equal(await s.eventoWhatsApp(e.ctx, p.chave.chave, p.chave.token_webhook, evento(p.jidOrigem, { conversation: 'Olha https://www.amazon.com.br/dp/X2' })), 0);
  assert.match((v10.registroEspelhos(e.db, e.conta) as any[])[0].motivo, /^Curadoria:/);
});

test('prévia do espelhamento e rotas da página Automação', async () => {
  const db = abrirBanco(':memory:');
  const ctx = { db, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: 'https://ofertix.teste' };
  const demoDb = abrirBanco(':memory:'); semearDemo(demoDb);
  const app = { cfg: { porta: 0, urlPublica: 'https://ofertix.teste', arquivoBanco: ':memory:', segredoSessao: 'x'.repeat(32), portalUrl: 'https://portal.exemplo', portalChavePublica: '', dev: true, evolutionUrl: '', evolutionApiKey: '', adminEmails: [], whatsappContato: '' }, real: ctx, demo: { ...ctx, db: demoDb, demo: true } };
  const srv = criarServidor(app as any).listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  try {
    const login = await fetch(base + '/demo', { redirect: 'manual' });
    const cookie = String(login.headers.get('set-cookie')).split(';')[0];
    const h = { cookie, 'x-ofertix': '1', 'content-type': 'application/json' };
    const painel = await (await fetch(base + '/api/automacao', { headers: { cookie } })).json() as any;
    assert.equal(painel.lista.length, 1, 'demonstração já tem um espelhamento');
    assert.equal(painel.lista[0].origem_nome, 'Caçadores de Cupom (monitorado)');
    assert.ok(painel.registro.length >= 5);
    assert.ok(painel.grupos.some((g: any) => g.tema === 'até R$ 50,00'));
    const pv = await (await fetch(base + '/api/espelhos/previa', { method: 'POST', headers: h, body: JSON.stringify({ texto: 'Sérum 🔥\nhttps://s.shopee.com.br/xyz\nhttps://chat.whatsapp.com/abc', remover: '' }) })).json() as any;
    assert.match(pv.texto, /^Sérum 🔥\nhttps:\/\/s\.shopee\.com\.br\/carla\w{6}$/);
    assert.deepEqual(pv.trocas.map((x: any) => x.status), ['removido', 'trocado']);
    assert.equal(pv.bloqueio, '');
    // Tema do grupo pela API.
    const g = painel.grupos.find((x: any) => x.enviar);
    assert.equal((await fetch(base + `/api/grupos/${g.id}`, { method: 'POST', headers: h, body: JSON.stringify({ categorias: ['beleza'], precoMax: 0 }) })).status, 200);
    const gs = await (await fetch(base + '/api/grupos', { headers: { cookie } })).json() as any;
    assert.equal(gs.lista.find((x: any) => x.id === g.id).categorias, 'beleza');
    // Liga e desliga.
    const esp = painel.lista[0];
    assert.equal((await fetch(base + `/api/espelhos/${esp.id}/ativo`, { method: 'POST', headers: h, body: JSON.stringify({ ativo: false }) })).status, 200);
    const depois = await (await fetch(base + '/api/automacao', { headers: { cookie } })).json() as any;
    assert.equal(depois.lista[0].ativo, false);
    // Imagem copiada: servida em /m/ e fora do Google.
    const cod = v10.guardarMidia(db, 1, 'iVBORw0KGgo=', 'image/png', Date.now());
    const img = await fetch(base + '/m/' + cod);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.equal((await fetch(base + '/m/naoexiste123456')).status, 404);
    v10.limparMidias(db, Date.now() + 4 * 86_400_000);
    assert.equal((await fetch(base + '/m/' + cod)).status, 404);
  } finally { srv.close(); }
});
