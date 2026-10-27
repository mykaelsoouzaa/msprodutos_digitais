import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChampCard from '@/components/ChampCard';
import { Tabs } from '@/components/champ';
import { arenaRanking } from '@/lib/arena-ranking';
import { type ChampData, loadChampionship } from '@/lib/data';
import type { VoteResult } from '@/lib/voting';
import { type ArenaRow, initials } from '@/lib/arena';
import { LISTING_SELECT, type ListingRow, toListing } from '@/lib/explore';
import { siteUrl } from '@/lib/env';
import { cityState, waLink } from '@/lib/format';
import { arenaJsonLd, safeJson } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getArena(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('arenas').select('*').eq('slug', slug).maybeSingle<ArenaRow>();
  return { supabase, arena: data };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { arena } = await getArena((await params).slug);
  if (!arena) return { title: 'Arena' };
  return { title: arena.name, description: arena.bio || `Campeonatos organizados por ${arena.name} na Campia.`, alternates: { canonical: `/arena/${arena.slug}` } };
}

async function loadRanking(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const datas = (await Promise.all(ids.slice(0, 30).map(id => loadChampionship(supabase, { id })))).filter((d): d is ChampData => !!d);
  const { data: claims } = datas.length
    ? await supabase.from('player_claims').select('player_id, user_id').in('championship_id', datas.map(d => d.champ.id)).eq('status', 'aprovado')
      .returns<Array<{ player_id: string; user_id: string }>>()
    : { data: [] as Array<{ player_id: string; user_id: string }> };
  const { data: athletes } = claims?.length
    ? await supabase.from('athletes').select('user_id, handle').in('user_id', [...new Set(claims.map(c => c.user_id))]).returns<Array<{ user_id: string; handle: string }>>()
    : { data: [] as Array<{ user_id: string; handle: string }> };
  const linked = new Map((claims ?? []).flatMap(c => {
    const a = athletes?.find(x => x.user_id === c.user_id);
    return a ? [[c.player_id, { userId: c.user_id, handle: a.handle }] as const] : [];
  }));
  const votes = new Map<string, VoteResult[]>();
  await Promise.all(datas.filter(d => d.champ.voting === 'encerrada').map(async d => {
    const { data } = await supabase.rpc('vote_results', { champ: d.champ.id });
    votes.set(d.champ.id, (data ?? []) as VoteResult[]);
  }));
  return arenaRanking(datas, linked, votes);
}

export default async function ArenaPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { slug } = await params;
  const tab = (await searchParams).aba === 'ranking' ? 'ranking' : 'campeonatos';
  const { supabase, arena } = await getArena(slug);
  if (!arena) notFound();

  const { data } = await supabase.from('championships').select(LISTING_SELECT)
    .eq('owner_id', arena.owner_id).eq('visibility', 'publico').order('created_at', { ascending: false }).limit(100).returns<ListingRow[]>();
  const items = toListing(data ?? []);
  const current = items.filter(c => c.status !== 'encerrado');
  const past = items.filter(c => c.status === 'encerrado');
  const place = [arena.address, cityState(arena.city, arena.state)].filter(Boolean).join(' · ');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(arenaJsonLd(arena, `${siteUrl()}/arena/${arena.slug}`)) }} />
      <section className="arena-hero">
        {arena.logo_url ? <img src={arena.logo_url} alt={`Logo ${arena.name}`} className="arena-logo" /> : <span className="arena-logo empty">{initials(arena.name)}</span>}
        <div className="grow">
          <h1>{arena.name}</h1>
          {place && <p className="sub" style={{ margin: '0 0 6px' }}>📍 {place}</p>}
          {arena.bio && <p className="arena-bio">{arena.bio}</p>}
          <div className="actions">
            {arena.whatsapp && <a className="btn wa sm" target="_blank" rel="noopener" href={waLink(arena.whatsapp, `Olá! Vi a página da ${arena.name} na Campia.`)}>WhatsApp</a>}
            {arena.instagram && <a className="btn ghost sm" target="_blank" rel="noopener" href={`https://instagram.com/${arena.instagram}`}>@{arena.instagram}</a>}
            {place && !/^\s*$/.test(place) && <a className="btn ghost sm" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${arena.name} ${place}`)}`}>Como chegar</a>}
          </div>
        </div>
      </section>

      <div style={{ marginTop: 24 }}><Tabs items={[['campeonatos', 'Campeonatos'], ['ranking', '🏆 Ranking']]} current={tab} base={`/arena/${arena.slug}`} /></div>
      {tab === 'ranking' ? <RankingView r={await loadRanking(supabase, items.map(c => c.id))} /> : (<>
      <h2 className="section-title" style={{ marginTop: 12 }}>Campeonatos</h2>
      {current.length ? <div className="grid-cards" style={{ marginTop: 12 }}>{current.map(c => <ChampCard key={c.id} c={c} />)}</div>
        : <div className="card empty" style={{ marginTop: 12 }}>Nenhum campeonato acontecendo agora.</div>}

      {past.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 32 }}>Anteriores</h2>
          <div className="grid-cards" style={{ marginTop: 12 }}>{past.map(c => <ChampCard key={c.id} c={c} />)}</div>
        </>
      )}
      </>)}
      <p className="sub small" style={{ textAlign: 'center', marginTop: 32 }}>Organiza campeonatos? <Link href="/">Crie o seu na Campia</Link>.</p>
    </>
  );
}

function RankingView({ r }: { r: ReturnType<typeof arenaRanking> }) {
  if (!r.titles.length && !r.scorers.length && !r.awards.length) {
    return <div className="card empty">O ranking aparece quando os campeonatos da arena tiverem resultados.</div>;
  }
  return (
    <div className="ranking">
      {r.topTeams.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Times mais vencedores</h2>
          {r.topTeams.map((t, i) => (
            <div key={t.team.name} className="rank-row">
              <span className="rank-pos">{i + 1}º</span>
              <span className="dot" style={{ background: t.team.color }}>{t.team.short}</span>
              <span className="grow">{t.team.name}</span>
              <b>{'🏆'.repeat(Math.min(t.titles, 5))}{t.titles > 5 ? ` ${t.titles}` : ''}</b>
            </div>
          ))}
        </section>
      )}
      {r.scorers.map(s => (
        <section key={s.sport} className="card">
          <h2 style={{ marginTop: 0 }}>{s.unit === 'pontos' ? 'Cestinhas' : 'Artilheiros'} · {s.sport}</h2>
          {s.list.map((p, i) => (
            <div key={p.key} className="rank-row">
              <span className="rank-pos">{i + 1}º</span>
              <span className="grow">
                {p.handle ? <Link href={`/atleta/${p.handle}`}><b>{p.name}</b></Link> : <b>{p.name}</b>}
                <span className="sub small">{p.team}{p.championships > 1 ? ` · ${p.championships} campeonatos` : ''}</span>
              </span>
              <b className="rank-total">{p.total}</b>
            </div>
          ))}
        </section>
      ))}
      {r.titles.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Campeões</h2>
          {r.titles.map(t => (
            <div key={t.champ.slug} className="rank-row">
              <span className="dot" style={{ background: t.team.color }}>{t.team.short}</span>
              <span className="grow"><b>{t.team.name}</b><span className="sub small"><Link href={`/c/${t.champ.slug}`}>{t.champ.name}</Link></span></span>
            </div>
          ))}
        </section>
      )}
      {r.awards.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Craques eleitos</h2>
          {r.awards.map(a => (
            <div key={`${a.champ.slug}-${a.label}`} className="rank-row">
              <span className="rank-pos">🏅</span>
              <span className="grow">
                {a.handle ? <Link href={`/atleta/${a.handle}`}><b>{a.player}</b></Link> : <b>{a.player}</b>}
                <span className="sub small">{a.label} · <Link href={`/c/${a.champ.slug}`}>{a.champ.name}</Link></span>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
