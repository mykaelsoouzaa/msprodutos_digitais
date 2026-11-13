import { test } from 'node:test';
import assert from 'node:assert/strict';
import { produtoDoSocialML } from '../src/links.ts';

const pagina = (html: string, ok = true) => (async () => new Response(html, { status: ok ? 200 : 404 })) as unknown as typeof fetch;

test('ML /social/: código do produto no próprio endereço', async () => {
  const u = 'https://www.mercadolivre.com.br/social/viihpromos?matt_word=x&ref=https%3A%2F%2Fproduto.mercadolivre.com.br%2FMLB-3876543210-vestido';
  assert.equal(await produtoDoSocialML(u, pagina('')), 'https://produto.mercadolivre.com.br/MLB-3876543210');
});

test('ML /social/: produto achado na página', async () => {
  const html = '<a href="https://www.mercadolivre.com.br/vestido-virgulado/p/MLB12345678?pdp_filters=x">ver</a>';
  assert.equal(await produtoDoSocialML('https://www.mercadolivre.com.br/social/viih', pagina(html)), 'https://www.mercadolivre.com.br/vestido-virgulado/p/MLB12345678');
});

test('ML /social/: vitrine com vários produtos não troca', async () => {
  const html = 'MLB-1111111111 MLB-2222222222 MLB-3333333333';
  assert.equal(await produtoDoSocialML('https://www.mercadolivre.com.br/social/viih', pagina(html)), '');
  assert.equal(await produtoDoSocialML('https://www.mercadolivre.com.br/social/viih', pagina('', false)), '');
});
