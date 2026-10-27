import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/champ';
import { isAdmin, splitGross } from '@/lib/admin';
import { brl } from '@/lib/format';
import { campiaFeePercent } from '@/lib/payout';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { grantCourtesy, togglePayoutDone } from './actions';
import { type PlanRow, isProActive, proPriceCents } from '@/lib/plan';
import { healthChecks } from '@/lib/health';
import { paymentProvider } from '@/lib/env';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

interface Pay {
  id: string; amount_cents: number; status: string; payout: 'automatico' | 'manual'; paid_at: string | null; created_at: string;
  manual_payout_done_at: string | null; fee_percent: number | null; teams: { name: string } | null; championships: { id: string; name: string; owner_id: string } | null;
}
interface Champ { id: string; name: string; slug: string; owner_id: string; visibility: string; created_at: string; fee_cents: number }

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export default async function Admin({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) notFound();
  // O /admin mexe com repasses: exige a verificação em duas etapas ativa e confirmada nesta sessão.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    return (
      <div className="card narrow" style={{ textAlign: 'center', marginTop: 20 }}>
        <div style={{ fontSize: 46 }}>🔐</div>
        <h1>Ative a verificação em duas etapas</h1>
        <p className="sub">O Admin mostra pagamentos e repasses de toda a plataforma. Para abrir, ative a verificação em duas etapas em Minha conta.</p>
        <Link href="/conta#seguranca" className="btn">Ir para Minha conta</Link>
      </div>
    );
  }

  // Visão de toda a plataforma: só pelo servidor, com a service role.
  const db = createAdminClient();
  const [{ data: pays }, { data: champs }, { count: arenas }, { data: payouts }, users, { data: plans }, { data: status }, { data: events }] = await Promise.all([
    db.from('payments').select('id, amount_cents, status, payout, paid_at, created_at, manual_payout_done_at, fee_percent, teams(name), championships(id, name, owner_id)')
      .in('status', ['pago', 'pago_tarde']).order('paid_at', { ascending: false }).limit(500).returns<Pay[]>(),
    db.from('championships').select('id, name, slug, owner_id, visibility, created_at, fee_cents').order('created_at', { ascending: false }).limit(200).returns<Champ[]>(),
    db.from('arenas').select('id', { count: 'exact', head: true }),
    db.from('payout_accounts').select('owner_id').returns<Array<{ owner_id: string }>>(),
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from('plans').select('owner_id, status, source, paid_until, asaas_subscription_id, invoice_url').order('updated_at', { ascending: false }).returns<PlanRow[]>(),
    db.from('system_status').select('key, at, info').returns<Array<{ key: string; at: string; info: string }>>(),
    db.from('system_events').select('kind, message, created_at').order('created_at', { ascending: false }).limit(50)
      .returns<Array<{ kind: string; message: string; created_at: string }>>(),
  ]);
  const statusAt = (key: string) => status?.find(x => x.key === key)?.at ?? null;
  const checks = healthChecks({ now: Date.now(), cronAt: statusAt('agendador'), webhookAt: statusAt('webhook'), events: events ?? [], env: process.env, provider: paymentProvider() });
  const problems = checks.filter(c => c.state !== 'ok').length;
  const emailOf = new Map((users.data?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? ''] as [string, string]));
  const connected = new Set((payouts ?? []).map(p => p.owner_id));
  const fee = campiaFeePercent();
  // Taxa gravada na inscrição (Pro paga menos); inscrições antigas usam a taxa padrão.
  const feeOf = (p: Pay) => (p.fee_percent ?? fee);
  const activePro = (plans ?? []).filter(p => isProActive(p));
  const mrr = activePro.filter(p => p.source === 'asaas' && p.status === 'ativo').length * proPriceCents();

  const paid = (pays ?? []).filter(p => p.status === 'pago');
  const late = (pays ?? []).filter(p => p.status === 'pago_tarde');
  const gross = paid.reduce((s, p) => s + p.amount_cents, 0);
  const campiaCut = paid.reduce((s, p) => s + splitGross(p.amount_cents, feeOf(p)).campia, 0);
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

      <h2 style={{ marginTop: 8 }}>Saúde {problems ? <span className="badge wait">{problems} ponto{problems > 1 ? 's' : ''} de atenção</span> : <span className="badge ok">tudo certo</span>}</h2>
      <div className="health-grid">
        {checks.map(c => (
          <div key={c.key} className={`card health ${c.state}`}>
            <b><span className="health-dot" />{c.label}</b>
            <span className="sub small">{c.detail}</span>
          </div>
        ))}
      </div>
      {(events ?? []).length > 0 && (
        <details className="card" style={{ marginTop: 10 }}>
          <summary><b>Últimas falhas registradas ({events!.length})</b></summary>
          {events!.map((e, i) => (
            <div className="row" key={i}>
              <div className="grow"><b style={{ fontWeight: 600 }}>{e.kind}</b><span>{e.message}</span></div>
              <span className="sub small">{new Date(e.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </details>
      )}
      <p className="sub small" style={{ marginTop: 8 }}>Quando algo falha, os e-mails de ADMIN_EMAILS recebem um alerta (no máximo um a cada 30 min por tipo).</p>

      <div className="stats admin-stats">
        <div className="stat"><b className="money">{brl(gross)}</b><span>inscrições pagas ({paid.length})</span></div>
        <div className="stat"><b className="money">{brl(campiaCut)}</b><span>taxa da Campia (estimada)</span></div>
        <div className="stat"><b className="money" style={{ color: pending.length ? 'var(--warn)' : undefined }}>{brl(pending.reduce((s, p) => s + splitGross(p.amount_cents, feeOf(p)).organizer, 0))}</b><span>a repassar ({pending.length})</span></div>
        <div className="stat"><b>{organizers.size}</b><span>organizadores · {arenas ?? 0} arenas</span></div>
        <div className="stat"><b>{champs?.length ?? 0}</b><span>campeonatos</span></div>
        <div className="stat"><b>{connected.size}</b><span>com repasse automático</span></div>
        <div className="stat"><b className="money">{brl(mrr)}</b><span>Pro por mês ({activePro.length} ativos)</span></div>
      </div>

      <h2>Plano Pro</h2>
      <div className="card" style={{ marginBottom: 12 }}>
        {(plans ?? []).length ? (plans ?? []).map(p => (
          <div className="row" key={p.owner_id}>
            <div className="grow"><b style={{ fontWeight: 600 }}>{emailOf.get(p.owner_id) || p.owner_id}</b><span>{p.source === 'cortesia' ? 'Cortesia' : 'Asaas'} · {p.paid_until ? `até ${day(p.paid_until)}` : 'sem pagamento'}</span></div>
            <span className={`badge ${isProActive(p) ? 'ok' : p.status === 'pendente' ? 'wait' : 'open'}`}>{isProActive(p) ? (p.status === 'cancelado' ? 'Ativo até vencer' : 'Ativo') : p.status === 'pendente' ? 'Aguardando 1º pagamento' : 'Inativo'}</span>
          </div>
        )) : <p className="sub" style={{ margin: 0 }}>Nenhum organizador no Pro ainda.</p>}
        <form action={grantCourtesy} className="grid3" style={{ marginTop: 12, alignItems: 'end' }}>
          <div><label htmlFor="gc-email">Dar Pro de cortesia (e-mail)</label><input id="gc-email" name="email" type="email" className="inp" required /></div>
          <div><label htmlFor="gc-months">Meses (0 tira)</label><input id="gc-months" name="months" type="number" min={0} max={24} defaultValue={3} className="inp" /></div>
          <div><button className="btn ghost">Salvar cortesia</button></div>
        </form>
      </div>

      <h2>Repasses manuais pendentes</h2>
      {byOwner.size ? [...byOwner.entries()].map(([owner, list]) => (
        <div className="card" key={owner} style={{ marginBottom: 12 }}>
          <div className="row" style={{ paddingTop: 0 }}>
            <div className="grow">
              <b>{emailOf.get(owner) || 'Organizador'}</b>
              <span>{list.length} inscriç{list.length > 1 ? 'ões' : 'ão'} · repassar {brl(list.reduce((s, p) => s + splitGross(p.amount_cents, feeOf(p)).organizer, 0))} (desconte a tarifa do Asaas)</span>
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
