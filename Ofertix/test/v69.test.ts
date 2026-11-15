// Testes da 6.9: campanhas da Shopee, validade do cupom e leitura das comissões.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, contaPorEmail } from '../src/db.ts';
import { WhatsAppSimulado } from '../src/whatsapp.ts';
import * as s from '../src/servico.ts';
import { campanhasShopee, comissoesShopee } from '../src/shopee.ts';
import { lerPagina } from '../src/links.ts';

test('campanhas da Shopee: nome, link, comissão e fim', async () => {
  const f = (async () => Response.json({ data: { shopeeOfferV2: { nodes: [{ offerName: 'Liquida 11.11', offerLink: 'https://s.shopee.com.br/x', commissionRate: '0.12', imageUrl: 'https://cf/x.jpg', periodStartTime: 1763000000, periodEndTime: 1763600000 }, { offerName: '', offerLink: '' }] } } })) as any;
  const l = await campanhasShopee({ appId: '1', segredo: 's' }, f);
  assert.equal(l.length, 1);
  assert.deepEqual([l[0]!.nome, l[0]!.comissaoPct, l[0]!.fim], ['Liquida 11.11', 12, 1763600000000]);
});

test('comissões: pedido em janelas de 7 dias e campos alternativos de valor', async () => {
  const janelas: string[] = [];
  const f = (async (_u: string, o: any) => {
    const q = JSON.parse(o.body).query as string;
    janelas.push(q.match(/purchaseTimeStart:(\d+)/)![1]!);
    if (q.includes('actualAmount')) return Response.json({ errors: [{ message: 'Cannot query field "actualAmount"' }] });
    return Response.json({ data: { conversionReport: { nodes: janelas.length === 2 ? [{ purchaseTime: 1763000000, orders: [{ orderId: 'P1', orderStatus: 'COMPLETED', items: [{ itemName: 'Fone', itemPrice: '50', qty: 2, itemTotalCommission: '8' }] }] }] : [], pageInfo: { hasNextPage: false } } } });
  }) as any;
  const itens = await comissoesShopee({ appId: '1', segredo: 's' }, 0, 14 * 86400, f);
  assert.equal(itens.length, 1);
  assert.deepEqual([itens[0]!.valor, itens[0]!.comissao, itens[0]!.status], [10000, 800, 'concluido']);
  assert.ok(new Set(janelas).size >= 2, 'duas janelas de 7 dias');
});

test('leitura das comissões fica registrada (com o erro, se der); cupom vencido não entra no texto', async () => {
  const db = abrirBanco(':memory:');
  const f = (async () => Response.json({ errors: [{ message: 'Invalid Signature' }] })) as any;
  const ctx = { db, wpp: new WhatsAppSimulado(), f, urlPublica: 'https://o.teste' };
  const conta = contaPorEmail(db, 'a@b.com', 'A').id;
  db.prepare("UPDATE config_conta SET shopee_app_id = '1', shopee_segredo = 's' WHERE conta_id = ?").run(conta);
  await assert.rejects(s.sincronizarComissoes(ctx, conta), /Invalid Signature/);
  const r = s.resumoComissoes(ctx, conta, '30d');
  assert.equal(r.shopee.conectada, true);
  assert.match(r.shopee.erro, /Invalid Signature/);
  db.prepare("INSERT INTO cupons (conta_id, codigo, plataforma, descricao, validade) VALUES (?, 'VELHO10', 'shopee', '', '2020-01-01')").run(conta);
  const o = { plataforma: 'shopee', titulo: 'Fone', preco_de: null, preco_por: 4990, url_afiliado: 'https://s.shopee.com.br/a', categoria: '' };
  assert.doesNotMatch(s.textoOferta(db, conta, o as any), /VELHO10/);
  db.prepare("INSERT INTO cupons (conta_id, codigo, plataforma, descricao, validade) VALUES (?, 'NOVO10', 'shopee', '', '2099-01-01')").run(conta);
  assert.match(s.textoOferta(db, conta, o as any), /NOVO10/);
});

test('foto da página: og:image:secure_url, twitter:image e endereço sem https', () => {
  assert.equal(lerPagina('<meta name="twitter:image" content="//http2.mlstatic.com/a.jpg">').imagem, 'https://http2.mlstatic.com/a.jpg');
  assert.equal(lerPagina('<meta property="og:image:secure_url" content="https://x/b.jpg"><meta property="og:image" content="http://x/b.jpg">').imagem, 'https://x/b.jpg');
});

test('6.10: grupo monitorado não entra em membros nem no resumo do WhatsApp', async () => {
  const db = abrirBanco(':memory:');
  const ctx = { db, wpp: new WhatsAppSimulado(), f: (async () => new Response('')) as any, urlPublica: 'https://o.teste' };
  const conta = contaPorEmail(db, 'a@b.com', 'A').id;
  const inst = await s.novaInstancia(ctx, conta, 'Principal');
  await s.atualizarEstado(ctx, conta, inst);
  const g = db.prepare('SELECT id, jid FROM grupos WHERE conta_id = ? ORDER BY id').all(conta) as any[];
  db.prepare("UPDATE contas SET plano = 'pro' WHERE id = ?").run(conta);
  s.alternarGrupo(db, conta, g[0].id, 'enviar', true);
  s.alternarGrupo(db, conta, g[1].id, 'monitorar', true);
  const i = db.prepare('SELECT chave, token_webhook FROM instancias').get() as any;
  const ev = (jid: string, n: number, action: string) => s.eventoWhatsApp(ctx, i.chave, i.token_webhook, { event: 'group-participants.update', data: { id: jid, participants: Array(n).fill('x'), action } });
  await ev(g[0].jid, 2, 'add');
  await ev(g[1].jid, 300, 'add');
  await ev(g[1].jid, 200, 'remove');
  const m = s.membros(ctx, conta, '7d');
  assert.equal(m.entradas, 2);
  assert.equal(m.saidas, 0);
  assert.equal(m.grupos, 1);
  assert.ok(m.churnDiario <= 100);
  assert.match(s.textoResumo(ctx, conta), /\+2 \/ −0 membros nos seus grupos/);
});
