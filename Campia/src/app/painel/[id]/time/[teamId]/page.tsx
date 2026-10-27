import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Dot, Flash } from '@/components/champ';
import { loadChampionship, type PaymentRow } from '@/lib/data';
import { isDecided } from '@/lib/domain/standings';
import { brl } from '@/lib/format';
import { sportRules } from '@/lib/domain/sports';
import { createClient } from '@/lib/supabase/server';
import { cancelRegistration } from '../../../cancel-actions';
import { saveTeam } from '../../../edit-actions';
import { decideClaim } from '@/app/atleta/actions';

export const metadata: Metadata = { title: 'Editar time' };
export const dynamic = 'force-dynamic';

export default async function EditTeam({ params, searchParams }: {
  params: Promise<{ id: string; teamId: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id, teamId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await loadChampionship(supabase, { id }, { withContacts: true });
  const team = data?.teams.find(t => t.id === teamId);
  if (!data || data.row.owner_id !== user?.id || !team) notFound();

  const rules = sportRules(data.champ.sport);
  const roster = data.players.filter(p => p.teamId === team.id);
  const open = team.status === 'aberta';
  const { data: pay } = open ? { data: null } : await supabase.from('payments').select('*').eq('team_id', team.id).eq('status', 'pago')
    .order('paid_at', { ascending: false }).limit(1).maybeSingle<PaymentRow>();
  const played = data.games.some(g => isDecided(g) && (g.homeId === team.id || g.awayId === team.id));
  const { data: claims } = await supabase.from('player_claims').select('player_id, user_id, status').eq('team_id', team.id)
    .returns<Array<{ player_id: string; user_id: string; status: string }>>();
  const { data: claimers } = claims?.length
    ? await supabase.from('athletes').select('user_id, handle, name').in('user_id', claims.map(c => c.user_id)).returns<Array<{ user_id: string; handle: string; name: string }>>()
    : { data: [] as Array<{ user_id: string; handle: string; name: string }> };
  const back = `/painel/${id}/time/${teamId}`;
  const scored = (pid: string) => data.goals.some(g => g.playerId === pid) || data.cards.some(c => c.playerId === pid);

  return (
    <div className="narrow">
      <Link href={`/painel/${id}?aba=times`} className="back-link">‹ {data.champ.name}</Link>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Dot team={open ? null : team} />
        <h1 style={{ margin: 0 }}>{open ? `Inscrever na ${team.name}` : `Editar ${team.name}`}</h1>
      </div>
      <p className="sub">{open
        ? 'Use para times que pagaram por fora (dinheiro, transferência) ou cortesias. A vaga fica confirmada como paga.'
        : 'Corrija o nome, os dados do capitão e a lista de atletas.'}</p>
      <Flash erro={sp.erro} ok={sp.ok} />

      <form action={saveTeam} className="card">
        <input type="hidden" name="championship" value={id} />
        <input type="hidden" name="team" value={team.id} />
        {open && <input type="hidden" name="manual" value="1" />}

        <label htmlFor="name" style={{ marginTop: 0 }}>Nome {rules.who === 'Dupla' ? 'da dupla' : 'do time'}</label>
        <input id="name" name="name" className="inp" required minLength={2} maxLength={40} defaultValue={open ? '' : team.name} />
        <div className="grid2">
          <div><label htmlFor="short">Sigla (3 letras)</label><input id="short" name="short" className="inp" maxLength={3} defaultValue={open ? '' : team.short} /></div>
          <div><label htmlFor="captain">Capitão</label><input id="captain" name="captain" className="inp" maxLength={60} defaultValue={team.captainName} /></div>
        </div>
        <div className="grid2">
          <div><label htmlFor="phone">WhatsApp do capitão</label><input id="phone" name="phone" className="inp" inputMode="tel" defaultValue={team.captainPhone} placeholder="(11) 99999-9999" /></div>
          <div><label htmlFor="email">E-mail do capitão</label><input id="email" name="email" type="email" className="inp" defaultValue={team.captainEmail} placeholder="capitao@exemplo.com" /></div>
        </div>

        {roster.length > 0 && (
          <>
            <label>{rules.who}</label>
            <div className="prow head roster-edit"><span>Nome</span><span>Nº</span><span>Remover</span></div>
            {roster.map(p => (
              <div className="prow roster-edit" key={p.id}>
                <input name={`pname_${p.id}`} className="inp" defaultValue={p.name} maxLength={60} aria-label="Nome do atleta" />
                <input name={`pnum_${p.id}`} className="inp" defaultValue={p.number} maxLength={3} aria-label="Número" />
                <input type="checkbox" name={`remove_${p.id}`} className="red-check" aria-label={`Remover ${p.name}`} title={scored(p.id) ? 'Remover também apaga os gols e cartões deste atleta' : 'Remover'} />
              </div>
            ))}
            {roster.some(p => scored(p.id)) && <p className="sub small" style={{ margin: '6px 0 0' }}>Remover um atleta também apaga os gols e cartões dele.</p>}
          </>
        )}

        <label htmlFor="novos">{roster.length ? 'Adicionar atletas' : rules.who} (um por linha, com o número se quiser)</label>
        <textarea id="novos" name="novos" className="inp" placeholder={'10 João\n7 Pedro'} />

        <div style={{ marginTop: 18 }}><button className="btn block">{open ? 'Inscrever time' : 'Salvar alterações'}</button></div>
      </form>

      {(claims ?? []).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <b>Perfis de atleta ligados</b>
          <p className="sub" style={{ margin: '4px 0 10px' }}>Atletas que tocaram em “Sou eu”. O capitão também pode aprovar pelo Meus times.</p>
          <div className="stack">
            {claims!.map(c => {
              const a = claimers?.find(x => x.user_id === c.user_id);
              const p = roster.find(x => x.id === c.player_id);
              return (
                <form key={c.player_id} action={decideClaim} className="sponsor-admin">
                  <input type="hidden" name="player" value={c.player_id} />
                  <input type="hidden" name="back" value={back} />
                  <span className="grow"><b>{p?.name}</b> <span className="sub small">· {a ? <Link href={`/atleta/${a.handle}`} target="_blank">{a.name}</Link> : 'usuário'}</span></span>
                  {c.status === 'pendente' ? (
                    <>
                      <button name="decision" value="recusar" className="btn ghost sm">Recusar</button>
                      <button name="decision" value="aprovar" className="btn sm">Aprovar</button>
                    </>
                  ) : <button name="decision" value="recusar" className="btn ghost sm">Desligar</button>}
                </form>
              );
            })}
          </div>
        </div>
      )}

      {!open && (
        <form action={cancelRegistration} className="card danger-zone" style={{ marginTop: 16 }}>
          <input type="hidden" name="championship" value={id} />
          <input type="hidden" name="team" value={team.id} />
          <b>Cancelar inscrição</b>
          {played ? (
            <p className="sub" style={{ margin: '4px 0 0' }}>{team.name} já tem jogos com resultado, então a vaga não pode ser liberada.</p>
          ) : (
            <>
              <p className="sub" style={{ margin: '4px 0 10px' }}>A vaga volta a ficar livre para o link de inscrição. Os atletas e o contato do capitão são apagados.</p>
              {pay ? (
                <label className="inline-check" style={{ marginBottom: 10 }}>
                  <input type="checkbox" name="refund" value="1" defaultChecked />
                  Devolver o PIX de {brl(pay.amount_cents)} pelo Asaas (precisa ter saldo na conta)
                </label>
              ) : <p className="sub small" style={{ margin: '0 0 10px' }}>Esta inscrição não foi paga pelo PIX da Campia; se houver devolução, faça por fora.</p>}
              <input name="confirm" className="inp" placeholder="Digite CANCELAR" aria-label="Digite CANCELAR para confirmar" />
              <div className="actions"><button className="btn danger sm">Cancelar inscrição</button></div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
