import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AutoRefresh from '@/components/AutoRefresh';
import CopyButton from '@/components/CopyButton';
import type { PaymentRow } from '@/lib/data';
import { paymentProvider } from '@/lib/env';
import { brl } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { simulatePayment } from './actions';

export const metadata: Metadata = { title: 'Pagamento', robots: { index: false } };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function Pagamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = createAdminClient();
  const { data: p } = await db.from('payments').select('*').eq('id', id).maybeSingle<PaymentRow>();
  if (!p) notFound();
  const [{ data: team }, { data: champ }] = await Promise.all([
    db.from('teams').select('name, status, reserved_until').eq('id', p.team_id).maybeSingle(),
    db.from('championships').select('name, slug').eq('id', p.championship_id).maybeSingle(),
  ]);
  if (!team || !champ) notFound();

  if (p.status === 'pago') {
    return (
      <div className="card narrow" style={{ textAlign: 'center', marginTop: 20 }}>
        <div style={{ fontSize: 54 }}>✅</div>
        <h1>{team.name} está inscrito!</h1>
        <p className="sub">Pagamento de {brl(p.amount_cents)} confirmado. Os jogos e a tabela ficam na página do campeonato.</p>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <Link href={`/c/${champ.slug}`} className="btn">Ver {champ.name}</Link>
          <Link href="/meus-times" className="btn ghost">Acompanhar em Meus times</Link>
        </div>
      </div>
    );
  }

  const expired = p.status !== 'pendente' || (team.reserved_until && new Date(team.reserved_until) < new Date() && team.status !== 'inscrita');
  if (expired) {
    return (
      <div className="card narrow" style={{ textAlign: 'center', marginTop: 20 }}>
        <h1>Reserva expirada</h1>
        <p className="sub">O pagamento não foi feito a tempo e a vaga foi liberada. Faça a inscrição de novo se ainda houver vagas.</p>
        <Link href={`/c/${champ.slug}/inscricao`} className="btn">Tentar de novo</Link>
      </div>
    );
  }

  if (p.method === 'cartao') {
    const parcels = p.installments && p.installments > 1 ? ` em ${p.installments}x de ${brl(Math.round(p.amount_cents / p.installments))}` : '';
    return (
      <div className="narrow">
        <AutoRefresh seconds={6} />
        <h1>Pague {brl(p.amount_cents)} no cartão{parcels}</h1>
        <p className="sub">{team.name} · {champ.name}. A vaga fica reservada por 30 minutos; esta página atualiza sozinha quando o pagamento for aprovado.</p>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 46 }}>💳</div>
          <p className="sub" style={{ margin: '6px 0 14px' }}>Você vai para a página segura do Asaas para digitar o cartão. Depois de pagar, volte para esta página.</p>
          {p.invoice_url
            ? <a href={p.invoice_url} target="_blank" rel="noopener" className="btn block">Pagar com cartão</a>
            : <span className="sub small">Cartão simulado (modo de teste)</span>}
        </div>
        {paymentProvider() === 'mock' && p.provider === 'mock' && (
          <form action={simulatePayment} style={{ marginTop: 12 }}>
            <input type="hidden" name="payment" value={p.id} />
            <button className="btn block">Simular pagamento aprovado (modo de teste)</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="narrow">
      <AutoRefresh seconds={4} />
      <h1>Pague {brl(p.amount_cents)} pelo PIX</h1>
      <p className="sub">{team.name} · {champ.name}. A vaga fica reservada por 30 minutos; esta página atualiza sozinha quando o pagamento cair.</p>
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="qr">
          {p.pix_image
            ? <img src={`data:image/png;base64,${p.pix_image}`} alt="QR code do PIX" />
            : <span>QR code simulado<br />(modo de teste)</span>}
        </div>
        <div className="copybox">{p.pix_payload}</div>
        <div className="actions" style={{ justifyContent: 'center' }}>
          {p.pix_payload && <CopyButton text={p.pix_payload} label="Copiar código PIX" />}
        </div>
      </div>
      {paymentProvider() === 'mock' && p.provider === 'mock' && (
        <form action={simulatePayment} style={{ marginTop: 12 }}>
          <input type="hidden" name="payment" value={p.id} />
          <button className="btn block">Simular pagamento recebido (modo de teste)</button>
        </form>
      )}
    </div>
  );
}
