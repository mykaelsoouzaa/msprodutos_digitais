import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { loadChampionship } from '@/lib/data';
import { placeLabel } from '@/lib/format';
import { sportRules } from '@/lib/domain/sports';
import { tables } from '@/lib/domain/standings';
import { recentForm } from '@/lib/domain/stats';
import { OgSponsors } from '@/lib/og';
import { SPONSOR_SELECT, type Sponsor } from '@/lib/sponsors';
import { ownerIsPro } from '@/lib/plan-server';
import { createClient } from '@/lib/supabase/server';

const FORM_COLOR = { V: '#16a34a', E: '#64748b', D: '#dc2626' } as const;

// Arte de stories (1080×1920) com a classificação: /c/<slug>/arte/tabela?grupo=A (sem grupo: os dois primeiros).
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  if (!data) return new Response('Campeonato não encontrado', { status: 404 });
  const { champ, teams, games } = data;
  const all = tables(champ, games, teams);
  const wanted = request.nextUrl.searchParams.get('grupo');
  const list = (wanted ? all.filter(t => t.title === `Grupo ${wanted}` || t.title === wanted) : all).slice(0, 2);
  if (!list.length) return new Response('Sem tabela', { status: 404 });
  const rules = sportRules(champ.sport);
  const compact = list.reduce((n, t) => n + Math.min(12, t.rows.length), 0) > 10;
  const rowH = compact ? 62 : 84, font = compact ? 30 : 38;

  const pro = await ownerIsPro(supabase, data.row.owner_id);
  const { data: sponsors } = !pro ? { data: [] as Sponsor[] } : await supabase.from('sponsors').select(SPONSOR_SELECT).eq('championship_id', champ.id).order('created_at').returns<Sponsor[]>();
  const cell = (w: number, extra: Record<string, unknown> = {}) => ({ display: 'flex', width: w, justifyContent: 'center', ...extra });

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 80, color: '#eaf4ee',
        background: 'linear-gradient(160deg, #14532d 0%, #0b1410 55%, #052e16 100%)', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: 6, color: '#a3e635', textTransform: 'uppercase' }}>{champ.name}</div>
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, margin: '24px 0 40px' }}>Classificação</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36, flex: 1 }}>
          {list.map(tb => (
            <div key={tb.title ?? 'geral'} style={{ display: 'flex', flexDirection: 'column' }}>
              {tb.title && <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: 'rgba(234,244,238,0.7)', marginBottom: 12 }}>{tb.title}</div>}
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: 'rgba(234,244,238,0.55)', padding: '0 20px 8px' }}>
                <span style={cell(60)}>#</span><span style={{ display: 'flex', flex: 1 }}>Time</span><span style={cell(90)}>P</span><span style={cell(80)}>J</span><span style={cell(100)}>{rules.diff}</span><span style={cell(170)}>Últimos</span>
              </div>
              {tb.rows.slice(0, 12).map((r, i) => (
                <div key={r.team.id} style={{ display: 'flex', alignItems: 'center', height: rowH, fontSize: font, padding: '0 20px', borderRadius: 18, marginBottom: 6,
                  background: i < tb.qualify ? 'rgba(163,230,53,0.16)' : 'rgba(255,255,255,0.06)' }}>
                  <span style={cell(60, { fontWeight: 800 })}>{i + 1}</span>
                  <span style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 14, fontWeight: 700 }}>
                    <span style={{ display: 'flex', width: font + 10, height: font + 10, borderRadius: 10, background: r.team.color || '#334155', alignItems: 'center', justifyContent: 'center', fontSize: font * 0.45, fontWeight: 800, color: '#fff' }}>{r.team.short.slice(0, 3)}</span>
                    {r.team.name.slice(0, 18)}
                  </span>
                  <span style={cell(90, { fontWeight: 800 })}>{r.P}</span>
                  <span style={cell(80)}>{r.J}</span>
                  <span style={cell(100)}>{r.GP - r.GC}</span>
                  <span style={cell(170, { gap: 6 })}>
                    {recentForm(games, r.team.id, 4).map((o, k) => <span key={k} style={{ display: 'flex', width: 30, height: 30, borderRadius: 8, background: FORM_COLOR[o] }} />)}
                  </span>
                </div>
              ))}
            </div>
          ))}
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
