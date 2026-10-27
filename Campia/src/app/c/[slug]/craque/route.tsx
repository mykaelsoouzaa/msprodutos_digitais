import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { loadChampionship } from '@/lib/data';
import { sportLabel } from '@/lib/domain/sports';
import { CampiaMark } from '@/lib/og';
import { createClient } from '@/lib/supabase/server';
import { type VoteResult, categoriesFor, ranking } from '@/lib/voting';

// Arte de stories (1080×1920) com os vencedores da votação: /c/<slug>/craque
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  if (!data || data.champ.voting !== 'encerrada') return new Response('Votação não encerrada', { status: 404 });
  const { data: rows } = await supabase.rpc('vote_results', { champ: data.champ.id });
  const results = (rows ?? []) as VoteResult[];
  const cats = categoriesFor(data.champ.sport);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 80, color: '#eaf4ee',
        background: 'linear-gradient(160deg, #14532d 0%, #0b1410 55%, #052e16 100%)', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <CampiaMark size={72} />
          <span style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#a3e635', letterSpacing: 4, textTransform: 'uppercase' }}>{sportLabel(data.champ.sport)}</span>
        </div>
        <span style={{ display: 'flex', fontSize: 52, fontWeight: 800, marginTop: 40 }}>{data.champ.name}</span>
        <span style={{ display: 'flex', fontSize: 96, fontWeight: 800, lineHeight: 1.05, margin: '20px 0 60px' }}>Destaques do campeonato</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {cats.map(([cat, label]) => {
            const top = ranking(results, data.players, data.teams, cat)[0];
            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.08)', borderRadius: 32, padding: '32px 40px' }}>
                <span style={{ display: 'flex', fontSize: 32, color: '#a3e635', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3 }}>{label}</span>
                <span style={{ display: 'flex', fontSize: 64, fontWeight: 800, marginTop: 8 }}>🏅 {top ? top.player.name : '—'}</span>
                {top?.team && <span style={{ display: 'flex', fontSize: 36, color: 'rgba(234,244,238,0.7)', marginTop: 6 }}>{top.team.name}</span>}
              </div>
            );
          })}
        </div>
        <span style={{ display: 'flex', marginTop: 'auto', fontSize: 28, color: 'rgba(234,244,238,0.6)' }}>feito com Campia · campia.app.br</span>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
