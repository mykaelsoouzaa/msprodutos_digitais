import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash, GameRow, GamesList, Scorers, TableTab, Tabs } from '@/components/champ';
import ReminderButton from '@/components/ReminderButton';
import { loadChampionship } from '@/lib/data';
import { FORMATS, sportRules } from '@/lib/domain/sports';
import { champion as getChampion, isDecided, ordered } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { brl, waLink } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('championships').select('name, sport, visibility').eq('slug', slug).maybeSingle();
  if (!data) return { title: 'Campeonato' };
  return {
    title: data.name,
    description: `${data.sport}: jogos, tabela e artilharia ao vivo.`,
    robots: data.visibility === 'publico' ? undefined : { index: false, follow: false },
  };
}

export default async function Publico({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ aba?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  if (!data) notFound();

  const { champ, teams, games, goals, players } = data;
  const rules = sportRules(champ.sport);
  const tabs: Array<[string, string]> = [['jogos', 'Jogos'], ['tabela', champ.format === 'mata' ? 'Chave' : 'Tabela'], ...(rules.scorers ? [['artilharia', rules.unit === 'pontos' ? 'Cestinhas' : 'Artilharia'] as [string, string]] : [])];
  const tab = tabs.some(t => t[0] === sp.aba) ? sp.aba! : 'jogos';
  const open = teams.filter(t => t.status !== 'inscrita').length;
  const started = games.some(isDecided);
  const url = `${siteUrl()}/c/${champ.slug}`;
  const today = new Date().toISOString().slice(0, 10);
  const champion = getChampion(champ, games, teams);
  const upcoming = ordered(games).filter(g => !isDecided(g) && g.homeId && g.awayId && g.date >= today).slice(0, 4);

  return (
    <>
      <div className="hero">
        <div className="tag">{rules.icon} {champ.sport} · {FORMATS[champ.format]}</div>
        <h1>{champ.name}</h1>
        <div className="meta">
          <span>👥 {teams.length} times</span>
          <span>📅 {games.filter(isDecided).length}/{games.length} jogos</span>
          {(champ.location || champ.city) && <span>📍 {[champ.location, champ.city].filter(Boolean).join(' · ')}</span>}
        </div>
        <div className="actions">
          <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `🏆 ${champ.name}: jogos, tabela e artilharia\n${url}`)}>Compartilhar</a>
        </div>
      </div>
      <Flash ok={sp.ok} />
      {open > 0 && !started && (
        <div className="cta">
          <div style={{ flex: 1 }}><b>Inscrições abertas</b><span>{open} vaga{open > 1 ? 's' : ''} · {brl(champ.feeCents)} por time</span></div>
          <Link href={`/c/${champ.slug}/inscricao`} className="btn sm">Inscrever</Link>
        </div>
      )}
      {!champion && <ReminderButton championshipId={champ.id} teams={teams.filter(t => t.status === 'inscrita').map(t => ({ id: t.id, name: t.name }))} />}
      <Tabs items={tabs} current={tab} base={`/c/${champ.slug}`} />
      {tab === 'jogos' && (
        <>
          {upcoming.length > 0 && <><h2>Próximos jogos</h2>{upcoming.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} />)}</>}
          <h2>Todos os jogos</h2>
          <GamesList games={games} teams={teams} />
        </>
      )}
      {tab === 'tabela' && <TableTab champ={champ} games={games} teams={teams} />}
      {tab === 'artilharia' && <Scorers champ={champ} games={games} goals={goals} players={players} teams={teams} />}
      <p className="sub small" style={{ textAlign: 'center', marginTop: 24 }}>Organiza campeonatos? <Link href="/">Crie o seu no Rodada</Link>.</p>
    </>
  );
}
