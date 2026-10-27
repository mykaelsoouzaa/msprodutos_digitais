import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { loadChampionship } from '@/lib/data';
import { placeLabel } from '@/lib/format';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { isDecided, labels, ordered, tables, topScorers } from '@/lib/domain/standings';
import { OgSponsors } from '@/lib/og';
import { SPONSOR_SELECT, type Sponsor } from '@/lib/sponsors';
import { createClient } from '@/lib/supabase/server';

// Arte de stories (1080×1920) com os resultados de uma rodada: /c/<slug>/arte?rodada=Rodada%202
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  if (!data) return new Response('Campeonato não encontrado', { status: 404 });

  const { champ, teams, games, goals, players } = data;
  const played = labels(games).filter(l => games.some(g => g.label === l && isDecided(g)));
  const label = request.nextUrl.searchParams.get('rodada') ?? played[played.length - 1];
  if (!label || !played.includes(label)) return new Response('Rodada sem resultados', { status: 404 });

  const name = (id: string | null) => teams.find(t => t.id === id)?.name ?? '?';
  const short = (id: string | null) => teams.find(t => t.id === id)?.short ?? '?';
  const results = ordered(games).filter(g => g.label === label && isDecided(g)).slice(0, 8);
  const rules = sportRules(champ.sport);
  const top = rules.scorers ? topScorers(games, goals, players, teams)[0] : undefined;
  const leaders = tables(champ, games, teams).map(t => ({ title: t.title ?? 'Líder', row: t.rows[0] }));
  const ko = results[0]?.stage === 'ko';

  const { data: sponsors } = await supabase.from('sponsors').select(SPONSOR_SELECT).eq('championship_id', champ.id).order('created_at').returns<Sponsor[]>();
  const box = { display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 28, padding: '26px 30px', alignItems: 'center' } as const;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 80, color: '#eaf4ee',
        background: 'linear-gradient(160deg, #14532d 0%, #0b1410 55%, #052e16 100%)', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: 6, color: '#a3e635', textTransform: 'uppercase' }}>
          {champ.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 92, fontWeight: 800, lineHeight: 1.05, margin: '24px 0 56px' }}>
          {ko ? <span>{label}</span> : <><span>Resultados da</span><span>{label}</span></>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {results.map(g => (
            <div key={g.id} style={{ ...box, justifyContent: 'space-between', fontSize: 40, fontWeight: 700 }}>
              <span style={{ display: 'flex', width: 340 }}>{name(g.homeId).slice(0, 16)}</span>
              <span style={{ display: 'flex', fontSize: 56, fontWeight: 800 }}>
                {g.wo === 'both' ? 'W.O.' : `${g.homeScore} × ${g.awayScore}`}{g.wo && g.wo !== 'both' ? ' W.O.' : g.penHome !== null && g.homeScore === g.awayScore ? ` (${g.penHome}×${g.penAway})` : ''}
              </span>
              <span style={{ display: 'flex', width: 340, justifyContent: 'flex-end' }}>{name(g.awayId).slice(0, 16)}</span>
            </div>
          ))}
        </div>
        {leaders.length > 0 && !ko && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 56 }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: 4, color: 'rgba(234,244,238,0.65)', textTransform: 'uppercase', marginBottom: 16 }}>
              {leaders.length > 1 ? 'Líderes dos grupos' : 'Líder'}
            </div>
            <div style={{ display: 'flex', gap: 18 }}>
              {leaders.map(l => (
                <div key={l.title} style={{ ...box, flexDirection: 'column', flex: 1, fontSize: 30 }}>
                  <span style={{ display: 'flex', color: 'rgba(234,244,238,0.7)' }}>{l.title}</span>
                  <span style={{ display: 'flex', fontSize: 52, fontWeight: 800 }}>{short(l.row.team.id)}</span>
                  <span style={{ display: 'flex' }}>{l.row.P} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {top && (
          <div style={{ ...box, marginTop: 40, justifyContent: 'space-between', fontSize: 38, fontWeight: 700 }}>
            <span style={{ display: 'flex' }}>{rules.unit === 'pontos' ? 'Cestinha' : 'Artilheiro'}: {top.player.name} ({top.team.short})</span>
            <span style={{ display: 'flex', fontSize: 52, fontWeight: 800 }}>{top.total}</span>
          </div>
        )}
        <div style={{ display: 'flex', marginTop: 'auto', flexDirection: 'column' }}><OgSponsors list={sponsors ?? []} /></div>
        <div style={{ display: 'flex', marginTop: 32, justifyContent: 'space-between', fontSize: 28, color: 'rgba(234,244,238,0.65)' }}>
          <span style={{ display: 'flex' }}>{placeLabel(champ)}</span>
          <span style={{ display: 'flex' }}>feito com Campia · campia.app.br</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
