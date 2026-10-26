import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import type { ChampionshipRow } from '@/lib/data';
import { FORMATS, sportRules } from '@/lib/domain/sports';
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
      <h1>Seus campeonatos</h1>
      <p className="sub">{user?.email}</p>
      <Flash ok={sp.ok} erro={sp.erro} />
      {champs?.length ? (
        <div className="stack">
          {champs.map(c => (
            <Link key={c.id} href={`/painel/${c.id}`} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none' }}>
              <span style={{ fontSize: 26 }}>{sportRules(c.sport).icon}</span>
              <span className="grow"><b>{c.name}</b><span>{c.sport} · {FORMATS[c.format]}{c.city ? ` · ${c.city}` : ''}</span></span>
              <span style={{ color: 'var(--muted)' }}>›</span>
            </Link>
          ))}
        </div>
      ) : <div className="card empty">Você ainda não criou nenhum campeonato.</div>}
      <div className="actions"><Link href="/painel/novo" className="btn block">＋ Novo campeonato</Link></div>
      <form action={signOut} style={{ marginTop: 24 }}><button className="btn ghost sm">Sair</button></form>
    </>
  );
}
