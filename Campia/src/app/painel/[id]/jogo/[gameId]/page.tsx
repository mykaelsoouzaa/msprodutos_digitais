import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/champ';
import { roleIn } from '@/lib/access';
import { loadChampionship } from '@/lib/data';
import { discipline } from '@/lib/domain/discipline';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { createClient } from '@/lib/supabase/server';
import { clearResult, saveResult } from '../../../actions';
import { scoreLive, startLive, stopLive } from '../../../live-actions';
import { saveCheckin } from '../../../checkin-actions';

export const metadata: Metadata = { title: 'Resultado' };
export const dynamic = 'force-dynamic';

export default async function Jogo({ params, searchParams }: {
  params: Promise<{ id: string; gameId: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id, gameId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await loadChampionship(supabase, { id });
  const g = data?.games.find(x => x.id === gameId);
  if (!data || !g || !g.homeId || !g.awayId || !(await roleIn(supabase, data.row, user))) notFound();

  const rules = sportRules(data.champ.sport);
  const home = data.teams.find(t => t.id === g.homeId)!;
  const away = data.teams.find(t => t.id === g.awayId)!;
  const goalsOf = (pid: string) => data.goals.find(x => x.gameId === g.id && x.playerId === pid)?.count ?? '';
  const roster = (teamId: string) => data.players.filter(p => p.teamId === teamId);
  const cardOf = (pid: string) => data.cards.find(x => x.gameId === g.id && x.playerId === pid);
  const out = discipline(data.games, data.cards, data.players, data.teams, data.champ.rules.yellowLimit).suspended.get(g.id) ?? new Set<string>();
  const suspendedHere = data.players.filter(p => out.has(p.id));
  const { data: checkRows } = await supabase.from('checkins').select('player_id').eq('game_id', g.id).returns<Array<{ player_id: string }>>();
  const present = new Set((checkRows ?? []).map(r => r.player_id));
  const presentIn = (teamId: string) => roster(teamId).filter(p => present.has(p.id)).length;

  return (
    <div className="narrow">
      <Link href={`/painel/${id}?aba=jogos`} className="back-link">‹ {data.champ.name}</Link>
      <h1>{home.name} × {away.name}</h1>
      <p className="sub">{g.stage === 'ko' ? g.name : `${g.group ? `Grupo ${g.group} · ` : ''}${g.label}`}</p>
      <Flash erro={sp.erro} ok={sp.ok} />

      {suspendedHere.length > 0 && (
        <div className="alert err">🟥 Suspensos neste jogo: {suspendedHere.map(p => `${p.name} (${data.teams.find(t => t.id === p.teamId)?.short})`).join(', ')}</div>
      )}
      <section id="ao-vivo" className="card live-card">
        <div className="live-head">
          <b>{g.live ? <><span className="live-dot" /> Ao vivo</> : 'Placar ao vivo'}</b>
          {g.live?.since && <span className="sub small">começou às {new Date(g.live.since).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span>}
        </div>
        {g.live ? (
          <>
            <div className="live-board">
              {(['home', 'away'] as const).map(side => (
                <div className="live-side" key={side}>
                  <span className="live-name">{side === 'home' ? home.name : away.name}</span>
                  <span className="live-score">{g.live![side]}</span>
                  <div className="live-btns">
                    <form action={scoreLive}><input type="hidden" name="championship" value={id} /><input type="hidden" name="game" value={g.id} /><input type="hidden" name="side" value={side} /><input type="hidden" name="delta" value="-1" /><button className="btn ghost" aria-label={`Tirar 1 de ${side === 'home' ? home.name : away.name}`}>−1</button></form>
                    <form action={scoreLive}><input type="hidden" name="championship" value={id} /><input type="hidden" name="game" value={g.id} /><input type="hidden" name="side" value={side} /><input type="hidden" name="delta" value="1" /><button className="btn" aria-label={`Somar 1 para ${side === 'home' ? home.name : away.name}`}>+1</button></form>
                  </div>
                </div>
              ))}
            </div>
            <p className="sub small" style={{ margin: '10px 0 0' }}>A página do campeonato mostra esse placar em tempo real. Ao final, confira o placar abaixo e clique em <b>Salvar resultado</b>.</p>
            <form action={stopLive} className="actions"><input type="hidden" name="championship" value={id} /><input type="hidden" name="game" value={g.id} /><button className="btn ghost sm">Parar o ao vivo sem salvar</button></form>
          </>
        ) : g.homeScore === null && !g.wo ? (
          <>
            <p className="sub" style={{ margin: '4px 0 10px' }}>Vá atualizando o placar durante o jogo pelo celular: quem estiver na página do campeonato acompanha em tempo real.</p>
            <form action={startLive}><input type="hidden" name="championship" value={id} /><input type="hidden" name="game" value={g.id} /><button className="btn">▶ Começar ao vivo</button></form>
          </>
        ) : <p className="sub" style={{ margin: '4px 0 0' }}>Jogo com resultado lançado.</p>}
      </section>
      <details id="presenca" className="card checkin" open={present.size === 0 && g.homeScore === null && !g.wo}>
        <summary>
          <b>✅ Presença</b>
          <span className="sub small">{present.size ? `${home.short} ${presentIn(home.id)} · ${away.short} ${presentIn(away.id)} presentes` : 'marque quem chegou'}</span>
        </summary>
        <form action={saveCheckin}>
          <input type="hidden" name="championship" value={id} />
          <input type="hidden" name="game" value={g.id} />
          <p className="sub small" style={{ margin: '8px 0 4px' }}>Toque no nome de quem chegou. Ajuda a decidir W.O. e a conferir se só joga quem está inscrito.</p>
          <div className="checkin-grid">
            {[home, away].map(t => (
              <div key={t.id}>
                <div className="checkin-team">{t.name}</div>
                {roster(t.id).length ? roster(t.id).map(p => (
                  <label key={p.id} className={`checkin-p ${out.has(p.id) ? 'out' : ''}`}>
                    <input type="checkbox" name={`in_${p.id}`} value="1" defaultChecked={present.has(p.id)} />
                    <span>{p.number && <b>{p.number} </b>}{p.name}</span>
                    {out.has(p.id) && <span className="badge wait">suspenso</span>}
                  </label>
                )) : <p className="sub small">Sem atletas cadastrados.</p>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><button className="btn sm">Salvar presença</button></div>
        </form>
      </details>
      <form action={saveResult} className="card result-form">
        <input type="hidden" name="championship" value={id} />
        <input type="hidden" name="game" value={g.id} />
        <fieldset>
          <legend style={{ marginTop: 0 }}>Como terminou</legend>
          <div className="choice">
            <label><input type="radio" name="wo" value="" defaultChecked={!g.wo} /> Jogo normal</label>
            <label><input type="radio" name="wo" value="home" defaultChecked={g.wo === 'home'} /> W.O.: {home.short} faltou</label>
            <label><input type="radio" name="wo" value="away" defaultChecked={g.wo === 'away'} /> W.O.: {away.short} faltou</label>
            {g.stage !== 'ko' && <label><input type="radio" name="wo" value="both" defaultChecked={g.wo === 'both'} /> Os dois faltaram</label>}
          </div>
          <p className="sub small if-wo" style={{ margin: '8px 0 0' }}>Com W.O., o time presente vence por {rules.woScore[0]} × {rules.woScore[1]}. Se os dois faltarem, os dois levam derrota sem pontos.</p>
        </fieldset>
        <div className="if-played">
        <div className="scorebox" style={{ marginTop: 16 }}>
          <div><input name="home" type="number" min={0} className="inp" defaultValue={g.homeScore ?? g.live?.home ?? ''} aria-label={`Placar ${home.name}`} /><div className="nm">{home.name}</div></div>
          <b style={{ color: 'var(--muted)' }}>×</b>
          <div><input name="away" type="number" min={0} className="inp" defaultValue={g.awayScore ?? g.live?.away ?? ''} aria-label={`Placar ${away.name}`} /><div className="nm">{away.name}</div></div>
        </div>
        <p className="sub small" style={{ margin: '8px 0 0' }}>Placar em {rules.unit}.{rules.draws ? '' : ` ${sportLabel(data.champ.sport)} não tem empate.`}</p>

        {g.stage === 'ko' && (
          <>
            <label>{rules.tieLabel || 'Desempate'} (só se empatar)</label>
            <div className="grid2">
              <input name="penHome" type="number" min={0} className="inp" defaultValue={g.penHome ?? ''} placeholder={home.short} />
              <input name="penAway" type="number" min={0} className="inp" defaultValue={g.penAway ?? ''} placeholder={away.short} />
            </div>
          </>
        )}

        {(rules.scorers || rules.cards) && [home, away].map(t => (
          <div key={t.id}>
            <label>{t.name}</label>
            {roster(t.id).length ? (
              <>
                <div className={`prow head ${rules.cards ? 'with-cards' : ''}`}>
                  <span>Atleta</span>
                  {rules.scorers && <span>{rules.unit === 'pontos' ? 'Pontos' : 'Gols'}</span>}
                  {rules.cards && <><span title="Amarelos">🟨</span><span title="Vermelho">🟥</span></>}
                </div>
                {roster(t.id).map(p => (
                  <div className={`prow ${rules.cards ? 'with-cards' : ''}`} key={p.id}>
                    <span>{p.number && <b style={{ color: 'var(--muted)' }}>{p.number} </b>}{p.name}{out.has(p.id) && <span className="badge wait" style={{ marginLeft: 6 }}>suspenso</span>}</span>
                    {rules.scorers && <input name={`goal_${p.id}`} type="number" min={0} className="inp" defaultValue={goalsOf(p.id)} aria-label={`${rules.unit} de ${p.name}`} />}
                    {rules.cards && (
                      <>
                        <select name={`y_${p.id}`} className="inp" defaultValue={String(cardOf(p.id)?.yellow ?? 0)} aria-label={`Amarelos de ${p.name}`}>
                          <option value="0">0</option><option value="1">1</option><option value="2">2</option>
                        </select>
                        <input type="checkbox" name={`r_${p.id}`} className="red-check" defaultChecked={!!cardOf(p.id)?.red} aria-label={`Vermelho para ${p.name}`} />
                      </>
                    )}
                  </div>
                ))}
              </>
            ) : <p className="sub small">Sem atletas cadastrados.</p>}
          </div>
        ))}
        {rules.cards && <p className="sub small" style={{ margin: '8px 0 0' }}>Vermelho ou 2 amarelos no jogo: suspenso no próximo. {data.champ.rules.yellowLimit ?? 3} amarelos acumulados: suspenso no próximo.</p>}
        </div>

        <label>Data, horário e campo</label>
        <div className="grid3">
          <input name="date" type="date" className="inp" defaultValue={g.date} />
          <input name="time" type="time" className="inp" defaultValue={g.time} />
          <input name="field" className="inp" defaultValue={g.field} placeholder="Campo" />
        </div>

        <div className="grid2" style={{ marginTop: 18 }}>
          <button name="intent" value="schedule" className="btn ghost">Salvar só o horário</button>
          <button name="intent" value="result" className="btn">Salvar resultado</button>
        </div>
      </form>

      {g.homeScore !== null && (
        <form action={clearResult} style={{ marginTop: 12 }}>
          <input type="hidden" name="championship" value={id} />
          <input type="hidden" name="game" value={g.id} />
          <button className="btn danger sm">Apagar resultado</button>
        </form>
      )}
    </div>
  );
}
