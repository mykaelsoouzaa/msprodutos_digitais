import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Discipline, Flash, GameRow, GamesList, Scorers, TableTab, Tabs } from '@/components/champ';
import AutoRefresh from '@/components/AutoRefresh';
import VotingTab from '@/components/VotingTab';
import ReminderButton from '@/components/ReminderButton';
import { type ArenaRow, initials } from '@/lib/arena';
import { loadChampionship } from '@/lib/data';
import SportIcon from '@/components/SportIcon';
import { FORMATS, sportLabel, sportRules } from '@/lib/domain/sports';
import { champion as getChampion, isDecided, ordered } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { brl, placeLabel, waLink } from '@/lib/format';
import { currentPrice, priceText, todayBr } from '@/lib/pricing';
import { eventJsonLd, safeJson } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('championships').select('name, sport, visibility, city, state').eq('slug', slug).maybeSingle();
  if (!data) return { title: 'Campeonato' };
  const where = [data.city, data.state].filter(Boolean).join(' - ');
  const description = `${data.name}: campeonato de ${sportLabel(data.sport).toLowerCase()}${where ? ` em ${where}` : ''}. Jogos, tabela, artilharia e inscrição na Campia.`;
  return {
    title: data.name,
    description,
    alternates: { canonical: `/c/${slug}` },
    openGraph: { title: data.name, description, type: 'website' },
    robots: data.visibility === 'publico' ? undefined : { index: false, follow: false },
  };
}

export default async function Publico({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  if (!data) notFound();

  const { champ, teams, games, goals, players, cards } = data;
  const { data: arena } = await supabase.from('arenas').select('*').eq('owner_id', data.row.owner_id).maybeSingle<ArenaRow>();
  const rules = sportRules(champ.sport);
  const tabs: Array<[string, string]> = [['jogos', 'Jogos'], ['tabela', champ.format === 'mata' ? 'Chave' : 'Tabela'], ...(rules.scorers ? [['artilharia', rules.unit === 'pontos' ? 'Cestinhas' : 'Artilharia'] as [string, string]] : []), ...(rules.cards ? [['cartoes', 'Cartões'] as [string, string]] : []), ...(champ.voting && champ.voting !== 'fechada' ? [['votacao', champ.voting === 'aberta' ? '🗳 Votação' : '🏅 Craques'] as [string, string]] : [])];
  const tab = tabs.some(t => t[0] === sp.aba) ? sp.aba! : 'jogos';
  const open = teams.filter(t => t.status !== 'inscrita').length;
  const started = games.some(isDecided);
  const url = `${siteUrl()}/c/${champ.slug}`;
  const today = new Date().toISOString().slice(0, 10);
  const champion = getChampion(champ, games, teams);
  const liveNow = ordered(games).filter(g => g.live && !isDecided(g));
  const upcoming = ordered(games).filter(g => !isDecided(g) && !g.live && g.homeId && g.awayId && g.date >= today).slice(0, 4);

  const signupOpen = open > 0 && !started;
  const jsonLd = data.row.visibility === 'publico' ? eventJsonLd({
    champ, games, url, imageUrl: `${url}/opengraph-image`, finished: !!champion,
    organizer: arena ? { name: arena.name, url: `${siteUrl()}/arena/${arena.slug}` } : null,
    offerCents: signupOpen ? currentPrice(champ.feeCents, champ.priceTiers ?? [], todayBr()).cents : null,
    signupUrl: `${url}/inscricao`,
  }) : null;
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />}
      <div className="hero">
        <div className="tag"><SportIcon sport={champ.sport} size={18} />{sportLabel(champ.sport)} · {FORMATS[champ.format]}</div>
        <h1>{champ.name}</h1>
        <div className="meta">
          <span>{teams.length} times</span>
          <span>{games.filter(isDecided).length} de {games.length} jogos</span>
          {champ.online ? <span className="badge online">🌐 Online</span> : placeLabel(champ) && <span>📍 {placeLabel(champ)}</span>}
        </div>
        {arena && (
          <Link href={`/arena/${arena.slug}`} className="organizer">
            {arena.logo_url ? <img src={arena.logo_url} alt="" className="org-logo" /> : <span className="org-logo">{initials(arena.name)}</span>}
            Organizado por <b>{arena.name}</b>
          </Link>
        )}
        <div className="actions">
          <Link href={`/c/${champ.slug}/imprimir`} className="btn ghost sm">🖨 Imprimir / PDF</Link>
          <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `🏆 ${champ.name}: jogos, tabela e artilharia\n${url}`)}>Compartilhar</a>
        </div>
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <div className="split">
        <aside className="side">
          {signupOpen && (
            <div className="cta">
              <div className="grow"><b>Inscrições abertas</b><span>{open} vaga{open > 1 ? 's' : ''} · {priceText(champ.feeCents, champ.priceTiers, brl).long} por time</span></div>
              <Link href={`/c/${champ.slug}/inscricao`} className="btn sm">Inscrever</Link>
            </div>
          )}
          {!champion && <ReminderButton championshipId={champ.id} teams={teams.filter(t => t.status === 'inscrita').map(t => ({ id: t.id, name: t.name }))} />}
          {upcoming.length > 0 && tab === 'jogos' && (
            <div>
              <h2 style={{ marginTop: 4 }}>Próximos jogos</h2>
              <div className="stack">{upcoming.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} />)}</div>
            </div>
          )}
        </aside>
        <div className="main-col">
          <Tabs items={tabs} current={tab} base={`/c/${champ.slug}`} />
          {liveNow.length > 0 && (
            <section className="live-now">
              <AutoRefresh seconds={15} />
              <h2 style={{ marginTop: 0 }}><span className="live-dot" /> Ao vivo agora</h2>
              <div className="games">{liveNow.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} />)}</div>
            </section>
          )}
          {tab === 'jogos' && <GamesList games={games} teams={teams} />}
          {tab === 'tabela' && <TableTab champ={champ} games={games} teams={teams} />}
          {tab === 'artilharia' && <Scorers champ={champ} games={games} goals={goals} players={players} teams={teams} />}
          {tab === 'votacao' && <VotingTab champ={champ} players={players} teams={teams} />}
          {tab === 'cartoes' && <Discipline champ={champ} games={games} cards={cards} players={players} teams={teams} />}
        </div>
      </div>
      <p className="sub small" style={{ textAlign: 'center', marginTop: 32 }}>Organiza campeonatos? <Link href="/">Crie o seu na Campia</Link>.</p>
    </>
  );
}
