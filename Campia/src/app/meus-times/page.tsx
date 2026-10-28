import type { Metadata } from 'next';
import Link from 'next/link';
import SportIcon from '@/components/SportIcon';
import { GameRow } from '@/components/champ';
import { teamSummary } from '@/lib/captain';
import { type ChampData, loadChampionship } from '@/lib/data';
import { champion } from '@/lib/domain/standings';
import { FORMATS, sportLabel } from '@/lib/domain/sports';
import { placeLabel } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { Flash } from '@/components/champ';
import { decideClaim } from '../atleta/actions';
import CalendarButtons from '@/components/CalendarButtons';

export const metadata: Metadata = { title: 'Meus times' };
export const dynamic = 'force-dynamic';

const OUTCOME = { V: ['Vitória', 'ok'], E: ['Empate', 'open'], D: ['Derrota', 'wait'] } as const;

export default async function MeusTimes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = (user?.email ?? '').toLowerCase();

  // O e-mail vem da sessão validada pelo Supabase; a busca usa a service role porque os contatos são privados.
  const admin = createAdminClient();
  const { data: contacts } = email
    ? await admin.from('team_contacts').select('team_id, championship_id').eq('captain_email', email).returns<Array<{ team_id: string; championship_id: string }>>()
    : { data: [] as Array<{ team_id: string; championship_id: string }> };

  const champIds = [...new Set((contacts ?? []).map(c => c.championship_id))].slice(0, 20);
  const loaded = (await Promise.all(champIds.map(id => loadChampionship(admin, { id })))).filter((d): d is ChampData => !!d);
  const { data: pending } = contacts?.length
    ? await admin.from('payments').select('id, team_id').in('team_id', contacts.map(c => c.team_id)).eq('status', 'pendente').returns<Array<{ id: string; team_id: string }>>()
    : { data: [] as Array<{ id: string; team_id: string }> };

  // Pedidos "Sou eu" de atletas dos times deste capitão.
  type Req = { player_id: string; team_id: string; user_id: string; players: { name: string } | null };
  const { data: reqs } = contacts?.length
    ? await admin.from('player_claims').select('player_id, team_id, user_id, players(name)').in('team_id', contacts.map(c => c.team_id)).eq('status', 'pendente').returns<Req[]>()
    : { data: [] as Req[] };
  const { data: reqAthletes } = reqs?.length
    ? await admin.from('athletes').select('user_id, handle, name').in('user_id', reqs.map(r => r.user_id)).returns<Array<{ user_id: string; handle: string; name: string }>>()
    : { data: [] as Array<{ user_id: string; handle: string; name: string }> };

  const cards = (contacts ?? []).flatMap(c => {
    const d = loaded.find(x => x.champ.id === c.championship_id);
    const team = d?.teams.find(t => t.id === c.team_id);
    if (!d || !team) return [];
    return [{ d, team, s: teamSummary(d.champ, d.games, d.teams, team.id), ch: champion(d.champ, d.games, d.teams), pay: pending?.find(p => p.team_id === team.id) }];
  });
  // Primeiro os que têm jogo marcado; depois os demais.
  cards.sort((a, b) => (a.s.next[0] ? 0 : 1) - (b.s.next[0] ? 0 : 1) || (a.s.next[0]?.date ?? '').localeCompare(b.s.next[0]?.date ?? ''));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Meus times</h1>
          <p className="sub" style={{ margin: 0 }}>Times inscritos com o e-mail {email}.</p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/atleta" className="btn ghost">Meu perfil de atleta</Link>
          <Link href="/campeonatos" className="btn ghost">Procurar campeonatos</Link>
        </div>
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />
      {(reqs ?? []).length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <b>Atletas pedindo para ligar o perfil</b>
          <p className="sub" style={{ margin: '4px 0 10px' }}>Confirme só se for mesmo o atleta do seu time: os gols e títulos vão para o perfil dessa pessoa.</p>
          <div className="stack">
            {reqs!.map(r => {
              const a = reqAthletes?.find(x => x.user_id === r.user_id);
              const team = loaded.flatMap(d => d.teams).find(t => t.id === r.team_id);
              return (
                <form key={r.player_id} action={decideClaim} className="sponsor-admin">
                  <input type="hidden" name="player" value={r.player_id} />
                  <input type="hidden" name="back" value="/meus-times" />
                  <span className="grow"><b>{r.players?.name ?? 'Atleta'}</b> <span className="sub small">· {team?.name} · pedido por {a ? <Link href={`/atleta/${a.handle}`} target="_blank">{a.name}</Link> : 'um usuário'}</span></span>
                  <button name="decision" value="recusar" className="btn ghost sm">Recusar</button>
                  <button name="decision" value="aprovar" className="btn sm">Aprovar</button>
                </form>
              );
            })}
          </div>
        </div>
      )}

      {cards.length ? (
        <div className="grid-cards wide">
          {cards.map(({ d, team, s, ch, pay }) => (
            <article className="card my-team" key={team.id}>
              <header className="my-team-head">
                <span className="dot lg" style={{ background: team.color }}>{team.short}</span>
                <div className="grow">
                  <b>{team.name}</b>
                  <Link href={`/c/${d.champ.slug}`} className="my-team-champ"><SportIcon sport={d.champ.sport} size={14} plain />{d.champ.name}</Link>
                </div>
              </header>
              <div className="champ-card-meta">
                <span>{sportLabel(d.champ.sport)} · {FORMATS[d.champ.format]}</span>
                {placeLabel(d.champ) && <span>{d.champ.online ? '🌐' : '📍'} {placeLabel(d.champ)}</span>}
              </div>

              {team.status !== 'inscrita' ? (
                <div className="cta">
                  <div className="grow"><b>Inscrição aguardando pagamento</b><span>A vaga fica reservada por 30 minutos.</span></div>
                  {pay ? <Link href={`/pagamento/${pay.id}`} className="btn sm">Pagar PIX</Link> : <Link href={`/c/${d.champ.slug}/inscricao`} className="btn sm">Inscrever de novo</Link>}
                </div>
              ) : (
                <>
                  <div className="stats" style={{ margin: 0 }}>
                    <div className="stat"><b>{ch?.id === team.id ? '🏆' : s.position ? `${s.position}º` : s.eliminated ? '—' : '·'}</b><span>{ch?.id === team.id ? 'campeão' : s.position ? (s.tableTitle ?? 'na tabela') : s.eliminated ? 'eliminado' : 'mata-mata'}</span></div>
                    <div className="stat"><b>{s.played}</b><span>jogos</span></div>
                    <div className="stat"><b>{s.wins}</b><span>vitórias</span></div>
                  </div>
                  {s.last && s.lastOutcome && (
                    <div>
                      <div className="round-title" style={{ marginTop: 4 }}><span>Último jogo</span><span className={`badge ${OUTCOME[s.lastOutcome][1]}`}>{OUTCOME[s.lastOutcome][0]}</span></div>
                      <GameRow g={s.last} teams={d.teams} games={d.games} />
                    </div>
                  )}
                  <div>
                    <div className="round-title" style={{ marginTop: 4 }}><span>Próximos jogos</span></div>
                    {s.next.length ? <div className="stack">{s.next.map(g => <GameRow key={g.id} g={g} teams={d.teams} games={d.games} />)}</div>
                      : <p className="sub small" style={{ margin: 0 }}>{ch ? 'Campeonato encerrado.' : s.eliminated ? 'O time foi eliminado.' : 'Nenhum jogo marcado no momento.'}</p>}
                  </div>
                </>
              )}
              <div className="actions" style={{ marginTop: 0 }}>
                <Link href={`/c/${d.champ.slug}`} className="btn ghost sm">Ver tabela e jogos</Link>
                {team.status === 'inscrita' && <CalendarButtons slug={d.champ.slug} teamId={team.id} label="📅 Jogos na agenda" />}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty">
          <p style={{ margin: '0 0 6px', color: 'var(--text)' }}><b>Nenhum time encontrado com {email || 'este e-mail'}.</b></p>
          Os times aparecem aqui quando o capitão se inscreve com este e-mail. Inscrições feitas antes de 26/10/2026 não tinham e-mail; peça ao organizador para cadastrar o seu.
          <div className="actions" style={{ justifyContent: 'center' }}><Link href="/campeonatos" className="btn sm">Procurar campeonatos</Link></div>
        </div>
      )}
    </>
  );
}
