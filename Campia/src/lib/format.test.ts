import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brl, fmtDate, normalizePhone, parsePlayers, placeLabel, shortName, slugify, validCpfCnpj, waLink } from './format';
import { allowsOnline } from './domain/sports';

test('slug sem acentos', () => {
  assert.equal(slugify('Copa da Firma 2026 — Edição Verão!'), 'copa-da-firma-2026-edicao-verao');
});

test('moeda e data', () => {
  assert.equal(brl(35000).replace(/\s/g, ' '), 'R$ 350,00');
  assert.equal(fmtDate('2026-10-31'), 'sáb, 31/10');
});

test('telefone e link do WhatsApp', () => {
  assert.equal(normalizePhone('(11) 99999-8888'), '11999998888');
  assert.equal(normalizePhone('+55 11 99999-8888'), '11999998888');
  assert.equal(normalizePhone('9999'), null);
  assert.equal(waLink('11 99999-8888', 'oi'), 'https://wa.me/5511999998888?text=oi');
});

test('lista de atletas com número antes ou depois', () => {
  assert.deepEqual(parsePlayers('10 João\nPedro 7\n\n  Carlos  '), [
    { number: '10', name: 'João' }, { number: '7', name: 'Pedro' }, { number: '', name: 'Carlos' },
  ]);
});

test('sigla', () => {
  assert.equal(shortName('Ágil FC'), 'AGI');
  assert.equal(shortName('Ana & Bia'), 'ANA');
  assert.equal(shortName('Time', 'res'), 'RES');
});

test('CPF e CNPJ', () => {
  assert.ok(validCpfCnpj('529.982.247-25'));
  assert.ok(!validCpfCnpj('529.982.247-26'));
  assert.ok(!validCpfCnpj('111.111.111-11'));
  assert.ok(validCpfCnpj('11.222.333/0001-81'));
});

test('local do campeonato', () => {
  const base = { online: false, location: 'Arena Central', city: 'Campinas', state: 'SP' };
  assert.equal(placeLabel(base), 'Arena Central · Campinas - SP');
  assert.equal(placeLabel({ ...base, location: '' }), 'Campinas - SP');
  assert.equal(placeLabel({ ...base, location: '', city: '' }), 'SP');
  assert.equal(placeLabel({ ...base, online: true }), 'Online');
  assert.equal(placeLabel({ online: false, location: '', city: '', state: '' }), '');
  assert.ok(allowsOnline('E-sports (EA FC)'));
  assert.ok(!allowsOnline('Futebol society'));
});
