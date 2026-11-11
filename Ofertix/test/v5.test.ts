// Testes das melhorias da v5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';
import * as x from '../src/extras.ts';
import { criarEntrada } from '../src/entradas.ts';

const DIA = 86_400_000;
function ambiente(quando = '2026-11-10T12:00:00') {
  const db = abrirBanco(':memory:');
  const wpp = new WhatsAppSimulado();
  let relogio = new Date(quando).getTime();
  const f = (async () => new Response('<meta property="og:title" content="Produto">', { status: 200 })) as any;
  const ctx: s.Ctx = { db, wpp, f, urlPublica: 'https://ofertix.teste', agora: () => relogio };
  const conta = contaPorEmail(db, 'ana@exemplo.com', 'Ana').id;
  return { db, wpp, ctx, conta, ir: (q: string) => { relogio = new Date(q).getTime(); }, avancar: (ms: number) => { relogio += ms; }, agora: () => relogio };
}
async function preparar(e: ReturnType<typeof ambiente>, n = 2) {
  const inst = await s.novaInstancia(e.ctx, e.conta, 'Principal');
  await s.atualizarEstado(e.ctx, e.conta, inst);
  const grupos = (e.db.prepare('SELECT id FROM grupos WHERE conta_id = ? ORDER BY id').all(e.conta) as any[]).map((g) => Number(g.id));
  for (const g of grupos.slice(0, n)) s.alternarGrupo(e.db, e.conta, g, 'enviar', true);
  return { inst, grupos };
}
const oferta = (e: ReturnType<typeof ambiente>, titulo: string, preco = 4990) => s.salvarOferta(e.ctx, e.conta, {
  plataforma: 'amazon', urlOriginal: 'https://www.amazon.com.br/dp/' + titulo.replace(/\W/g, ''), urlAfiliado: 'https://www.amazon.com.br/dp/x?tag=ana-20', titulo, imagem: '', precoDe: 9990, precoPor: preco, comissaoPct: 5,
});

test('aquecimento: número novo começa com limite baixo e sobe por semana', async () => {
  const e = ambiente();
  const { inst } = await preparar(e);
  e.db.prepare("UPDATE contas SET plano = 'pro' WHERE id = ?").run(e.conta);
  assert.deepEqual(x.limiteDoNumero(e.db, e.conta, inst, e.agora()), { limite: 40, aquecendo: true, dia: 1 });
  assert.equal(x.limiteDoNumero(e.db, e.conta, inst, e.agora() + 8 * DIA).limite, 100);
  assert.equal(x.limiteDoNumero(e.db, e.conta, inst, e.agora() + 30 * DIA).limite, 800);
  e.db.prepare('UPDATE config_conta SET aquecimento = 0').run();
  assert.equal(x.limiteDoNumero(e.db, e.conta, inst, e.agora()).limite, 800);
});

test('pausa geral: nada sai até retomar, e a fila continua de onde parou', async () => {
  const e = ambiente();
  await preparar(e, 1);
  s.agendar(e.ctx, e.conta, { texto: 'Oi' });
  x.pausar(e.db, e.conta, true);
  assert.equal(await s.despachar(e.ctx), 0);
  x.pausar(e.db, e.conta, false);
  assert.equal(await s.despachar(e.ctx), 1);
  x.pausar(e.db, e.conta, true);
  e.avancar(5 * 60_000);
  assert.equal(await s.processarFila(e.ctx), 0);
  assert.equal(e.wpp.enviados.length, 0);
  assert.match(s.avisos(e.ctx, e.conta)[0]!.texto, /pausados/);
  x.pausar(e.db, e.conta, false);
  e.avancar(5 * 60_000);
  assert.equal(await s.processarFila(e.ctx), 1);
});

test('mensagem recorrente sai no dia e horário marcados, uma vez', async () => {
  const e = ambiente('2026-11-10T08:55:00'); // terça
  await preparar(e, 1);
  x.salvarRecorrente(e.db, e.conta, { nome: 'Regras', texto: 'Regras do grupo', hora: '09:00', dias: [2, 4] });
  assert.throws(() => x.salvarRecorrente(e.db, e.conta, { texto: 'x', hora: '09:00', dias: [] }), /dia/);
  assert.equal(x.rodarRecorrentes(e.ctx), 0);
  e.ir('2026-11-10T09:01:00');
  assert.equal(x.rodarRecorrentes(e.ctx), 1);
  assert.equal(x.rodarRecorrentes(e.ctx), 0);
  e.ir('2026-11-11T09:01:00'); // quarta não está nos dias
  assert.equal(x.rodarRecorrentes(e.ctx), 0);
  assert.equal((e.db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE origem = 'recorrente'").get() as any).n, 1);
});

test('boas-vindas junta as entradas e respeita o intervalo', async () => {
  const e = ambiente();
  const { grupos } = await preparar(e, 1);
  e.db.prepare("UPDATE config_conta SET boas_vindas = 'Bem-vindas ao {grupo}! ({novas} novas)', boas_vindas_min = 60").run();
  x.anotarEntrada(e.db, grupos[0]!, 2); x.anotarEntrada(e.db, grupos[0]!, 3);
  assert.equal(x.rodarBoasVindas(e.ctx), 1);
  assert.match((e.db.prepare("SELECT texto FROM agendamentos WHERE origem = 'boas-vindas'").get() as any).texto, /\(5 novas\)/);
  x.anotarEntrada(e.db, grupos[0]!, 1);
  e.avancar(30 * 60_000);
  assert.equal(x.rodarBoasVindas(e.ctx), 0, 'antes de 60 minutos espera');
  e.avancar(31 * 60_000);
  assert.equal(x.rodarBoasVindas(e.ctx), 1);
});

test('parecidas, histórico de preço e arquivamento', () => {
  const e = ambiente();
  const a = oferta(e, 'Garrafa Térmica Inox 1 Litro Preta');
  const b = oferta(e, 'Garrafa Térmica Inox 1 Litro Rosa');
  oferta(e, 'Tapete de Sala Grande');
  assert.deepEqual(x.parecidas(e.db, e.conta, b).map((o: any) => o.id), [a]);
  assert.ok(x.historicoPreco(e.db, e.conta, a).lista.length >= 1);
  e.db.prepare('UPDATE config_conta SET arquivar_dias = 30').run();
  e.db.prepare('UPDATE ofertas SET criado_em = ?').run(e.agora() - 40 * DIA);
  s.alternarVitrine(e.db, e.conta, a, true);
  assert.equal(x.rodarArquivamento(e.ctx), 2, 'a da vitrine fica');
  assert.equal((e.db.prepare('SELECT arquivada FROM ofertas WHERE id = ?').get(a) as any).arquivada, 0);
});

test('preço novo entra no histórico quando muda', () => {
  const e = ambiente();
  const id = oferta(e, 'Kit Potes', 4990);
  oferta(e, 'Kit Potes', 4990);
  oferta(e, 'Kit Potes', 3990);
  assert.deepEqual(x.historicoPreco(e.db, e.conta, id).lista.map((p: any) => p.preco_por), [4990, 3990]);
});

test('campeãs voltam para a vitrine; melhores horários, funil e grupos cansados', async () => {
  const e = ambiente();
  const { grupos } = await preparar(e, 2);
  const a = oferta(e, 'Campeã'), b = oferta(e, 'Fraca');
  const link = (o: number, g: number, h: number, cliques: number) => {
    const cod = s.novoCodigo();
    const em = new Date(`2026-11-09T${String(h).padStart(2, '0')}:00:00`).getTime();
    e.db.prepare('INSERT INTO links (codigo, conta_id, oferta_id, grupo_id, agendamento_id, destino, criado_em) VALUES (?, ?, ?, ?, NULL, ?, ?)').run(cod, e.conta, o, g, 'x', em);
    for (let i = 0; i < cliques; i++) e.db.prepare('INSERT INTO cliques (codigo, conta_id, em) VALUES (?, ?, ?)').run(cod, e.conta, em + 60_000);
  };
  for (let i = 0; i < 4; i++) { link(a, grupos[0]!, 20, 5); link(b, grupos[1]!, 10, 1); }
  assert.equal(x.reenviarCampeas(e.ctx, e.conta, '7d', 1), 1);
  assert.equal((e.db.prepare('SELECT vitrine FROM ofertas WHERE id = ?').get(a) as any).vitrine, 1);
  const h = x.melhoresHorarios(e.ctx, e.conta);
  assert.equal(h.sugestao[0], '10:00');
  assert.deepEqual(h.sugestao, ['10:00', '20:00']);
  assert.equal(h.grade[1]![20], 5);
  e.db.prepare("INSERT INTO comissoes (conta_id, plataforma, pedido, produto, valor_centavos, comissao_centavos, status, em) VALUES (?, 'amazon', 'P1', 'x', 5000, 250, 'concluido', ?)").run(e.conta, e.agora() - 3600_000);
  e.db.prepare('UPDATE config_conta SET meta_comissao = 1000').run();
  const r = x.metaEFunil(e.ctx, e.conta, '7d');
  assert.deepEqual([r.meta.pct, r.funil.cliques, r.funil.pedidos, r.funil.comissao], [25, 24, 1, 250]);
  assert.ok(x.gruposCansados(e.ctx, e.conta, '7d').every((g) => g.nivel === 'pouco'));
  assert.match(x.textoResumoSemana(e.ctx, e.conta), /Resumo da semana/);
});

test('primeiros passos e vitrine pública', async () => {
  const e = ambiente();
  assert.equal(x.primeirosPassos(e.db, e.conta).feitos, 0);
  await preparar(e, 1);
  criarEntrada(e.ctx, e.conta, { slug: 'achadinhos-da-ana', titulo: 'Achadinhos da Ana' });
  const p = x.primeirosPassos(e.db, e.conta);
  assert.deepEqual(p.passos.filter((q) => q.feito).map((q) => q.id), ['numero', 'grupos', 'entrada']);
  const id = oferta(e, 'Sérum Facial');
  s.agendar(e.ctx, e.conta, { ofertaId: id, texto: 'Sérum' });
  await s.despachar(e.ctx);
  const v = x.vitrinePublica(e.ctx, 'achadinhos-da-ana')!;
  assert.equal(v.ofertas.length, 1);
  assert.match(v.ofertas[0]!.link, /^\/r\//);
  assert.equal(x.vitrinePublica(e.ctx, 'achadinhos-da-ana')!.ofertas[0]!.link, v.ofertas[0]!.link, 'reaproveita o mesmo link');
  assert.equal(s.registrarClique(e.ctx, v.ofertas[0]!.link.slice(3), 'Mozilla/5.0'), 'https://www.amazon.com.br/dp/x?tag=ana-20');
});
