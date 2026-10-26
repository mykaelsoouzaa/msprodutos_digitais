import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/champ';
import { roleIn } from '@/lib/access';
import { loadChampionship } from '@/lib/data';
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

  return (
    <div className="narrow">
      <Link href={`/painel/${id}?aba=jogos`} className="back-link">‹ {data.champ.name}</Link>
      <h1>{home.name} × {away.name}</h1>
      <p className="sub">{g.stage === 'ko' ? g.name : `${g.group ? `Grupo ${g.group} · ` : ''}${g.label}`}</p>
      <Flash erro={sp.erro} />

      <form action={saveResult} className="card">
        <input type="hidden" name="championship" value={id} />
        <input type="hidden" name="game" value={g.id} />
        <div className="scorebox">
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

        {rules.scorers && [home, away].map(t => (
          <div key={t.id}>
            <label>{t.name} · {rules.unit === 'pontos' ? 'pontos' : 'gols'} por atleta</label>
            {roster(t.id).length ? roster(t.id).map(p => (
              <div className="prow" key={p.id}>
                <span>{p.number && <b style={{ color: 'var(--muted)' }}>{p.number} </b>}{p.name}</span>
                <input name={`goal_${p.id}`} type="number" min={0} className="inp" defaultValue={goalsOf(p.id)} aria-label={`${rules.unit} de ${p.name}`} />
              </div>
            )) : <p className="sub small">Sem atletas cadastrados.</p>}
          </div>
        ))}

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
