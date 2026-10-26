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

export const metadata: Metadata = { title: 'Meus times' };
export const dynamic = 'force-dynamic';

const OUTCOME = { V: ['Vitória', 'ok'], E: ['Empate', 'open'], D: ['Derrota', 'wait'] } as const;

export default async function MeusTimes() {
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
        <Link href="/campeonatos" className="btn ghost">Procurar campeonatos</Link>
      </div>

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
              <Link href={`/c/${d.champ.slug}`} className="btn ghost sm block">Ver tabela e jogos</Link>
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
