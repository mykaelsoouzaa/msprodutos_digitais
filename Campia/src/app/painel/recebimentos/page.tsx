import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import { paymentProvider } from '@/lib/env';
import { brl } from '@/lib/format';
import { campiaFeePercent, organizerPercent } from '@/lib/payout';
import { createClient } from '@/lib/supabase/server';
import { removePayout, savePayout } from './actions';

export const metadata: Metadata = { title: 'Recebimentos' };
export const dynamic = 'force-dynamic';

interface PayRow {
  id: string; amount_cents: number; status: string; payout: 'automatico' | 'manual'; created_at: string; paid_at: string | null;
  teams: { name: string } | null; championships: { name: string } | null;
}

const STATUS: Record<string, [string, string]> = {
  pago: ['Pago', 'ok'], pendente: ['Aguardando', 'wait'], pago_tarde: ['Pago após vencer', 'wait'], expirado: ['Expirou', 'open'], cancelado: ['Cancelado', 'open'],
};

export default async function Recebimentos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: account } = await supabase.from('payout_accounts').select('asaas_wallet_id, updated_at').eq('owner_id', user!.id).maybeSingle();
  // RLS: o organizador só lê os pagamentos dos próprios campeonatos.
  const { data: pays } = await supabase.from('payments')
    .select('id, amount_cents, status, payout, created_at, paid_at, teams(name), championships(name)')
    .in('status', ['pago', 'pago_tarde', 'pendente']).order('created_at', { ascending: false }).limit(50).returns<PayRow[]>();

  const paid = (pays ?? []).filter(p => p.status === 'pago' || p.status === 'pago_tarde');
  const sum = (rows: PayRow[]) => rows.reduce((s, p) => s + p.amount_cents, 0);
  const auto = paid.filter(p => p.payout === 'automatico');
  const manual = paid.filter(p => p.payout === 'manual');
  const fee = campiaFeePercent();

  return (
    <div className="narrow">
      <Link href="/painel" className="back-link">‹ Seus campeonatos</Link>
      <h1>Recebimentos</h1>
      <p className="sub">Como o dinheiro das inscrições chega até você.</p>
      <Flash ok={sp.ok} erro={sp.erro} />

      <div className="stats">
        <div className="stat"><b className="money">{brl(sum(paid))}</b><span>recebido (últimos 50)</span></div>
        <div className="stat"><b className="money">{brl(sum(auto))}</b><span>repasse automático</span></div>
        <div className="stat"><b className="money" style={{ color: manual.length ? 'var(--warn)' : undefined }}>{brl(sum(manual))}</b><span>repasse manual</span></div>
      </div>

      <section className="card">
        <div className="row" style={{ paddingTop: 0 }}>
          <div className="grow">
            <b>Repasse automático pelo Asaas</b>
            <span>{account ? 'Ligado: cada PIX já cai dividido na sua conta.' : 'Desligado: a Campia recebe e repassa manualmente.'}</span>
          </div>
          <span className={`badge ${account ? 'ok' : 'open'}`}>{account ? 'Ligado' : 'Desligado'}</span>
        </div>
        <p className="sub" style={{ margin: '12px 0 0' }}>
          Com o repasse automático, cada inscrição paga é dividida na hora: <b style={{ color: 'var(--text)' }}>{organizerPercent()}%</b> do valor líquido
          (depois da tarifa do Asaas) vai direto para a sua conta Asaas{fee > 0 ? <> e {fee}% fica com a Campia</> : null}. Você saca quando quiser, pelo app do Asaas.
        </p>
        {paymentProvider() !== 'asaas' && <div className="note">O PIX está em modo de teste neste ambiente: a divisão só acontece quando o Asaas estiver ligado.</div>}

        {account ? (
          <div className="actions">
            <span className="copybox" style={{ flex: 1 }}>Wallet ID {account.asaas_wallet_id}</span>
            <form action={removePayout}><button className="btn ghost sm">Desligar</button></form>
          </div>
        ) : null}

        <details className="mini-edit" open={!account} style={{ marginTop: 14 }}>
          <summary style={{ fontSize: 14 }}>{account ? 'Trocar a conta Asaas' : 'Conectar minha conta Asaas'}</summary>
          <ol className="howto">
            <li>Crie sua conta grátis em <a href="https://www.asaas.com" target="_blank" rel="noopener">asaas.com</a> (com CPF ou CNPJ) e aguarde a aprovação.</li>
            <li>No Asaas, copie o seu <b>Wallet ID</b> (fica na área de <b>Integrações</b>).</li>
            <li>Cole abaixo e clique em <b>Conectar</b>. O Wallet ID só serve para receber: com ele ninguém movimenta a sua conta.</li>
          </ol>
          <form action={savePayout}>
            <label htmlFor="walletId">Wallet ID do Asaas</label>
            <input id="walletId" name="walletId" className="inp" required autoComplete="off" spellCheck={false} placeholder="0000aaaa-00aa-00aa-00aa-000000aaaaaa" />
            <div className="actions"><button className="btn">Conectar</button></div>
          </form>
        </details>
      </section>

      <h2>Últimas inscrições pagas e pendentes</h2>
      {pays?.length ? (
        <div className="card">
          {pays.map(p => (
            <div className="row" key={p.id}>
              <div className="grow">
                <b>{p.teams?.name ?? 'Time'} · {brl(p.amount_cents)}</b>
                <span>{p.championships?.name} · {new Date(p.paid_at ?? p.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <span className={`badge ${STATUS[p.status]?.[1] ?? 'open'}`}>{STATUS[p.status]?.[0] ?? p.status}</span>
              {(p.status === 'pago' || p.status === 'pago_tarde') && <span className={`badge ${p.payout === 'automatico' ? 'ok' : 'wait'}`}>{p.payout === 'automatico' ? 'Automático' : 'Manual'}</span>}
            </div>
          ))}
        </div>
      ) : <div className="card empty">Nenhuma inscrição paga ainda.</div>}
      <p className="sub small" style={{ marginTop: 8 }}>Inscrições com repasse manual são transferidas pela Campia para a sua conta. Inscrições pagas por fora (confirmadas à mão) não aparecem aqui.</p>
    </div>
  );
}
