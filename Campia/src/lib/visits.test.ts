import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySource, isBot, summarize, withOrigin } from './visits';

const p = (q = '') => new URLSearchParams(q);

test('origem pela marca do link', () => {
  assert.equal(classifySource('', p('origem=whatsapp'), 'campia.app.br'), 'whatsapp');
  assert.equal(classifySource('https://google.com/', p('utm_source=ig'), 'campia.app.br'), 'instagram');
  assert.equal(classifySource('', p('utm_source=newsletter'), 'campia.app.br'), 'outros');
});

test('origem pelo site anterior', () => {
  assert.equal(classifySource('', p(), 'campia.app.br'), 'direto');
  assert.equal(classifySource('https://www.google.com.br/', p(), 'campia.app.br'), 'google');
  assert.equal(classifySource('https://l.instagram.com/?u=x', p(), 'campia.app.br'), 'instagram');
  assert.equal(classifySource('https://m.facebook.com/', p(), 'campia.app.br'), 'facebook');
  assert.equal(classifySource('https://duckduckgo.com/', p(), 'campia.app.br'), 'busca');
  assert.equal(classifySource('https://campia.app.br/campeonatos', p(), 'campia.app.br'), 'campia');
  assert.equal(classifySource('https://notgoogle.example.com/', p(), 'campia.app.br'), 'outros');
});

test('link compartilhado e robôs', () => {
  assert.equal(withOrigin('https://x/c/a', 'whatsapp'), 'https://x/c/a?origem=whatsapp');
  assert.equal(withOrigin('https://x/c/a?aba=t', 'whatsapp'), 'https://x/c/a?aba=t&origem=whatsapp');
  assert.ok(isBot('WhatsApp/2.23.20.0'));
  assert.ok(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'));
  assert.ok(!isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'));
});

test('resumo dos últimos dias', () => {
  const s = summarize([
    { day: '2026-10-27', page: 'pagina', source: 'whatsapp', views: 5 },
    { day: '2026-10-26', page: 'pagina', source: 'google', views: 2 },
    { day: '2026-10-26', page: 'pagina', source: 'whatsapp', views: 1 },
    { day: '2026-10-27', page: 'inscricao', source: 'whatsapp', views: 3 },
    { day: '2026-09-01', page: 'pagina', source: 'google', views: 99 },
  ], '2026-10-27', 7);
  assert.equal(s.total, 8);
  assert.equal(s.signup, 3);
  assert.deepEqual(s.sources, [{ source: 'whatsapp', views: 6 }, { source: 'google', views: 2 }]);
  assert.equal(s.daily.length, 7);
  assert.deepEqual(s.daily.slice(-2), [{ day: '2026-10-26', views: 3 }, { day: '2026-10-27', views: 5 }]);
  assert.equal(s.daily[0].day, '2026-10-21');
});
