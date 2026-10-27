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
import { cookies } from 'next/headers';
import { onboardingSteps, progress } from '@/lib/onboarding';
import { hideOnboarding } from './onboarding-actions';
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
  // Primeiros passos: some quando tudo estiver feito ou se o organizador esconder.
  const hidden = (await cookies()).get('campia-passos')?.value === 'ocultar';
  const ids = (champs ?? []).map(c => c.id);
  const [{ data: payout }, { count: signedTeams }, { count: results }] = hidden ? [{ data: null }, { count: 1 }, { count: 1 }] : await Promise.all([
    supabase.from('payout_accounts').select('owner_id').eq('owner_id', user!.id).maybeSingle(),
    ids.length ? supabase.from('teams').select('id', { count: 'exact', head: true }).in('championship_id', ids).eq('status', 'inscrita') : Promise.resolve({ count: 0 }),
    ids.length ? supabase.from('games').select('id', { count: 'exact', head: true }).in('championship_id', ids).not('home_score', 'is', null) : Promise.resolve({ count: 0 }),
  ]);
  const steps = onboardingSteps({
    hasArena: !!arena, hasPayout: !!payout, championships: ids.length, signedTeams: signedTeams ?? 0, results: results ?? 0,
    firstChampionshipId: champs?.[champs.length - 1]?.id,
  });
  const prog = progress(steps);
  const showSteps = !hidden && !prog.complete;

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
      {showSteps && (
        <section className="card onboarding">
          <div className="onb-head">
            <div className="grow"><b>Primeiros passos</b><span className="sub small">{prog.done} de {prog.total} feitos</span></div>
            <form action={hideOnboarding}><button className="btn ghost sm" aria-label="Esconder primeiros passos">Esconder</button></form>
          </div>
          <div className="onb-bar"><i style={{ width: `${(prog.done / prog.total) * 100}%` }} /></div>
          <ol className="onb-list">
            {steps.map(st => (
              <li key={st.key} className={st.done ? 'done' : st.key === prog.next?.key ? 'next' : ''}>
                <span className="onb-check">{st.done ? '✓' : ''}</span>
                <div className="grow"><b>{st.title}</b>{st.key === prog.next?.key && <span className="sub small">{st.text}</span>}</div>
                {!st.done && <Link href={st.href} className={`btn sm ${st.key === prog.next?.key ? '' : 'ghost'}`}>{st.cta}</Link>}
              </li>
            ))}
          </ol>
        </section>
      )}
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
