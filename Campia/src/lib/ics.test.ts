import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, calendarLinks } from './ics';

test('agenda .ics', () => {
  const ics = buildIcs('Copa, 2026', [
    { uid: 'g1@campia.app.br', date: '2026-11-07', time: '09:00', title: 'Real x Tsunami', location: 'Campo 1, Arena', description: 'Rodada 1\nGrupo A', url: 'https://campia.app.br/c/copa' },
    { uid: 'g2@campia.app.br', date: '2026-11-14', time: '', title: 'Final', location: '', description: '', url: 'u' },
    { uid: 'g3', date: '', time: '', title: 'sem data', location: '', description: '', url: 'u' },
  ], new Date('2026-10-28T12:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.match(ics, /X-WR-CALNAME:Copa\\, 2026/);
  assert.match(ics, /DTSTART:20261107T120000Z/);
  assert.match(ics, /DTEND:20261107T130000Z/);
  assert.match(ics, /LOCATION:Campo 1\\, Arena/);
  assert.match(ics, /DESCRIPTION:Rodada 1\\nGrupo A/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261114\r\nDTEND;VALUE=DATE:20261115/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.ok(ics.split('\r\n').every(l => l.length <= 75));
  const l = calendarLinks('https://campia.app.br/c/copa/agenda.ics?time=1');
  assert.equal(l.webcal, 'webcal://campia.app.br/c/copa/agenda.ics?time=1');
  assert.match(l.google, /^https:\/\/calendar\.google\.com\/calendar\/r\?cid=webcal%3A%2F%2F/);
});
