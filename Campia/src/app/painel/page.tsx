import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import type { ChampionshipRow } from '@/lib/data';
import SportIcon from '@/components/SportIcon';
import { FORMATS, sportLabel } from '@/lib/domain/sports';
import { cityState } from '@/lib/format';
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
  const { data: arena } = await supabase.from('arenas').select('slug').eq('owner_id', user!.id).maybeSingle();

  return (
    <>
      <div className="page-head">
        <div><h1>Seus campeonatos</h1><p className="sub" style={{ margin: 0 }}>{user?.email}</p></div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/painel/arena" className="btn ghost">{arena ? 'Página da arena' : 'Criar página da arena'}</Link>
          <Link href="/painel/novo" className="btn">＋ Novo campeonato</Link>
        </div>
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />
      {champs?.length ? (
        <div className="grid-cards">
          {champs.map(c => (
            <Link key={c.id} href={`/painel/${c.id}`} className="card link-card">
              <SportIcon sport={c.sport} />
              <span className="grow"><b>{c.name}</b><span>{sportLabel(c.sport)} · {FORMATS[c.format]}{c.online ? ' · Online' : cityState(c.city, c.state ?? '') ? ` · ${cityState(c.city, c.state ?? '')}` : ''}</span></span>
              <span style={{ color: 'var(--muted)' }}>›</span>
            </Link>
          ))}
        </div>
      ) : <div className="card empty">Você ainda não criou nenhum campeonato.</div>}
      <form action={signOut} style={{ marginTop: 24 }}><button className="btn ghost sm">Sair</button></form>
    </>
  );
}
