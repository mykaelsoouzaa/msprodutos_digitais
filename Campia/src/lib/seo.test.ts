import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arenaJsonLd, eventJsonLd, safeJson } from './seo';
import type { Championship, Game } from './domain/types';

const champ = {
  id: '1', slug: 'copa', name: 'Copa Teste', sport: 'Futebol society', format: 'grupos', feeCents: 10000,
  location: 'Arena Central', city: 'Campinas', state: 'SP', online: false, visibility: 'publico', rules: {}, schedule: {},
} as unknown as Championship;
const game = (date: string, time: string) => ({ date, time }) as Game;

test('evento: datas do primeiro ao último jogo, local e preço', () => {
  const ld = eventJsonLd({ champ, games: [game('2026-11-21', '10:00'), game('', ''), game('2026-11-14', '09:30')], url: 'https://x/c/copa', imageUrl: 'https://x/i', offerCents: 8000, finished: false })!;
  assert.equal(ld['@type'], 'SportsEvent');
  assert.equal(ld.startDate, '2026-11-14T09:30:00-03:00');
  assert.equal(ld.endDate, '2026-11-21T10:00:00-03:00');
  assert.equal((ld.location as any).address.addressLocality, 'Campinas');
  assert.equal((ld.offers as any).price, '80.00');
});

test('evento: sem datas não gera; encerrado não mostra preço; online usa local virtual', () => {
  assert.equal(eventJsonLd({ champ, games: [game('', '')], url: 'u', imageUrl: 'i', finished: false }), null);
  const ld = eventJsonLd({ champ: { ...champ, online: true }, games: [game('2026-11-14', '')], url: 'u', imageUrl: 'i', offerCents: 100, finished: true })!;
  assert.equal(ld.offers, undefined);
  assert.equal(ld.startDate, '2026-11-14');
  assert.equal((ld.location as any)['@type'], 'VirtualLocation');
});

test('arena e escape de </script>', () => {
  const ld = arenaJsonLd({ name: 'Arena', bio: '', address: '', city: '', state: '', whatsapp: '19999999999', instagram: 'arena', logo_url: '' }, 'u');
  assert.equal(ld.telephone, '+5519999999999');
  assert.equal(ld.address, undefined);
  assert.ok(!safeJson({ n: '</script><b>' }).includes('</script>'));
});
