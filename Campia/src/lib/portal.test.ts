import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign, type KeyObject } from 'node:crypto';
import { chavePortal, conferirAcessoPortal } from './portal';

const EMISSOR = 'https://mssolucoestech.com.br';
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const chave = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const AGORA = Date.UTC(2026, 10, 9, 18, 0, 0);
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function token(dados: Record<string, unknown> = {}, k: KeyObject = privateKey, alg = 'EdDSA') {
  const iat = Math.floor(AGORA / 1000);
  const corpo = `${b64({ alg, typ: 'JWT' })}.${b64({ iss: EMISSOR, aud: 'campia', iat, exp: iat + 60, jti: randomUUID(), email: 'Org@Arena.com', nome: 'Org', ...dados })}`;
  return `${corpo}.${sign(null, Buffer.from(corpo), k).toString('base64url')}`;
}
const conferir = (t: string, agora = AGORA) => conferirAcessoPortal(t, { chave, emissor: EMISSOR, agora });

test('acesso do portal válido entra com o e-mail em minúsculas', () => {
  const r = conferir(token());
  assert.equal(r?.email, 'org@arena.com');
  assert.equal(r?.nome, 'Org');
});

test('recusa outro sistema, outro emissor, chave errada, vencido e sem e-mail', () => {
  assert.equal(conferir(token({ aud: 'nina' })), null);
  assert.equal(conferir(token({ iss: 'https://outro.com' })), null);
  assert.equal(conferir(token({}, generateKeyPairSync('ed25519').privateKey)), null);
  assert.equal(conferir(token(), AGORA + 61_000), null);
  assert.equal(conferir(token({ email: 'sem-arroba' })), null);
  assert.equal(conferir(token({}, privateKey, 'none')), null);
  assert.equal(conferir('a.b.c'), null);
  assert.equal(conferirAcessoPortal(token(), { chave: '', emissor: EMISSOR, agora: AGORA }), null);
});

test('chave colada numa linha só', () => {
  assert.equal(chavePortal(chave.replace(/\n/g, '\\n')), chave.trim());
});
