import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import type { ChampionshipRow } from '@/lib/data';
import SportIcon from '@/components/SportIcon';
import { FORMATS, sportLabel } from '@/lib/domain/sports';
import { isAdmin } from '@/lib/admin';
import { cityState } from '@/lib/format';
import { isProActive } from '@/lib/plan';
import { myPlan } from '@/lib/plan-server';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../entrar/actions';

export const metadata: Metadata = { title: 'Painel' };
export const dynamic = 'force-dynamic';

export default async function Painel({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: champs } = await supabase.from('championships').select('*').eq('owner_id', user!.id)
    .order('created_at', { ascending: false }).returns<ChampionshipRow[]>();
  const pro = isProActive(await myPlan(supabase, user!.id));
  const { data: arena } = await supabase.from('arenas').select('slug').eq('owner_id', user!.id).maybeSingle();
  // Campeonatos em que esta conta foi convidada como ajudante
  const { data: invites } = await supabase.from('championship_helpers').select('championship_id').eq('email', (user!.email ?? '').toLowerCase()).returns<Array<{ championship_id: string }>>();
  const { data: helping } = invites?.length
    ? await supabase.from('championships').select('*').in('id', invites.map(i => i.championship_id)).returns<ChampionshipRow[]>()
    : { data: [] as ChampionshipRow[] };
  const card = (c: ChampionshipRow, helper = false) => (
    <Link key={c.id} href={`/painel/${c.id}`} className="card link-card">
      <SportIcon sport={c.sport} />
      <span className="grow"><b>{c.name}</b><span>{sportLabel(c.sport)} · {FORMATS[c.format]}{c.online ? ' · Online' : cityState(c.city, c.state ?? '') ? ` · ${cityState(c.city, c.state ?? '')}` : ''}</span></span>
      {helper ? <span className="badge open">Ajudante</span> : <span style={{ color: 'var(--muted)' }}>›</span>}
    </Link>
  );

  return (
    <>
      <div className="page-head">
        <div><h1>Seus campeonatos {pro && <span className="badge pro" style={{ verticalAlign: 'middle', fontSize: 13 }}>Pro</span>}</h1><p className="sub" style={{ margin: 0 }}>{user?.email}</p></div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/painel/arena" className="btn ghost">{arena ? 'Página da arena' : 'Criar página da arena'}</Link>
          <Link href="/painel/recebimentos" className="btn ghost">Recebimentos</Link>
          <Link href="/painel/plano" className="btn ghost">{pro ? 'Meu plano' : '⭐ Seja Pro'}</Link>
          {isAdmin(user?.email) && <Link href="/admin" className="btn ghost">Admin</Link>}
          <Link href="/painel/novo" className="btn">＋ Novo campeonato</Link>
        </div>
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />
      {champs?.length ? (
        <div className="grid-cards">
          {champs.map(c => card(c))}
        </div>
      ) : <div className="card empty">Você ainda não criou nenhum campeonato.</div>}
      {!!helping?.length && (
        <>
          <h2>Você ajuda em</h2>
          <div className="grid-cards">{helping.map(c => card(c, true))}</div>
        </>
      )}
      <form action={signOut} style={{ marginTop: 24 }}><button className="btn ghost sm">Sair</button></form>
    </>
  );
}
