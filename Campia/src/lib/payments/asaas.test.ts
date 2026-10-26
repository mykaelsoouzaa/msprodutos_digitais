// Simulação do Asaas: um servidor falso com duas contas (Campia e arena) responde como a API v3
// e confere o que a Campia envia ao criar a cobrança com repasse para a arena e ao receber o PIX.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { organizerPercent } from '../payout';
import { createAsaasPixCharge, platformWalletId } from './asaas';

const CAMPIA_KEY = '$aact_campia_teste';
const ARENA_KEY = '$aact_arena_teste';
const WALLETS: Record<string, string> = {
  [CAMPIA_KEY]: '11111111-1111-4111-8111-111111111111',
  [ARENA_KEY]: '22222222-2222-4222-8222-222222222222',
};
const TARIFA_PIX = 0.99; // tarifa simulada do Asaas por PIX recebido

interface Charge { id: string; value: number; externalReference: string; split?: Array<{ walletId: string; percentualValue: number }>; deleted?: boolean }
const state = { calls: [] as Array<{ method: string; path: string; key: string; body: any }>, charges: [] as Charge[], failQr: false, balances: {} as Record<string, number> };

let server: Server;
before(async () => {
  server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    const key = String(req.headers['access_token'] || '');
    const path = (req.url || '').replace(/^\/v3/, '');
    state.calls.push({ method: req.method!, path, key, body });
    const send = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

    if (!WALLETS[key]) return send(401, { errors: [{ description: 'A chave de API informada não pertence a este ambiente' }] });
    if (req.method === 'GET' && path === '/wallets') return send(200, { object: 'list', data: [{ object: 'wallet', id: WALLETS[key] }] });
    if (req.method === 'POST' && path === '/customers') return send(200, { id: 'cus_000001' });
    if (req.method === 'POST' && path === '/payments') {
      for (const s of body.split ?? []) {
        if (s.walletId === WALLETS[key]) return send(400, { errors: [{ description: 'Não é permitido informar a própria carteira no split' }] });
        if (!Object.values(WALLETS).includes(s.walletId)) return send(400, { errors: [{ description: 'Wallet [walletId] inexistente' }] });
      }
      const c: Charge = { id: `pay_${state.charges.length + 1}`, value: body.value, externalReference: body.externalReference, split: body.split };
      state.charges.push(c);
      return send(200, { id: c.id });
    }
    const qr = path.match(/^\/payments\/(pay_\d+)\/pixQrCode$/);
    if (req.method === 'GET' && qr) {
      if (state.failQr) return send(400, { errors: [{ description: 'Você não possui uma chave Pix cadastrada para recebimentos de cobranças via Pix.' }] });
      return send(200, { encodedImage: 'iVBORw0KGgo=', payload: '00020126...6304ABCD', expirationDate: '2026-10-27 23:59:59' });
    }
    const del = path.match(/^\/payments\/(pay_\d+)$/);
    if (req.method === 'DELETE' && del) {
      const c = state.charges.find(x => x.id === del[1]); if (c) c.deleted = true;
      return send(200, { deleted: true, id: del[1] });
    }
    send(404, { errors: [{ description: 'rota não simulada' }] });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  process.env.ASAAS_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v3`;
  process.env.ASAAS_API_KEY = CAMPIA_KEY;
});
after(() => server.close());

/** O que o Asaas faz quando o PIX é pago: desconta a tarifa e divide o líquido conforme o split. */
function pagar(c: Charge) {
  const net = Math.round((c.value - TARIFA_PIX) * 100) / 100;
  let restante = net;
  for (const s of c.split ?? []) {
    const parte = Math.round(net * s.percentualValue) / 100;
    const conta = Object.keys(WALLETS).find(k => WALLETS[k] === s.walletId)!;
    state.balances[conta] = (state.balances[conta] ?? 0) + parte;
    restante = Math.round((restante - parte) * 100) / 100;
  }
  state.balances[CAMPIA_KEY] = Math.round(((state.balances[CAMPIA_KEY] ?? 0) + restante) * 100) / 100;
  return net;
}

const input = (id: string) => ({ paymentId: id, amountCents: 30000, description: 'Inscrição Real Várzea · Copa Teste', payerName: 'Capitão', payerPhone: '31999999999', payerCpfCnpj: '52998224725' });

test('2. inscrição com repasse: cobrança sai com split de 90% para a arena e o PIX divide o valor', async () => {
  const before = state.calls.length;
  const charge = await createAsaasPixCharge({ ...input('inscricao-1'), split: { walletId: WALLETS[ARENA_KEY], percent: organizerPercent(10) } });
  assert.equal(charge.splitApplied, true);
  assert.ok(charge.payload && charge.imageBase64);

  const post = state.calls.slice(before).find(c => c.method === 'POST' && c.path === '/payments')!;
  assert.equal(post.key, CAMPIA_KEY, 'a cobrança é criada na conta da Campia');
  assert.equal(post.body.billingType, 'PIX');
  assert.equal(post.body.value, 300);
  assert.equal(post.body.externalReference, 'inscricao-1');
  assert.deepEqual(post.body.split, [{ walletId: WALLETS[ARENA_KEY], percentualValue: 90 }]);

  const net = pagar(state.charges.find(c => c.id === charge.providerId)!);
  assert.equal(net, 299.01);
  assert.equal(state.balances[ARENA_KEY], 269.11);   // 90% de 299,01
  assert.equal(state.balances[CAMPIA_KEY], 29.9);    // o restante fica com a Campia
});

test('3. Wallet ID inválido: a inscrição continua, sem split, e o repasse fica manual', async () => {
  const before = state.calls.length;
  const charge = await createAsaasPixCharge({ ...input('inscricao-2'), split: { walletId: '99999999-9999-4999-8999-999999999999', percent: 90 } });
  assert.equal(charge.splitApplied, false);
  const posts = state.calls.slice(before).filter(c => c.method === 'POST' && c.path === '/payments');
  assert.equal(posts.length, 2, 'tenta com split e refaz sem split');
  assert.equal(posts[1].body.split, undefined);
});

test('4. organizador conectou a conta da própria Campia: o Asaas recusa e cai no repasse manual', async () => {
  const charge = await createAsaasPixCharge({ ...input('inscricao-3'), split: { walletId: WALLETS[CAMPIA_KEY], percent: 90 } });
  assert.equal(charge.splitApplied, false);
});

test('5. conta sem chave PIX: a cobrança criada é apagada no Asaas e a inscrição mostra o erro', async () => {
  state.failQr = true;
  try {
    await assert.rejects(createAsaasPixCharge(input('inscricao-4')), /chave Pix/);
    const c = state.charges.find(x => x.externalReference === 'inscricao-4')!;
    assert.equal(c.deleted, true);
  } finally { state.failQr = false; }
});

test('6. sem repasse: a cobrança não leva split', async () => {
  const before = state.calls.length;
  const charge = await createAsaasPixCharge(input('inscricao-5'));
  assert.equal(charge.splitApplied, false);
  const post = state.calls.slice(before).find(c => c.method === 'POST' && c.path === '/payments')!;
  assert.equal(post.body.split, undefined);
});

test('7. a Campia sabe o próprio Wallet ID, para barrar quem tentar conectar essa carteira', async () => {
  assert.equal(await platformWalletId(), WALLETS[CAMPIA_KEY]);
});
