import Link from 'next/link';
import { claimPlayer } from '@/app/atleta/actions';
import type { Championship, Player, Team } from '@/lib/domain/types';
import { createClient } from '@/lib/supabase/server';
import CalendarButtons from './CalendarButtons';

/** Elenco dos times inscritos. Quem jogou toca em "Sou eu" para levar os números para o perfil de atleta. */
export default async function TeamsTab({ champ, teams, players }: { champ: Championship; teams: Team[]; players: Player[] }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: claims } = await supabase.from('player_claims').select('player_id, user_id, status').eq('championship_id', champ.id)
    .returns<Array<{ player_id: string; user_id: string; status: string }>>();
  const approved = (claims ?? []).filter(c => c.status === 'aprovado');
  const { data: athletes } = approved.length
    ? await supabase.from('athletes').select('user_id, handle').in('user_id', approved.map(c => c.user_id)).returns<Array<{ user_id: string; handle: string }>>()
    : { data: [] as Array<{ user_id: string; handle: string }> };
  const handleOf = new Map(approved.map(c => [c.player_id, athletes?.find(a => a.user_id === c.user_id)?.handle]));
  const claimed = new Set((claims ?? []).map(c => c.player_id));
  const mine = (claims ?? []).find(c => c.user_id === user?.id);
  const signed = teams.filter(t => t.status === 'inscrita');

  if (!signed.length) return <div className="card empty">Nenhum time inscrito ainda.</div>;
  return (
    <>
      {!user && (
        <div className="note" style={{ marginBottom: 14 }}>
          Jogou neste campeonato? <Link href={`/entrar?voltar=${encodeURIComponent(`/c/${champ.slug}?aba=times`)}`}>Entre com seu e-mail</Link> e toque em <b>Sou eu</b> para levar seus gols e títulos para o seu perfil de atleta.
        </div>
      )}
      {user && !mine && <p className="sub">Toque em <b>Sou eu</b> ao lado do seu nome para levar seus números para o <Link href="/atleta">seu perfil de atleta</Link>.</p>}
      <div className="grid-cards">
        {signed.map(t => {
          const roster = players.filter(p => p.teamId === t.id);
          return (
            <section key={t.id} className="card roster-team">
              <div className="roster-head"><span className="dot" style={{ background: t.color }}>{t.short}</span><b>{t.name}</b><span className="sub small" style={{ marginLeft: 'auto' }}>{roster.length} atleta{roster.length === 1 ? '' : 's'}</span><CalendarButtons slug={champ.slug} teamId={t.id} label="📅" /></div>
              {roster.length ? roster.map(p => {
                const handle = handleOf.get(p.id);
                return (
                  <div key={p.id} className="roster-row">
                    <span className="num">{p.number}</span>
                    <span className="grow">{p.name}</span>
                    {handle ? <Link href={`/atleta/${handle}`}>perfil ›</Link>
                      : mine?.player_id === p.id ? <span className="badge wait">aguardando o capitão</span>
                      : user && !mine && !claimed.has(p.id) ? (
                        <form action={claimPlayer}>
                          <input type="hidden" name="slug" value={champ.slug} />
                          <input type="hidden" name="player" value={p.id} />
                          <button className="btn ghost sm claim-btn">Sou eu</button>
                        </form>
                      ) : null}
                  </div>
                );
              }) : <p className="sub small">Elenco não informado.</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
