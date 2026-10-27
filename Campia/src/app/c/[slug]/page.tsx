import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Discipline, Flash, GameRow, GamesList, Scorers, TableTab, Tabs } from '@/components/champ';
import ReminderButton from '@/components/ReminderButton';
import { type ArenaRow, initials } from '@/lib/arena';
import { loadChampionship } from '@/lib/data';
import SportIcon from '@/components/SportIcon';
import { FORMATS, sportLabel, sportRules } from '@/lib/domain/sports';
import { champion as getChampion, isDecided, ordered } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { brl, placeLabel, waLink } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('championships').select('name, sport, visibility').eq('slug', slug).maybeSingle();
  if (!data) return { title: 'Campeonato' };
  return {
    title: data.name,
    description: `${sportLabel(data.sport)}: jogos, tabela e artilharia ao vivo.`,
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

  const { champ, teams, games, goals, players, cards } = data;
  const { data: arena } = await supabase.from('arenas').select('*').eq('owner_id', data.row.owner_id).maybeSingle<ArenaRow>();
  const rules = sportRules(champ.sport);
  const tabs: Array<[string, string]> = [['jogos', 'Jogos'], ['tabela', champ.format === 'mata' ? 'Chave' : 'Tabela'], ...(rules.scorers ? [['artilharia', rules.unit === 'pontos' ? 'Cestinhas' : 'Artilharia'] as [string, string]] : []), ...(rules.cards ? [['cartoes', 'Cartões'] as [string, string]] : [])];
  const tab = tabs.some(t => t[0] === sp.aba) ? sp.aba! : 'jogos';
  const open = teams.filter(t => t.status !== 'inscrita').length;
  const started = games.some(isDecided);
  const url = `${siteUrl()}/c/${champ.slug}`;
  const today = new Date().toISOString().slice(0, 10);
  const champion = getChampion(champ, games, teams);
  const upcoming = ordered(games).filter(g => !isDecided(g) && g.homeId && g.awayId && g.date >= today).slice(0, 4);

  const signupOpen = open > 0 && !started;
  return (
    <>
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
      <Flash ok={sp.ok} />
      <div className="split">
        <aside className="side">
          {signupOpen && (
            <div className="cta">
              <div className="grow"><b>Inscrições abertas</b><span>{open} vaga{open > 1 ? 's' : ''} · {brl(champ.feeCents)} por time</span></div>
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
          {tab === 'jogos' && <GamesList games={games} teams={teams} />}
          {tab === 'tabela' && <TableTab champ={champ} games={games} teams={teams} />}
          {tab === 'artilharia' && <Scorers champ={champ} games={games} goals={goals} players={players} teams={teams} />}
          {tab === 'cartoes' && <Discipline champ={champ} games={games} cards={cards} players={players} teams={teams} />}
        </div>
      </div>
      <p className="sub small" style={{ textAlign: 'center', marginTop: 32 }}>Organiza campeonatos? <Link href="/">Crie o seu na Campia</Link>.</p>
    </>
  );
}
