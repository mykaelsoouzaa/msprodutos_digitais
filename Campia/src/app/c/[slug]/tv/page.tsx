import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AutoRefresh from '@/components/AutoRefresh';
import { Dot, GameRow, TableTab } from '@/components/champ';
import Sponsors from '@/components/Sponsors';
import TvRotator from '@/components/TvRotator';
import { loadChampionship } from '@/lib/data';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { isDecided, ordered, topScorers } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { ownerIsPro } from '@/lib/plan-server';
import { SPONSOR_SELECT, type Sponsor } from '@/lib/sponsors';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Modo TV', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Tela cheia para a TV da arena: ao vivo e próximos jogos, tabela, artilharia e últimos resultados. */
export default async function Tv({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  if (!data) notFound();
  const { champ, teams, games, goals, players } = data;
  const rules = sportRules(champ.sport);
  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const live = ordered(games).filter(g => g.live && !isDecided(g));
  const next = ordered(games).filter(g => !isDecided(g) && !g.live && g.homeId && g.awayId && g.date >= today).slice(0, 6);
  const recent = ordered(games).filter(isDecided).slice(-6).reverse();
  const scorers = rules.scorers ? topScorers(games, goals, players, teams).slice(0, 8) : [];
  const pro = await ownerIsPro(supabase, data.row.owner_id);
  const { data: sponsors } = pro
    ? await supabase.from('sponsors').select(SPONSOR_SELECT).eq('championship_id', champ.id).order('created_at').returns<Sponsor[]>()
    : { data: [] as Sponsor[] };

  const slides: Array<{ key: string; title: string; content: React.ReactNode }> = [];
  if (live.length || next.length) slides.push({ key: 'jogos', title: live.length ? 'Ao vivo' : 'Próximos jogos', content: (
    <div className="tv-cols">
      {live.length > 0 && <section><h2><span className="live-dot" /> Ao vivo agora</h2><div className="stack">{live.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} />)}</div></section>}
      {next.length > 0 && <section><h2>Próximos jogos</h2><div className="stack">{next.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} />)}</div></section>}
    </div>
  ) });
  slides.push({ key: 'tabela', title: champ.format === 'mata' ? 'Chave' : 'Tabela', content: <TableTab champ={champ} games={games} teams={teams} /> });
  if (scorers.length) slides.push({ key: 'artilharia', title: rules.unit === 'pontos' ? 'Cestinhas' : 'Artilharia', content: (
    <section><h2>{rules.unit === 'pontos' ? 'Cestinhas' : 'Artilharia'}</h2>
      <div className="tv-scorers">{scorers.map((s, i) => (
        <div key={s.player.id} className="tv-scorer"><span className="tv-pos">{i + 1}º</span><Dot team={s.team} /><span className="grow"><b>{s.player.name}</b><span>{s.team.name}</span></span><b className="tv-total">{s.total}</b></div>
      ))}</div>
    </section>
  ) });
  if (recent.length) slides.push({ key: 'resultados', title: 'Resultados', content: (
    <section><h2>Últimos resultados</h2><div className="tv-grid">{recent.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} />)}</div></section>
  ) });

  return (
    <div className="tv-mode">
      <AutoRefresh seconds={20} />
      <header className="tv-head">
        <div className="grow"><span className="tv-eyebrow">{sportLabel(champ.sport)}</span><h1>{champ.name}</h1></div>
        <div className="tv-url">Tabela no celular<b>{siteUrl().replace(/^https?:\/\//, '')}/c/{champ.slug}</b></div>
      </header>
      <TvRotator slides={slides} />
      {(sponsors ?? []).length > 0 && <Sponsors list={sponsors!} compact />}
    </div>
  );
}
