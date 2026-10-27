import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/champ';
import { isAdmin, splitGross } from '@/lib/admin';
import { brl } from '@/lib/format';
import { campiaFeePercent } from '@/lib/payout';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { togglePayoutDone } from './actions';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

interface Pay {
  id: string; amount_cents: number; status: string; payout: 'automatico' | 'manual'; paid_at: string | null; created_at: string;
  manual_payout_done_at: string | null; teams: { name: string } | null; championships: { id: string; name: string; owner_id: string } | null;
}
interface Champ { id: string; name: string; slug: string; owner_id: string; visibility: string; created_at: string; fee_cents: number }

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export default async function Admin({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) notFound();

  // Visão de toda a plataforma: só pelo servidor, com a service role.
  const db = createAdminClient();
  const [{ data: pays }, { data: champs }, { count: arenas }, { data: payouts }, users] = await Promise.all([
    db.from('payments').select('id, amount_cents, status, payout, paid_at, created_at, manual_payout_done_at, teams(name), championships(id, name, owner_id)')
      .in('status', ['pago', 'pago_tarde']).order('paid_at', { ascending: false }).limit(500).returns<Pay[]>(),
    db.from('championships').select('id, name, slug, owner_id, visibility, created_at, fee_cents').order('created_at', { ascending: false }).limit(200).returns<Champ[]>(),
    db.from('arenas').select('id', { count: 'exact', head: true }),
    db.from('payout_accounts').select('owner_id').returns<Array<{ owner_id: string }>>(),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailOf = new Map((users.data?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? ''] as [string, string]));
  const connected = new Set((payouts ?? []).map(p => p.owner_id));
  const fee = campiaFeePercent();

  const paid = (pays ?? []).filter(p => p.status === 'pago');
  const late = (pays ?? []).filter(p => p.status === 'pago_tarde');
  const gross = paid.reduce((s, p) => s + p.amount_cents, 0);
  const campiaCut = paid.reduce((s, p) => s + splitGross(p.amount_cents, fee).campia, 0);
  const pending = paid.filter(p => p.payout === 'manual' && !p.manual_payout_done_at);
  const doneManual = paid.filter(p => p.payout === 'manual' && p.manual_payout_done_at).slice(0, 20);
  const organizers = new Set((champs ?? []).map(c => c.owner_id));

  // Repasses pendentes agrupados por organizador.
  const byOwner = new Map<string, Pay[]>();
  pending.forEach(p => { const o = p.championships?.owner_id ?? '?'; byOwner.set(o, [...(byOwner.get(o) ?? []), p]); });

  return (
    <>
      <div className="page-head">
        <div><h1>Admin da Campia</h1><p className="sub" style={{ margin: 0 }}>Visão de toda a plataforma. Só os e-mails em ADMIN_EMAILS veem esta página.</p></div>
      </div>
      <Flash ok={sp.ok} />

      <div className="stats admin-stats">
        <div className="stat"><b className="money">{brl(gross)}</b><span>inscrições pagas ({paid.length})</span></div>
        <div className="stat"><b className="money">{brl(campiaCut)}</b><span>taxa da Campia ({fee}%, estimada)</span></div>
        <div className="stat"><b className="money" style={{ color: pending.length ? 'var(--warn)' : undefined }}>{brl(pending.reduce((s, p) => s + splitGross(p.amount_cents, fee).organizer, 0))}</b><span>a repassar ({pending.length})</span></div>
        <div className="stat"><b>{organizers.size}</b><span>organizadores · {arenas ?? 0} arenas</span></div>
        <div className="stat"><b>{champs?.length ?? 0}</b><span>campeonatos</span></div>
        <div className="stat"><b>{connected.size}</b><span>com repasse automático</span></div>
      </div>

      <h2>Repasses manuais pendentes</h2>
      {byOwner.size ? [...byOwner.entries()].map(([owner, list]) => (
        <div className="card" key={owner} style={{ marginBottom: 12 }}>
          <div className="row" style={{ paddingTop: 0 }}>
            <div className="grow">
              <b>{emailOf.get(owner) || 'Organizador'}</b>
              <span>{list.length} inscriç{list.length > 1 ? 'ões' : 'ão'} · repassar {brl(list.reduce((s, p) => s + splitGross(p.amount_cents, fee).organizer, 0))} (desconte a tarifa do Asaas)</span>
            </div>
            <span className={`badge ${connected.has(owner) ? 'ok' : 'open'}`}>{connected.has(owner) ? 'Repasse automático ligado' : 'Sem conta Asaas'}</span>
          </div>
          {list.map(p => (
            <form action={togglePayoutDone} className="row" key={p.id}>
              <input type="hidden" name="payment" value={p.id} /><input type="hidden" name="done" value="1" />
              <div className="grow"><b style={{ fontWeight: 600 }}>{p.teams?.name ?? 'Time'} · {brl(p.amount_cents)}</b><span>{p.championships?.name} · pago em {day(p.paid_at)}</span></div>
              <button className="btn ghost sm">Marcar repassado</button>
            </form>
          ))}
        </div>
      )) : <div className="card empty">Nenhum repasse manual pendente.</div>}

      {late.length > 0 && (
        <>
          <h2>Pagos depois de a vaga expirar (devolver)</h2>
          <div className="card">
            {late.map(p => (
              <div className="row" key={p.id}>
                <div className="grow"><b style={{ fontWeight: 600 }}>{p.teams?.name ?? 'Time'} · {brl(p.amount_cents)}</b><span>{p.championships?.name} · {emailOf.get(p.championships?.owner_id ?? '')} · {day(p.paid_at)}</span></div>
                <span className="badge wait">Devolver</span>
              </div>
            ))}
          </div>
          <p className="sub small" style={{ marginTop: 8 }}>O organizador pode devolver em Painel › campeonato › Times, ou você devolve pelo Asaas.</p>
        </>
      )}

      {doneManual.length > 0 && (
        <>
          <h2>Repasses manuais já feitos</h2>
          <div className="card">
            {doneManual.map(p => (
              <form action={togglePayoutDone} className="row" key={p.id}>
                <input type="hidden" name="payment" value={p.id} /><input type="hidden" name="done" value="0" />
                <div className="grow"><b style={{ fontWeight: 600 }}>{p.teams?.name ?? 'Time'} · {brl(p.amount_cents)}</b><span>{p.championships?.name} · repassado em {day(p.manual_payout_done_at)}</span></div>
                <button className="btn ghost sm">Desfazer</button>
              </form>
            ))}
          </div>
        </>
      )}

      <h2>Campeonatos recentes</h2>
      <div className="card">
        {(champs ?? []).slice(0, 40).map(c => (
          <div className="row" key={c.id}>
            <div className="grow"><b style={{ fontWeight: 600 }}>{c.name}</b><span>{emailOf.get(c.owner_id) || '?'} · {brl(c.fee_cents)} · criado em {day(c.created_at)}</span></div>
            <span className={`badge ${c.visibility === 'publico' ? 'ok' : 'open'}`}>{c.visibility === 'publico' ? 'Público' : 'Só link'}</span>
            <Link href={`/c/${c.slug}`} className="btn ghost sm" target="_blank">Ver</Link>
          </div>
        ))}
      </div>
    </>
  );
}
