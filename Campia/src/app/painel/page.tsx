import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import type { ChampionshipRow } from '@/lib/data';
import SportIcon from '@/components/SportIcon';
import { FORMATS, sportLabel } from '@/lib/domain/sports';
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

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="grow"><h1>Seus campeonatos</h1><p className="sub" style={{ margin: 0 }}>{user?.email}</p></div>
        <Link href="/painel/novo" className="btn">＋ Novo campeonato</Link>
      </div>
      <div style={{ height: 16 }} />
      <Flash ok={sp.ok} erro={sp.erro} />
      {champs?.length ? (
        <div className="grid-cards">
          {champs.map(c => (
            <Link key={c.id} href={`/painel/${c.id}`} className="card link-card">
              <SportIcon sport={c.sport} />
              <span className="grow"><b>{c.name}</b><span>{sportLabel(c.sport)} · {FORMATS[c.format]}{c.city ? ` · ${c.city}` : ''}</span></span>
              <span style={{ color: 'var(--muted)' }}>›</span>
            </Link>
          ))}
        </div>
      ) : <div className="card empty">Você ainda não criou nenhum campeonato.</div>}
      <form action={signOut} style={{ marginTop: 24 }}><button className="btn ghost sm">Sair</button></form>
    </>
  );
}
