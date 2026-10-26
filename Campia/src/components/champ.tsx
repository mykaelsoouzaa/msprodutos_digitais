// Peças visuais compartilhadas entre o painel e a página pública (Server Components).
import Link from 'next/link';
import { sportRules } from '@/lib/domain/sports';
import { champion, isDecided, labels, ordered, sourceLabel, tables, topScorers, winnerId } from '@/lib/domain/standings';
import type { Championship, Game, Goal, Player, Team } from '@/lib/domain/types';
import { fmtDate } from '@/lib/format';

export function Dot({ team }: { team: Team | null | undefined }) {
  if (!team || team.status === 'aberta') return <span className="dot" style={{ background: '#2b3d33', color: '#8fa89a' }}>?</span>;
  return <span className="dot" style={{ background: team.color }}>{team.short.slice(0, 3)}</span>;
}

function side(g: Game, s: 'h' | 'a', teams: Team[], games: Game[]) {
  const id = s === 'h' ? g.homeId : g.awayId;
  const t = teams.find(x => x.id === id);
  if (t) return { team: t, name: t.name, tbd: false };
  return { team: null, name: sourceLabel(games, s === 'h' ? g.srcHome : g.srcAway, teams), tbd: true };
}

export function GameRow({ g, teams, games, href }: { g: Game; teams: Team[]; games: Game[]; href?: string }) {
  const h = side(g, 'h', teams, games), a = side(g, 'a', teams, games);
  const done = g.homeScore !== null && g.awayScore !== null;
  const meta = [g.date ? fmtDate(g.date) : '', g.time, g.field].filter(Boolean).join(' · ');
  const body = (
    <>
      <div className="gmeta">
        {g.group && <span className="tagx">Grupo {g.group}</span>}
        {g.stage === 'ko' && <span className="tagx">{g.name}</span>}
        <span>{meta}</span>
      </div>
      <div className="gline">
        <div className={`team ${h.tbd ? 'tbd' : ''}`}><Dot team={h.team} /><span className="nm">{h.name}</span></div>
        {done
          ? <div className="score">{g.homeScore} × {g.awayScore}{g.penHome !== null && g.homeScore === g.awayScore && <small>({g.penHome}×{g.penAway})</small>}</div>
          : <div className="score pend">vs</div>}
        <div className={`team r ${a.tbd ? 'tbd' : ''}`}><span className="nm">{a.name}</span><Dot team={a.team} /></div>
      </div>
    </>
  );
  return href ? <Link href={href} className="game">{body}</Link> : <div className="game">{body}</div>;
}

export function GamesList({ games, teams, hrefFor }: { games: Game[]; teams: Team[]; hrefFor?: (g: Game) => string | undefined }) {
  return (
    <>
      {labels(games).map(label => {
        const list = ordered(games).filter(g => g.label === label);
        return (
          <section key={label}>
            <div className="round-title"><span>{label}</span><span>{list[0]?.date ? fmtDate(list[0].date) : ''}</span></div>
            {list.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} href={hrefFor?.(g)} />)}
          </section>
        );
      })}
    </>
  );
}

export function Standings({ champ, games, teams }: { champ: Championship; games: Game[]; teams: Team[] }) {
  const rules = sportRules(champ.sport);
  const ts = tables(champ, games, teams);
  if (!ts.length) return null;
  return (
    <>
      {ts.map(tb => (
        <div className="card" key={tb.title ?? 'geral'} style={{ padding: '8px 10px' }}>
          {tb.title && <b style={{ fontSize: 13, display: 'block', padding: '4px 2px' }}>{tb.title}</b>}
          <table>
            <thead>
              <tr><th>#</th><th className="t">Time</th><th>P</th><th>J</th><th>V</th>{rules.draws && <th>E</th>}<th>D</th><th>{rules.diff}</th></tr>
            </thead>
            <tbody>
              {tb.rows.map((r, i) => (
                <tr key={r.team.id} className={i < tb.qualify ? 'lead' : ''}>
                  <td>{i + 1}</td>
                  <td className="t"><div><Dot team={r.team} />{r.team.name}</div></td>
                  <td><b>{r.P}</b></td><td>{r.J}</td><td>{r.V}</td>{rules.draws && <td>{r.E}</td>}<td>{r.D}</td><td>{r.GP - r.GC}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {champ.format === 'grupos' && <p className="sub small" style={{ marginTop: 8 }}>Os {champ.rules.qualify} primeiros de cada grupo vão para o mata-mata.</p>}
    </>
  );
}

export function Bracket({ games, teams }: { games: Game[]; teams: Team[] }) {
  const ko = ordered(games).filter(g => g.stage === 'ko');
  if (!ko.length) return null;
  const cols = [...new Set(ko.map(g => g.label))];
  return (
    <div className="bracket">
      {cols.map(label => (
        <div className="bcol" key={label}>
          <h4>{label}</h4>
          {ko.filter(g => g.label === label).map(g => {
            const w = isDecided(g) ? winnerId(g) : null;
            const line = (s: 'h' | 'a') => {
              const x = side(g, s, teams, games);
              const sc = s === 'h' ? g.homeScore : g.awayScore;
              const pen = s === 'h' ? g.penHome : g.penAway;
              const id = s === 'h' ? g.homeId : g.awayId;
              return (
                <div className={`bteam ${x.tbd ? 'tbd' : ''} ${w && w === id ? 'win' : ''}`}>
                  <Dot team={x.team} /><span className="nm">{x.name}</span>
                  <b>{sc ?? ''}{pen !== null && g.homeScore === g.awayScore ? ` (${pen})` : ''}</b>
                </div>
              );
            };
            return <div className="bmatch" key={g.id}>{line('h')}{line('a')}</div>;
          })}
        </div>
      ))}
    </div>
  );
}

export function TableTab({ champ, games, teams }: { champ: Championship; games: Game[]; teams: Team[] }) {
  const ch = champion(champ, games, teams);
  return (
    <>
      {ch && <div className="champion">🏆 Campeão<b>{ch.name}</b></div>}
      {champ.format !== 'mata' && <Standings champ={champ} games={games} teams={teams} />}
      {champ.format !== 'pontos' && <><h2>{champ.format === 'grupos' ? 'Mata-mata' : 'Chaveamento'}</h2><Bracket games={games} teams={teams} /></>}
    </>
  );
}

export function Scorers({ champ, games, goals, players, teams }: { champ: Championship; games: Game[]; goals: Goal[]; players: Player[]; teams: Team[] }) {
  const rows = topScorers(games, goals, players, teams).slice(0, 20);
  const unit = sportRules(champ.sport).unit === 'pontos' ? 'pts' : 'gols';
  if (!rows.length) return <div className="card empty">Nenhum {unit === 'pts' ? 'ponto' : 'gol'} lançado ainda.</div>;
  return (
    <div className="card">
      {rows.map((r, i) => (
        <div className="row" key={r.player.id}>
          <b style={{ width: 22 }}>{i + 1}</b>
          <div className="grow"><b>{r.player.name}</b><span>{r.team.name}</span></div>
          <b>{r.total} {unit}</b>
        </div>
      ))}
    </div>
  );
}

export function Tabs({ items, current, base }: { items: Array<[string, string]>; current: string; base: string }) {
  return (
    <nav className="tabs">
      {items.map(([k, l]) => <Link key={k} href={`${base}?aba=${k}`} className={`tab ${current === k ? 'on' : ''}`}>{l}</Link>)}
    </nav>
  );
}

export function Flash({ erro, ok }: { erro?: string; ok?: string }) {
  if (erro) return <div className="alert err">{erro}</div>;
  if (ok) return <div className="alert ok">{ok}</div>;
  return null;
}
