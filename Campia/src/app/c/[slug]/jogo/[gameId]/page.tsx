import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AutoRefresh from '@/components/AutoRefresh';
import { Dot } from '@/components/champ';
import { loadChampionship } from '@/lib/data';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { isDecided, sourceLabel } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { fmtDate, waLink } from '@/lib/format';
import { type GameInfo, videoLabel, youtubeId } from '@/lib/game-info';
import { createClient } from '@/lib/supabase/server';
import type { Team } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  return loadChampionship(await createClient(), { slug });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; gameId: string }> }): Promise<Metadata> {
  const { slug, gameId } = await params;
  const d = await load(slug);
  const g = d?.games.find(x => x.id === gameId);
  if (!d || !g) return { title: 'Jogo' };
  const n = (id: string | null) => d.teams.find(t => t.id === id)?.name ?? '?';
  const score = isDecided(g) && !g.wo ? ` ${g.homeScore} × ${g.awayScore} ` : ' × ';
  return { title: `${n(g.homeId)}${score}${n(g.awayId)} · ${d.champ.name}` };
}

/** Página de um jogo: placar, gols, cartões, árbitro e lances. */
export default async function JogoPublico({ params }: { params: Promise<{ slug: string; gameId: string }> }) {
  const { slug, gameId } = await params;
  const d = await load(slug);
  const g = d?.games.find(x => x.id === gameId);
  if (!d || !g) notFound();
  const { champ, teams, games, goals, cards, players } = d;
  const rules = sportRules(champ.sport);
  const info: GameInfo = champ.rules.gameInfo?.[g.id] ?? {};
  const side = (s: 'home' | 'away') => {
    const id = s === 'home' ? g.homeId : g.awayId;
    const team = teams.find(t => t.id === id) ?? null;
    return { team, name: team?.name ?? sourceLabel(games, s === 'home' ? g.srcHome : g.srcAway, teams) };
  };
  const home = side('home'), away = side('away');
  const done = isDecided(g);
  const scorersOf = (teamId: string | undefined) => {
    const by = new Map<string, number>();
    for (const x of goals) if (x.gameId === g.id && x.teamId === teamId) by.set(x.playerId, (by.get(x.playerId) ?? 0) + x.count);
    return [...by].map(([pid, count]) => ({ name: players.find(p => p.id === pid)?.name ?? '?', count })).sort((a, b) => b.count - a.count);
  };
  const cardsOf = (teamId: string | undefined) => cards.filter(x => x.gameId === g.id && x.teamId === teamId)
    .map(x => ({ name: players.find(p => p.id === x.playerId)?.name ?? '?', yellow: x.yellow, red: x.red }));
  const url = `${siteUrl()}/c/${champ.slug}/jogo/${g.id}`;
  const scoreText = done ? (g.wo === 'both' ? 'W.O. duplo' : `${g.homeScore} × ${g.awayScore}`) : g.live ? `${g.live.home} × ${g.live.away}` : '×';
  const meta = [g.date ? fmtDate(g.date) : '', g.time, g.field].filter(Boolean).join(' · ');

  return (
    <div className="narrow">
      {g.live && !done && <AutoRefresh seconds={15} />}
      <Link href={`/c/${champ.slug}`} className="back-link">‹ {champ.name}</Link>
      <section className="card match">
        <div className="match-meta">{g.stage === 'ko' ? g.name : [g.group ? `Grupo ${g.group}` : '', g.label].filter(Boolean).join(' · ')}{meta ? ` · ${meta}` : ''}</div>
        <div className="match-board">
          <TeamSide s={home} slug={champ.slug} />
          <div className={`match-score ${g.live && !done ? 'live' : ''}`}>
            {g.live && !done && <span className="live-tag"><span className="live-dot" /> ao vivo</span>}
            <b>{scoreText}</b>
            {done && g.penHome !== null && g.homeScore === g.awayScore && <span className="sub small">{rules.tieLabel || 'Desempate'} {g.penHome} × {g.penAway}</span>}
            {g.wo && g.wo !== 'both' && <span className="sub small">W.O.</span>}
          </div>
          <TeamSide s={away} slug={champ.slug} away />
        </div>
        {!done && !g.live && <p className="sub small" style={{ textAlign: 'center', margin: '8px 0 0' }}>{meta ? 'Jogo marcado' : 'Data a definir'}</p>}
        {info.referee && <p className="sub small" style={{ textAlign: 'center', margin: '8px 0 0' }}>Árbitro: <b>{info.referee}</b></p>}
      </section>

      {done && (rules.scorers || rules.cards) && (
        <div className="match-cols">
          {[home, away].map((s, i) => {
            const sc = scorersOf(s.team?.id), cd = cardsOf(s.team?.id);
            return (
              <div key={i} className="card">
                <b>{s.name}</b>
                {rules.scorers && (sc.length ? sc.map(x => <div key={x.name} className="match-line">⚽ {x.name}{x.count > 1 ? ` (${x.count})` : ''}</div>) : <div className="sub small">Sem {rules.unit === 'pontos' ? 'pontuadores' : 'gols'} lançados</div>)}
                {rules.cards && cd.map(x => <div key={x.name} className="match-line">{x.red ? '🟥' : ''}{x.yellow ? '🟨'.repeat(Math.min(2, x.yellow)) : ''} {x.name}</div>)}
              </div>
            );
          })}
        </div>
      )}

      {(info.videos ?? []).length > 0 && (
        <section style={{ marginTop: 16 }}>
          <h2>🎬 Lances</h2>
          <div className="stack">
            {info.videos!.map(v => {
              const yt = youtubeId(v);
              return yt
                ? <div key={v} className="video-wrap"><iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Lance do jogo" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen /></div>
                : <a key={v} href={v} target="_blank" rel="noopener" className="card link-card"><span style={{ fontSize: 20 }}>🎬</span><span className="grow"><b>Ver lance no {videoLabel(v)}</b><span>{v.replace(/^https:\/\//, '').slice(0, 50)}</span></span><span style={{ color: 'var(--muted)' }}>›</span></a>;
            })}
          </div>
        </section>
      )}

      <div className="actions" style={{ justifyContent: 'center', marginTop: 16 }}>
        <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `${done ? '🏁' : '⚽'} ${home.name} ${scoreText} ${away.name} · ${champ.name}\n${url}?origem=whatsapp`)}>Compartilhar</a>
        {done && <a className="btn ghost sm" href={`/c/${champ.slug}/jogo/${g.id}/arte`} target="_blank">🖼 Arte para stories</a>}
        <Link href={`/c/${champ.slug}`} className="btn ghost sm">Tabela e jogos</Link>
      </div>
      <p className="sub small" style={{ textAlign: 'center' }}>{sportLabel(champ.sport)} · {champ.name}</p>
    </div>
  );
}

function TeamSide({ s, slug, away }: { s: { team: Team | null; name: string }; slug: string; away?: boolean }) {
  return (
    <div className={`match-team ${away ? 'away' : ''}`}>
      {s.team
        ? <Link href={`/c/${slug}/time/${s.team.id}`} className="match-team-link"><Dot team={s.team} /><b>{s.name}</b></Link>
        : <span className="sub">{s.name}</span>}
    </div>
  );
}
