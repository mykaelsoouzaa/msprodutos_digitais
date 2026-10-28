// Peças visuais compartilhadas entre o painel e a página pública (Server Components).
import { type Outcome, recentForm } from '@/lib/domain/stats';
import Link from 'next/link';
import { sportRules } from '@/lib/domain/sports';
import { champion, isDecided, labels, ordered, sourceLabel, tables, topScorers, winnerId } from '@/lib/domain/standings';
import { discipline } from '@/lib/domain/discipline';
import type { Card, Championship, Game, Goal, Player, Team } from '@/lib/domain/types';
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
  const done = !!g.wo || (g.homeScore !== null && g.awayScore !== null);
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
        {g.live && !done
          ? <div className="score live"><span className="live-tag"><span className="live-dot" />ao vivo</span>{g.live.home} × {g.live.away}</div>
          : done
          ? g.wo === 'both'
            ? <div className="score"><span className="wo-tag" style={{ fontSize: 13 }}>W.O. duplo</span></div>
            : <div className="score">{g.homeScore} × {g.awayScore}{g.wo ? <span className="wo-tag">W.O.</span> : g.penHome !== null && g.homeScore === g.awayScore && <small>({g.penHome}×{g.penAway})</small>}</div>
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
            <div className="games">{list.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} href={hrefFor?.(g)} />)}</div>
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
      <div className={`tables ${ts.length > 1 ? 'two' : ''}`}>
      {ts.map(tb => (
        <div className="card" key={tb.title ?? 'geral'} style={{ padding: '8px 10px' }}>
          {tb.title && <b style={{ fontSize: 13, display: 'block', padding: '4px 2px' }}>{tb.title}</b>}
          <div className="table-wrap"><table>
            <thead>
              <tr><th>#</th><th className="t">Time</th><th>P</th><th>J</th><th>V</th>{rules.draws && <th>E</th>}<th>D</th><th>{rules.diff}</th><th className="form-col">Últimos</th></tr>
            </thead>
            <tbody>
              {tb.rows.map((r, i) => (
                <tr key={r.team.id} className={i < tb.qualify ? 'lead' : ''}>
                  <td>{i + 1}</td>
                  <td className="t"><div><Dot team={r.team} />{r.team.name}</div></td>
                  <td><b>{r.P}</b></td><td>{r.J}</td><td>{r.V}</td>{rules.draws && <td>{r.E}</td>}<td>{r.D}</td><td>{r.GP - r.GC}</td><td className="form-col"><Form list={recentForm(games, r.team.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ))}
      </div>
      {champ.format === 'grupos' && <p className="sub small" style={{ marginTop: 8 }}>Os {champ.rules.qualify} primeiros de cada grupo vão para o mata-mata.</p>}
    </>
  );
}

const FORM_TITLE = { V: 'Vitória', E: 'Empate', D: 'Derrota' } as const;

/** Bolinhas dos últimos jogos: verde vitória, cinza empate, vermelho derrota. */
export function Form({ list }: { list: Outcome[] }) {
  if (!list.length) return <span className="sub small">–</span>;
  return <span className="form" aria-label={`Últimos jogos: ${list.map(o => FORM_TITLE[o]).join(', ')}`}>{list.map((o, i) => <i key={i} className={`f-${o}`} title={FORM_TITLE[o]}>{o}</i>)}</span>;
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
      {champ.rules.drawnAt && <p className="sub small" style={{ margin: '0 0 10px' }}>🎲 {champ.format === 'grupos' ? 'Grupos sorteados' : 'Confrontos sorteados'} em {new Date(champ.rules.drawnAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })}</p>}
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

/** Cartões e suspensões (esportes com cartão). */
export function Discipline({ champ, games, cards, players, teams }: { champ: Championship; games: Game[]; cards: Card[]; players: Player[]; teams: Team[] }) {
  const { rows } = discipline(games, cards, players, teams, champ.rules.yellowLimit);
  const out = rows.filter(r => r.suspendedIn);
  const fmt = (g: Game) => [g.stage === 'ko' ? g.name : g.label, g.date ? fmtDate(g.date) : ''].filter(Boolean).join(' · ');
  if (!rows.length) return <div className="card empty">Nenhum cartão até agora.</div>;
  return (
    <>
      {out.length > 0 && (
        <>
          <h2 style={{ marginTop: 0 }}>Suspensos no próximo jogo</h2>
          <div className="card">
            {out.map(r => (
              <div className="row" key={r.player.id}>
                <Dot team={r.team} />
                <div className="grow"><b>{r.player.name}</b><span>{r.team.name} · {fmt(r.suspendedIn!)}</span></div>
                <span className="badge wait">suspenso</span>
              </div>
            ))}
          </div>
        </>
      )}
      <h2>Cartões</h2>
      <div className="card" style={{ padding: '8px 10px' }}>
        <div className="table-wrap"><table>
          <thead><tr><th className="t">Atleta</th><th><span className="card-chip y" aria-label="Amarelos" /></th><th><span className="card-chip r" aria-label="Vermelhos" /></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.player.id}>
                <td className="t"><div><Dot team={r.team} />{r.player.name}</div></td>
                <td>{r.yellow}</td><td>{r.red}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      <p className="sub small" style={{ marginTop: 8 }}>Vermelho ou 2 amarelos no jogo: suspenso no próximo. {champ.rules.yellowLimit ?? 3} amarelos acumulados: suspenso no próximo.</p>
    </>
  );
}
