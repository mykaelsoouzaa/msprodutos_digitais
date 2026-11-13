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

test('ML /social/: página real do Viih Promos (foto tem MLB no nome) fica com o produto do link', async () => {
  const html = `<meta property="og:title" content="Tênis Nike Sb Malor Masculino - R$ 299,99 no Mercado Livre."/>
<meta property="og:image" content="https://http2.mlstatic.com/D_NQ_NP_846237-MLB104793048175_012026-P.webp"/>
<meta property="og:url" content="https://www.mercadolivre.com.br/social/viihpromos?ref=BJ"/>
<img src="https://http2.mlstatic.com/D_Q_NP_2X_846237-MLB104793048175_012026-V-tnis-nike-sb-malor-masculino.webp"/>
<img src="https://http2.mlstatic.com/D_NQ_NP_1-MLB104793048175_012026-P.webp"/>
<a href="https://produto.mercadolivre.com.br/MLB-4419941603-tnis-nike-sb-malor-masculino-_JM?searchVariation=1&amp;matt_event_ts=1">x</a>
<a href="https://produto.mercadolivre.com.br/MLB-4419941603-tnis-nike-sb-malor-masculino-_JM?searchVariation=1">y</a>
<a href="https://produto.mercadolivre.com.br/MLB-5555555555-meia-esportiva-_JM">z</a>`;
  assert.equal(await produtoDoSocialML('https://www.mercadolivre.com.br/social/viihpromos', pagina(html)), 'https://produto.mercadolivre.com.br/MLB-4419941603-tnis-nike-sb-malor-masculino-_JM');
});

test('ML /social/: só foto com MLB no nome e nenhum link de produto não troca', async () => {
  const html = '<img src="https://http2.mlstatic.com/D_NQ_NP_846237-MLB104793048175_012026-P.webp"/>';
  assert.equal(await produtoDoSocialML('https://www.mercadolivre.com.br/social/viih', pagina(html)), '');
});

test('ML /social/: vitrine sem destaque (empate) não troca', async () => {
  const html = '<a href="https://produto.mercadolivre.com.br/MLB-1111111111-a-_JM">a</a><a href="https://produto.mercadolivre.com.br/MLB-2222222222-b-_JM">b</a>';
  assert.equal(await produtoDoSocialML('https://www.mercadolivre.com.br/social/viih', pagina(html)), '');
  assert.equal(await produtoDoSocialML('https://www.mercadolivre.com.br/social/viih', pagina('', false)), '');
});
