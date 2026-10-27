// Aba de votação do craque na página pública.
import Link from 'next/link';
import { castVote } from '@/app/c/[slug]/voting-actions';
import type { Championship, Player, Team } from '@/lib/domain/types';
import { createClient } from '@/lib/supabase/server';
import { type VoteResult, categoriesFor, ranking } from '@/lib/voting';
import { Dot } from './champ';

const MEDALS = ['🥇', '🥈', '🥉'];

export default async function VotingTab({ champ, players, teams }: { champ: Championship; players: Player[]; teams: Team[] }) {
  const cats = categoriesFor(champ.sport);
  const supabase = await createClient();

  if (champ.voting === 'encerrada') {
    const { data } = await supabase.rpc('vote_results', { champ: champ.id });
    const results = (data ?? []) as VoteResult[];
    return (
      <div className="stack">
        {cats.map(([cat, label]) => {
          const top = ranking(results, players, teams, cat);
          return (
            <div className="card" key={cat}>
              <b className="vote-title">{label}</b>
              {top.length ? top.map((r, i) => (
                <div className={`row ${i === 0 ? 'vote-winner' : ''}`} key={r.player.id}>
                  <span className="vote-medal">{MEDALS[i]}</span>
                  <Dot team={r.team} />
                  <div className="grow"><b>{r.player.name}</b><span>{r.team?.name}</span></div>
                  <span className="badge open">{r.total} voto{r.total === 1 ? '' : 's'}</span>
                </div>
              )) : <p className="sub small" style={{ margin: '6px 0 0' }}>Sem votos.</p>}
            </div>
          );
        })}
        <a className="btn ghost block" href={`/c/${champ.slug}/craque`} target="_blank">Arte dos premiados para os stories</a>
      </div>
    );
  }

  // Votação aberta
  const { data: { user } } = await supabase.auth.getUser();
  const back = `/c/${champ.slug}?aba=votacao`;
  if (!user) {
    return (
      <div className="card vote-cta">
        <b>🗳 A votação do craque está aberta!</b>
        <p className="sub" style={{ margin: '4px 0 12px' }}>Para garantir um voto por pessoa, entre com o seu e-mail (você recebe um link de acesso, sem senha).</p>
        <Link href={`/entrar?voltar=${encodeURIComponent(back)}`} className="btn">Entrar para votar</Link>
      </div>
    );
  }
  const { data: mine } = await supabase.from('votes').select('category, player_id').eq('championship_id', champ.id).eq('voter_id', user.id)
    .returns<Array<{ category: string; player_id: string }>>();
  const byTeam = teams.filter(t => t.status === 'inscrita').map(t => ({ team: t, roster: players.filter(p => p.teamId === t.id) })).filter(x => x.roster.length);

  return (
    <form action={castVote} className="card">
      <input type="hidden" name="slug" value={champ.slug} />
      <b>🗳 Vote nos destaques do campeonato</b>
      <p className="sub" style={{ margin: '4px 0 0' }}>Um voto por categoria. Dá para mudar até a votação encerrar; o resultado aparece aqui quando o organizador encerrar.</p>
      {cats.map(([cat, label]) => (
        <div key={cat}>
          <label htmlFor={`vote_${cat}`}>{label}</label>
          <select id={`vote_${cat}`} name={`vote_${cat}`} className="inp" defaultValue={mine?.find(v => v.category === cat)?.player_id ?? ''}>
            <option value="">Escolha um atleta</option>
            {byTeam.map(({ team, roster }) => (
              <optgroup key={team.id} label={team.name}>
                {roster.map(p => <option key={p.id} value={p.id}>{p.number ? `${p.number} · ` : ''}{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      ))}
      <div style={{ marginTop: 16 }}><button className="btn block">{mine?.length ? 'Atualizar meu voto' : 'Votar'}</button></div>
    </form>
  );
}
