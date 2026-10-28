import { loadChampionship } from '@/lib/data';
import { sourceLabel } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { placeLabel } from '@/lib/format';
import { buildIcs } from '@/lib/ics';
import { createPublicClient } from '@/lib/supabase/public';

/** Agenda dos jogos do campeonato (ou só de um time: ?time=<id>). Os apps de agenda buscam de novo de tempos em tempos. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadChampionship(createPublicClient(), { slug });
  if (!data) return new Response('Campeonato não encontrado', { status: 404 });
  const { champ, teams, games } = data;
  const teamId = new URL(request.url).searchParams.get('time');
  const team = teamId ? teams.find(t => t.id === teamId) : undefined;
  const name = (id: string | null, src: Parameters<typeof sourceLabel>[1]) => teams.find(t => t.id === id)?.name ?? sourceLabel(games, src, teams);
  const url = `${siteUrl()}/c/${champ.slug}`;
  const place = placeLabel(champ);
  const list = games.filter(g => !team || g.homeId === team.id || g.awayId === team.id);

  const ics = buildIcs(team ? `${team.name} · ${champ.name}` : champ.name, list.map(g => ({
    uid: `${g.id}@campia.app.br`,
    date: g.date, time: g.time,
    title: `${name(g.homeId, g.srcHome)} x ${name(g.awayId, g.srcAway)} · ${champ.name}`,
    location: [g.field, place].filter(Boolean).join(' · '),
    description: [g.stage === 'ko' ? g.name : [g.group ? `Grupo ${g.group}` : '', g.label].filter(Boolean).join(' · '), `Tabela e resultados: ${url}`].filter(Boolean).join('\n'),
    url,
  })));
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `inline; filename="${champ.slug}${team ? `-${team.short.toLowerCase()}` : ''}.ics"`,
      'cache-control': 'public, max-age=900',
    },
  });
}
