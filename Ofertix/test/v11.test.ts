// Testes da 6.4: passo a passo das lojas (achar a tag da Amazon e os parâmetros do Mercado Livre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairAfiliado } from '../src/regras.ts';

const abrir = async (u: string) => {
  if (u.includes('amzn.to')) return 'https://www.amazon.com.br/dp/B0XYZ?tag=ana-20&linkCode=ll1';
  if (u.includes('/sec/')) return 'https://produto.mercadolivre.com.br/MLB-123-fone?matt_tool=11223344&matt_word=ana&forceInApp=true&tracking_id=abc';
  return u;
};

test('Amazon: acha a tag no link direto e no link curto', async () => {
  assert.equal(await extrairAfiliado('amazon', 'https://www.amazon.com.br/dp/B0?tag=mykael-20', abrir), 'mykael-20');
  assert.equal(await extrairAfiliado('amazon', 'https://amzn.to/3abc', abrir), 'ana-20');
  await assert.rejects(extrairAfiliado('amazon', 'https://www.amazon.com.br/dp/B0', abrir), /não tem a sua tag/);
  await assert.rejects(extrairAfiliado('amazon', 'https://shopee.com.br/x', abrir), /não é da Amazon/);
  await assert.rejects(extrairAfiliado('amazon', 'amazon.com.br', abrir), /https/);
});

test('Mercado Livre: acha os parâmetros de afiliado no link do Gerador de links', async () => {
  assert.equal(await extrairAfiliado('mercadolivre', 'https://mercadolivre.com/sec/1AbCd', abrir), 'matt_tool=11223344&matt_word=ana&tracking_id=abc');
  await assert.rejects(extrairAfiliado('mercadolivre', 'https://produto.mercadolivre.com.br/MLB-1', abrir), /Não achei parâmetros/);
  await assert.rejects(extrairAfiliado('mercadolivre', 'https://www.amazon.com.br/dp/B0', abrir), /não é do Mercado Livre/);
});
