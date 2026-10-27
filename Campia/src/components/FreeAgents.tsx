import Link from 'next/link';
import { joinFreeAgents, leaveFreeAgents } from '@/app/c/[slug]/free-agent-actions';
import { waLink } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Public = { id: string; name: string; position: string; note: string; created_at: string };
type Private = Public & { phone: string; user_id: string };

/** "Procuram time": atletas sem time; capitães e organizador veem o WhatsApp. */
export default async function FreeAgents({ champ, finished, isOwner }: { champ: { id: string; slug: string; name: string }; finished: boolean; isOwner: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: list }, { data: visible }] = await Promise.all([
    supabase.rpc('free_agents_public', { champ: champ.id }),
    user ? supabase.from('free_agents').select('id, name, position, note, created_at, phone, user_id').eq('championship_id', champ.id).returns<Private[]>()
      : Promise.resolve({ data: [] as Private[] }),
  ]);
  const people = (list ?? []) as Public[];
  const withPhone = new Map((visible ?? []).map(v => [v.id, v]));
  const me = (visible ?? []).find(v => v.user_id === user?.id);
  const canCall = (visible ?? []).some(v => v.user_id !== user?.id) || isOwner;
  if (finished && !people.length) return null;

  return (
    <section id="avulsos" className="card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Procuram time {people.length > 0 && <span className="badge open">{people.length}</span>}</h2>
      <p className="sub" style={{ margin: '0 0 10px' }}>
        {canCall ? 'Você é capitão ou organizador: chame pelo WhatsApp quem servir para o seu time.' : 'Atletas sem time. Os capitães do campeonato veem o WhatsApp e chamam quem precisarem.'}
      </p>
      {people.length > 0 && (
        <div className="stack" style={{ marginBottom: 12 }}>
          {people.map(p => {
            const full = withPhone.get(p.id);
            const mine = full?.user_id === user?.id;
            return (
              <div key={p.id} className="sponsor-admin">
                <span className="athlete-avatar sm">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="grow wrap">
                  <b>{p.name}{p.position && <span className="sub small"> · {p.position}</span>}</b>
                  {p.note && <span className="sub small">{p.note}</span>}
                </span>
                {mine ? (
                  <form action={leaveFreeAgents}><input type="hidden" name="slug" value={champ.slug} /><input type="hidden" name="id" value={p.id} /><button className="btn ghost sm">Sair</button></form>
                ) : full ? (
                  <a className="btn wa sm" target="_blank" rel="noopener" href={waLink(full.phone, `Olá, ${p.name}! Vi na Campia que você procura time no ${champ.name}. Quer jogar com a gente?`)}>Chamar</a>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {!finished && !me && !isOwner && (user ? (
        <details className="join-free">
          <summary className="btn ghost sm">Estou sem time</summary>
          <form action={joinFreeAgents} style={{ marginTop: 10 }}>
            <input type="hidden" name="slug" value={champ.slug} />
            <div className="grid2">
              <div><label htmlFor="fa-name">Seu nome</label><input id="fa-name" name="name" className="inp" required minLength={2} maxLength={60} /></div>
              <div><label htmlFor="fa-pos">Posição (opcional)</label><input id="fa-pos" name="position" className="inp" maxLength={40} placeholder="Ex.: goleiro, ala" /></div>
            </div>
            <label htmlFor="fa-phone">WhatsApp com DDD</label>
            <input id="fa-phone" name="phone" className="inp" required inputMode="tel" placeholder="(19) 99999-9999" />
            <label htmlFor="fa-note">Recado (opcional)</label>
            <input id="fa-note" name="note" className="inp" maxLength={200} placeholder="Ex.: jogo de sábado de manhã, tenho 28 anos" />
            <p className="sub small" style={{ margin: '8px 0 0' }}>Seu WhatsApp aparece só para os capitães deste campeonato e para o organizador.</p>
            <div style={{ marginTop: 12 }}><button className="btn sm">Entrar na lista</button></div>
          </form>
        </details>
      ) : (
        <p className="sub small" style={{ margin: 0 }}>Está sem time? <Link href={`/entrar?voltar=${encodeURIComponent(`/c/${champ.slug}?aba=times`)}`}>Entre com seu e-mail</Link> e coloque seu nome na lista.</p>
      ))}
    </section>
  );
}
