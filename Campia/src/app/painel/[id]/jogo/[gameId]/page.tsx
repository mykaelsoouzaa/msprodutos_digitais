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

export const metadata: Metadata = { title: 'Resultado' };
export const dynamic = 'force-dynamic';

export default async function Jogo({ params, searchParams }: {
  params: Promise<{ id: string; gameId: string }>;
  searchParams: Promise<{ erro?: string }>;
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

  return (
    <div className="narrow">
      <Link href={`/painel/${id}?aba=jogos`} className="back-link">‹ {data.champ.name}</Link>
      <h1>{home.name} × {away.name}</h1>
      <p className="sub">{g.stage === 'ko' ? g.name : `${g.group ? `Grupo ${g.group} · ` : ''}${g.label}`}</p>
      <Flash erro={sp.erro} />

      {suspendedHere.length > 0 && (
        <div className="alert err">🟥 Suspensos neste jogo: {suspendedHere.map(p => `${p.name} (${data.teams.find(t => t.id === p.teamId)?.short})`).join(', ')}</div>
      )}
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
          <div><input name="home" type="number" min={0} className="inp" defaultValue={g.homeScore ?? ''} aria-label={`Placar ${home.name}`} /><div className="nm">{home.name}</div></div>
          <b style={{ color: 'var(--muted)' }}>×</b>
          <div><input name="away" type="number" min={0} className="inp" defaultValue={g.awayScore ?? ''} aria-label={`Placar ${away.name}`} /><div className="nm">{away.name}</div></div>
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
