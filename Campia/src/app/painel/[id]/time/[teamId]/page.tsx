import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Dot, Flash } from '@/components/champ';
import { loadChampionship } from '@/lib/data';
import { sportRules } from '@/lib/domain/sports';
import { createClient } from '@/lib/supabase/server';
import { saveTeam } from '../../../edit-actions';

export const metadata: Metadata = { title: 'Editar time' };
export const dynamic = 'force-dynamic';

export default async function EditTeam({ params, searchParams }: {
  params: Promise<{ id: string; teamId: string }>;
  searchParams: Promise<{ erro?: string }>;
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
      <Flash erro={sp.erro} />

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
    </div>
  );
}
