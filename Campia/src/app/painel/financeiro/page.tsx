import type { Metadata } from 'next';
import Link from 'next/link';
import { type FinTotals, financeSummary, monthLabel } from '@/lib/finance';
import { loadOwnerFinance } from '@/lib/finance-data';
import { brl } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Financeiro' };
export const dynamic = 'force-dynamic';

function Totals({ t }: { t: FinTotals }) {
  return (
    <div className="stats fin-stats">
      <div className="stat"><b>{brl(t.paid)}</b><span>inscrições pagas ({t.count})</span></div>
      <div className="stat"><b>{brl(t.campia)}</b><span>taxa da Campia</span></div>
      <div className="stat"><b style={{ color: 'var(--accent)' }}>{brl(t.yours)}</b><span>sua parte</span></div>
      <div className="stat"><b>{brl(t.auto + t.manualDone)}</b><span>já está na sua conta</span></div>
      <div className="stat"><b style={{ color: t.manualPending ? 'var(--warn)' : undefined }}>{brl(t.manualPending)}</b><span>a receber da Campia</span></div>
      <div className="stat"><b>{brl(t.refunded)}</b><span>devolvido ({t.refundedCount})</span></div>
    </div>
  );
}

export default async function Financeiro() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { champs, pays } = await loadOwnerFinance(supabase, user!.id);
  const { total, byChamp, months } = financeSummary(pays);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Financeiro</h1>
          <p className="sub" style={{ margin: 0 }}>Inscrições pagas pela Campia em todos os seus campeonatos.</p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/painel/recebimentos" className="btn ghost">Conta para receber</Link>
          {pays.length > 0 && <a href="/painel/financeiro/planilha" className="btn ghost" download>⬇ Planilha</a>}
        </div>
      </div>

      <Totals t={total} />
      <p className="sub small">Valores estimados. A tarifa do Asaas por pagamento (PIX ou cartão) sai antes da divisão e não entra nesta conta. Com a conta Asaas conectada, a sua parte cai direto nela; sem a conta, a Campia repassa para você.</p>
      {total.late > 0 && <div className="note" style={{ margin: '0 0 16px' }}>⚠️ {brl(total.late)} foram pagos depois de a vaga expirar. Devolva ou encaixe o time na aba Times do campeonato.</div>}

      {pays.length === 0 ? <div className="card empty">Nenhuma inscrição paga ainda. Quando os capitães pagarem, os valores aparecem aqui.</div> : (
        <>
          <h2>Por campeonato</h2>
          <div className="card">
            {champs.filter(c => byChamp.has(c.id)).map(c => {
              const t = byChamp.get(c.id)!;
              return (
                <Link key={c.id} href={`/painel/${c.id}?aba=times`} className="row fin-row">
                  <div className="grow"><b style={{ fontWeight: 600 }}>{c.name}</b><span>{t.count} inscriç{t.count === 1 ? 'ão' : 'ões'} · taxa {brl(t.campia)}{t.manualPending ? ` · a receber ${brl(t.manualPending)}` : ''}{t.refunded ? ` · devolvido ${brl(t.refunded)}` : ''}</span></div>
                  <div className="fin-val"><b className="money">{brl(t.yours)}</b><span>de {brl(t.paid)}</span></div>
                </Link>
              );
            })}
          </div>

          <h2>Por mês</h2>
          <div className="card">
            {months.map(([m, t]) => (
              <div key={m} className="row fin-row">
                <div className="grow"><b style={{ fontWeight: 600 }}>{monthLabel(m).replace(/^./, c => c.toUpperCase())}</b><span>{t.count} inscriç{t.count === 1 ? 'ão' : 'ões'} · taxa {brl(t.campia)}</span></div>
                <div className="fin-val"><b className="money">{brl(t.yours)}</b><span>de {brl(t.paid)}</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
