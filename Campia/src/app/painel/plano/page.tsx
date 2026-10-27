import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import { paymentProvider } from '@/lib/env';
import { brl } from '@/lib/format';
import { campiaFeePercent } from '@/lib/payout';
import { PRO_FEATURES, isProActive, proFeePercent, proPriceCents } from '@/lib/plan';
import { myPlan } from '@/lib/plan-server';
import { createClient } from '@/lib/supabase/server';
import { cancelPro, subscribePro } from '../plan-actions';

export const metadata: Metadata = { title: 'Plano Pro' };
export const dynamic = 'force-dynamic';

const date = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default async function Plano({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const plan = user ? await myPlan(supabase, user.id) : null;
  const pro = isProActive(plan);
  const price = brl(proPriceCents());

  return (
    <div className="narrow">
      <Link href="/painel" className="back-link">‹ Painel</Link>
      <h1>Plano Pro</h1>
      <p className="sub">Para arenas e organizadores que fazem campeonato todo mês.</p>
      <Flash ok={sp.ok} erro={sp.erro} />

      <section className={`card plan-card ${pro ? 'on' : ''}`}>
        <div className="plan-top">
          <div>
            <span className="badge ok">{pro ? 'Seu plano' : 'Pro'}</span>
            <div className="plan-price">{price}<span>/mês</span></div>
          </div>
          {pro && plan?.paid_until && <span className="sub small">{plan.status === 'cancelado' ? 'termina em' : plan.source === 'cortesia' ? 'cortesia até' : 'pago até'} {date(plan.paid_until)}</span>}
        </div>
        <ul className="plan-list">
          {PRO_FEATURES.map(([icon, text], i) => (
            <li key={text}><span>{icon}</span><span>{i === 0 ? <>Taxa por inscrição de <b>{proFeePercent()}%</b> (no grátis é {campiaFeePercent()}%)</> : text}</span></li>
          ))}
        </ul>

        {pro && plan?.status === 'ativo' && plan.source === 'asaas' ? (
          <form action={cancelPro} className="actions">
            <p className="sub small" style={{ margin: 0, flex: '1 1 100%' }}>A mensalidade chega pelo e-mail do Asaas (PIX, boleto ou cartão). Cancelando, o Pro vale até o fim do período pago.</p>
            <button className="btn ghost sm">Cancelar assinatura</button>
          </form>
        ) : plan?.status === 'pendente' && plan.invoice_url ? (
          <div className="actions">
            <p className="sub small" style={{ margin: 0, flex: '1 1 100%' }}>Assinatura criada. Falta pagar a primeira mensalidade: assim que o Asaas confirmar, o Pro liga sozinho.</p>
            <a href={plan.invoice_url} className="btn">Pagar primeira mensalidade</a>
            <form action={cancelPro}><button className="btn ghost sm">Desistir</button></form>
          </div>
        ) : plan?.source === 'cortesia' && pro ? null : (
          <form action={subscribePro} style={{ marginTop: 14 }}>
            <label htmlFor="pl-name" style={{ marginTop: 0 }}>Nome do responsável ou da empresa</label>
            <input id="pl-name" name="name" className="inp" required minLength={2} maxLength={100} placeholder="Ex.: Arena Central Ltda" />
            <label htmlFor="pl-cpf">CPF ou CNPJ (para a cobrança)</label>
            <input id="pl-cpf" name="cpf" className="inp" required inputMode="numeric" placeholder="Só números" />
            <div style={{ marginTop: 14 }}><button className="btn block">{plan?.status === 'cancelado' && pro ? 'Voltar a assinar' : `Assinar o Pro por ${price}/mês`}</button></div>
            <p className="sub small" style={{ margin: '8px 0 0' }}>
              {paymentProvider() === 'asaas' ? 'Você vai para a página segura do Asaas para pagar a primeira mensalidade por PIX, boleto ou cartão. Cancele quando quiser.' : 'Modo de teste: o Pro é liberado na hora, sem cobrança.'}
            </p>
          </form>
        )}
      </section>
      <p className="sub small" style={{ textAlign: 'center', marginTop: 16 }}>Dúvidas? <a href="mailto:contato@campia.app.br">contato@campia.app.br</a></p>
    </div>
  );
}
