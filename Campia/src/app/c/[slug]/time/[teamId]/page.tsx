import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CalendarButtons from '@/components/CalendarButtons';
import { Form, GameRow } from '@/components/champ';
import { recentForm } from '@/lib/domain/stats';
import { loadChampionship } from '@/lib/data';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { champion, isDecided, ordered, tables } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { waLink } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  const supabase = await createClient();
  return loadChampionship(supabase, { slug });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; teamId: string }> }): Promise<Metadata> {
  const { slug, teamId } = await params;
  const d = await load(slug);
  const t = d?.teams.find(x => x.id === teamId);
  if (!d || !t) return { title: 'Time' };
  return { title: `${t.name} · ${d.champ.name}`, description: `Elenco, jogos e resultados do ${t.name} no ${d.champ.name}.` };
}

/** Página pública de um time: classificação, elenco com gols e cartões, jogos. */
export default async function TimePublico({ params }: { params: Promise<{ slug: string; teamId: string }> }) {
  const { slug, teamId } = await params;
  const d = await load(slug);
  const team = d?.teams.find(x => x.id === teamId && x.status === 'inscrita');
  if (!d || !team) notFound();
  const { champ, teams, games, goals, cards, players } = d;
  const rules = sportRules(champ.sport);
  const mine = ordered(games).filter(g => g.homeId === team.id || g.awayId === team.id);
  const done = mine.filter(isDecided);
  const next = mine.filter(g => !isDecided(g));
  const table = tables(champ, games, teams).find(t => t.rows.some(r => r.team.id === team.id));
  const row = table?.rows.find(r => r.team.id === team.id);
  const pos = table && row ? table.rows.indexOf(row) + 1 : null;
  const ch = champion(champ, games, teams);
  const roster = players.filter(p => p.teamId === team.id).map(p => ({
    p,
    goals: goals.filter(g => g.playerId === p.id).reduce((s, g) => s + g.count, 0),
    yellow: cards.filter(c => c.playerId === p.id).reduce((s, c) => s + c.yellow, 0),
    red: cards.filter(c => c.playerId === p.id && c.red).length,
  })).sort((a, b) => b.goals - a.goals || a.p.name.localeCompare(b.p.name));
  const url = `${siteUrl()}/c/${champ.slug}/time/${team.id}`;
  const gameHref = (g: (typeof games)[number]) => (g.homeId && g.awayId ? `/c/${champ.slug}/jogo/${g.id}` : undefined);

  return (
    <div className="narrow">
      <Link href={`/c/${champ.slug}`} className="back-link">‹ {champ.name}</Link>
      <section className="team-hero">
        <span className="dot xl" style={{ background: team.color }}>{team.short}</span>
        <div className="grow">
          <h1 style={{ margin: 0 }}>{team.name}</h1>
          <p className="sub" style={{ margin: '2px 0 0' }}>{sportLabel(champ.sport)} · {champ.name}</p>
        </div>
        {ch?.id === team.id && <span className="badge ok">🏆 Campeão</span>}
      </section>
      <div className="actions" style={{ marginTop: 0 }}>
        <CalendarButtons slug={champ.slug} teamId={team.id} label="📅 Jogos na agenda" />
        <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `⚽ ${team.name} no ${champ.name}: jogos, resultados e artilheiros\n${url}?origem=whatsapp`)}>Compartilhar</a>
      </div>

      <div className="stats team-stats">
        <div className="stat"><b>{pos ? `${pos}º` : '—'}</b><span>{table?.title ?? 'na tabela'}</span></div>
        <div className="stat"><b>{row?.P ?? '—'}</b><span>pontos</span></div>
        <div className="stat"><b>{done.length}</b><span>jogos</span></div>
        <div className="stat"><b>{row ? `${row.V}-${row.E}-${row.D}` : '—'}</b><span>V-E-D</span></div>
        <div className="stat"><b>{row ? `${row.GP}:${row.GC}` : '—'}</b><span>{rules.unit === 'gols' ? 'gols pró:contra' : `${rules.unit} pró:contra`}</span></div>
        <div className="stat"><b><Form list={recentForm(d.games, team.id)} /></b><span>últimos jogos</span></div>
      </div>

      <h2>Elenco</h2>
      <div className="card">
        {roster.length ? roster.map(({ p, goals: g, yellow, red }) => (
          <div key={p.id} className="roster-row">
            <span className="num">{p.number}</span>
            <span className="grow">{p.name}</span>
            {rules.scorers && g > 0 && <span className="badge ok">{g} {rules.unit === 'pontos' ? 'pts' : g === 1 ? 'gol' : 'gols'}</span>}
            {rules.cards && yellow > 0 && <span title="Amarelos">🟨{yellow}</span>}
            {rules.cards && red > 0 && <span title="Vermelhos">🟥{red}</span>}
          </div>
        )) : <p className="sub small" style={{ margin: 0 }}>Elenco não informado.</p>}
      </div>

      {next.length > 0 && (<><h2>Próximos jogos</h2><div className="stack">{next.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} href={gameHref(g)} />)}</div></>)}
      {done.length > 0 && (<><h2>Resultados</h2><div className="stack">{[...done].reverse().map(g => <GameRow key={g.id} g={g} teams={teams} games={games} href={gameHref(g)} />)}</div></>)}
    </div>
  );
}
