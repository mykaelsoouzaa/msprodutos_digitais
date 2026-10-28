import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { loadChampionship } from '@/lib/data';
import { fmtDate, placeLabel } from '@/lib/format';
import { sportRules } from '@/lib/domain/sports';
import { isDecided } from '@/lib/domain/standings';
import { OgSponsors } from '@/lib/og';
import { SPONSOR_SELECT, type Sponsor } from '@/lib/sponsors';
import { ownerIsPro } from '@/lib/plan-server';
import { createClient } from '@/lib/supabase/server';

// Arte de stories (1080×1920) com o resultado de um jogo.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; gameId: string }> }) {
  const { slug, gameId } = await params;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  const g = data?.games.find(x => x.id === gameId);
  if (!data || !g || !isDecided(g)) return new Response('Jogo sem resultado', { status: 404 });
  const { champ, teams, goals, players } = data;
  const rules = sportRules(champ.sport);
  const team = (id: string | null) => teams.find(t => t.id === id);
  const sides = [team(g.homeId), team(g.awayId)];
  const scorers = (teamId: string | undefined) => {
    const by = new Map<string, number>();
    for (const x of goals) if (x.gameId === g.id && x.teamId === teamId) by.set(x.playerId, (by.get(x.playerId) ?? 0) + x.count);
    return [...by].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([pid, n]) => `${players.find(p => p.id === pid)?.name ?? '?'}${n > 1 ? ` (${n})` : ''}`);
  };

  const pro = await ownerIsPro(supabase, data.row.owner_id);
  const { data: sponsors } = !pro ? { data: [] as Sponsor[] } : await supabase.from('sponsors').select(SPONSOR_SELECT).eq('championship_id', champ.id).order('created_at').returns<Sponsor[]>();
  const stage = g.stage === 'ko' ? g.name : [g.group ? `Grupo ${g.group}` : '', g.label].filter(Boolean).join(' · ');
  const score = g.wo === 'both' ? 'W.O.' : `${g.homeScore} × ${g.awayScore}`;
  const extra = g.wo && g.wo !== 'both' ? 'W.O.' : g.penHome !== null && g.homeScore === g.awayScore ? `${rules.tieLabel || 'Desempate'} ${g.penHome} × ${g.penAway}` : '';

  const teamBox = (t: typeof sides[number]) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 300 }}>
      <div style={{ display: 'flex', width: 220, height: 220, borderRadius: 56, background: t?.color || '#334155', alignItems: 'center', justifyContent: 'center', fontSize: 76, fontWeight: 800, color: '#fff' }}>{t?.short ?? '?'}</div>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, marginTop: 24, textAlign: 'center', justifyContent: 'center' }}>{(t?.name ?? '?').slice(0, 18)}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 80, color: '#eaf4ee',
        background: 'linear-gradient(160deg, #14532d 0%, #0b1410 55%, #052e16 100%)', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: 6, color: '#a3e635', textTransform: 'uppercase' }}>{champ.name}</div>
        <div style={{ display: 'flex', fontSize: 40, marginTop: 16, color: 'rgba(234,244,238,0.7)' }}>{[stage, g.date ? fmtDate(g.date) : ''].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: 120, fontWeight: 800 }}>Fim de jogo</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 80 }}>
          {teamBox(sides[0])}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 320, paddingTop: 40 }}>
            <div style={{ display: 'flex', fontSize: score.length > 7 ? 100 : 140, fontWeight: 800, letterSpacing: -3 }}>{score}</div>
            {extra && <div style={{ display: 'flex', fontSize: 30, color: 'rgba(234,244,238,0.7)', textAlign: 'center' }}>{extra}</div>}
          </div>
          {teamBox(sides[1])}
        </div>
        {rules.scorers && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 80, fontSize: 38 }}>
            {sides.map((t, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 440, alignItems: i ? 'flex-end' : 'flex-start' }}>
                {scorers(t?.id).map(s => <span key={s} style={{ display: 'flex' }}>⚽ {s}</span>)}
              </div>
            ))}
          </div>
        )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}><OgSponsors list={sponsors ?? []} /></div>
        <div style={{ display: 'flex', marginTop: 32, justifyContent: 'space-between', fontSize: 28, color: 'rgba(234,244,238,0.65)' }}>
          <span style={{ display: 'flex' }}>{placeLabel(champ)}</span>
          <span style={{ display: 'flex' }}>{pro ? '' : 'feito com Campia · campia.app.br'}</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
