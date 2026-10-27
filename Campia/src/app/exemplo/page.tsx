import type { Metadata } from 'next';
import Link from 'next/link';
import { Discipline, Dot, GameRow, GamesList, Scorers, TableTab, Tabs } from '@/components/champ';
import SportIcon from '@/components/SportIcon';
import Sponsors from '@/components/Sponsors';
import { demoChampionship } from '@/lib/demo-data';
import { FORMATS, sportLabel } from '@/lib/domain/sports';
import { isDecided, ordered } from '@/lib/domain/standings';
import { brl, placeLabel } from '@/lib/format';
import { todayBr } from '@/lib/pricing';
import { categoriesFor, ranking } from '@/lib/voting';

export const metadata: Metadata = {
  title: 'Exemplo de campeonato',
  description: 'Veja como fica um campeonato na Campia: jogos, tabela, placar ao vivo, artilharia, votação do craque e patrocinadores.',
  alternates: { canonical: '/exemplo' },
};
export const dynamic = 'force-dynamic';

const TABS: Array<[string, string]> = [['jogos', 'Jogos'], ['tabela', 'Tabela'], ['artilharia', 'Artilharia'], ['cartoes', 'Cartões'], ['votacao', '🗳 Votação'], ['times', 'Times']];

/** Campeonato fictício, igual ao que o público vê, para a arena conhecer a Campia sem criar nada. */
export default async function Exemplo({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const sp = await searchParams;
  const today = todayBr();
  const d = demoChampionship(today);
  const { champ, teams, players, games, goals, cards } = d;
  const tab = TABS.some(t => t[0] === sp.aba) ? sp.aba! : 'jogos';
  const live = ordered(games).filter(g => g.live && !isDecided(g));
  const upcoming = ordered(games).filter(g => !isDecided(g) && !g.live && g.homeId && g.awayId && g.date >= today).slice(0, 4);

  return (
    <>
      <div className="demo-banner">
        <div className="grow"><b>Isto é um exemplo.</b> <span>É assim que o seu campeonato aparece para atletas e torcida. Navegue pelas abas.</span></div>
        <Link href="/entrar?voltar=/painel/novo" className="btn sm">Criar o meu grátis</Link>
      </div>
      <div className="hero">
        <div className="tag"><SportIcon sport={champ.sport} size={18} />{sportLabel(champ.sport)} · {FORMATS[champ.format]}</div>
        <h1>{champ.name}</h1>
        <div className="meta">
          <span>{teams.length} times</span>
          <span>{games.filter(isDecided).length} de {games.length} jogos</span>
          <span>📍 {placeLabel(champ)}</span>
        </div>
      </div>
      <div className="split">
        <aside className="side">
          <div className="cta">
            <div className="grow"><b>Inscrições pelo link</b><span>{brl(champ.feeCents)} por time, pago no PIX. A vaga só confirma com o pagamento.</span></div>
            <Link href="/para-arenas" className="btn sm">Como funciona</Link>
          </div>
          {upcoming.length > 0 && tab === 'jogos' && (
            <div>
              <h2 style={{ marginTop: 4 }}>Próximos jogos</h2>
              <div className="stack">{upcoming.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} />)}</div>
            </div>
          )}
        </aside>
        <div className="main-col">
          <Tabs items={TABS} current={tab} base="/exemplo" />
          {live.length > 0 && (
            <section className="live-now">
              <h2 style={{ marginTop: 0 }}><span className="live-dot" /> Ao vivo agora</h2>
              <div className="games">{live.map(g => <GameRow key={g.id} g={g} teams={teams} games={games} />)}</div>
              <p className="sub small" style={{ margin: '8px 0 0' }}>O mesário atualiza pelo celular e a página muda sozinha para todo mundo.</p>
            </section>
          )}
          {tab === 'jogos' && <GamesList games={games} teams={teams} />}
          {tab === 'tabela' && <TableTab champ={champ} games={games} teams={teams} />}
          {tab === 'artilharia' && <Scorers champ={champ} games={games} goals={goals} players={players} teams={teams} />}
          {tab === 'cartoes' && <Discipline champ={champ} games={games} cards={cards} players={players} teams={teams} />}
          {tab === 'votacao' && (
            <div className="stack">
              <p className="sub" style={{ margin: 0 }}>Atletas e torcida votam pelo celular. Parcial de exemplo:</p>
              {categoriesFor(champ.sport).map(([cat, label]) => (
                <div className="card" key={cat}>
                  <b className="vote-title">{label}</b>
                  {ranking(d.votes, players, teams, cat).map((r, i) => (
                    <div className={`row ${i === 0 ? 'vote-winner' : ''}`} key={r.player.id}>
                      <span className="vote-medal">{['🥇', '🥈', '🥉'][i]}</span>
                      <Dot team={r.team} />
                      <div className="grow"><b>{r.player.name}</b><span>{r.team?.name}</span></div>
                      <span className="badge open">{r.total} votos</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {tab === 'times' && (
            <div className="grid-cards">
              {teams.map(t => (
                <section key={t.id} className="card roster-team">
                  <div className="roster-head"><span className="dot" style={{ background: t.color }}>{t.short}</span><b>{t.name}</b></div>
                  {players.filter(p => p.teamId === t.id).map(p => (
                    <div key={p.id} className="roster-row"><span className="num">{p.number}</span><span className="grow">{p.name}</span></div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
      <Sponsors list={d.sponsors} />
      <div className="final-cta" style={{ marginTop: 32 }}>
        <h2 className="section-title">Gostou? O seu fica pronto em 2 minutos.</h2>
        <div className="ctas" style={{ justifyContent: 'center' }}>
          <Link href="/entrar?voltar=/painel/novo" className="btn lg">Criar meu campeonato</Link>
          <Link href="/para-arenas" className="btn ghost lg">Ver planos</Link>
        </div>
      </div>
    </>
  );
}
