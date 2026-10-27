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
import CopyButton from '@/components/CopyButton';
import { siteUrl } from '@/lib/env';
import { waLink } from '@/lib/format';
import { ensureReferralCode } from '@/lib/referral-server';

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
  const code = user ? await ensureReferralCode(user.id) : null;
  const refLink = code ? `${siteUrl()}/para-arenas?indicacao=${code}` : '';
  const { data: refs } = user ? await supabase.from('referrals').select('rewarded_at').eq('referrer_id', user.id).returns<Array<{ rewarded_at: string | null }>>() : { data: [] };
  const earned = (refs ?? []).filter(r => r.rewarded_at).length;

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
      {code && (
        <section className="card" id="indique" style={{ marginTop: 16 }}>
          <b>🎁 Indique uma arena e ganhe 1 mês de Pro</b>
          <p className="sub" style={{ margin: '4px 0 10px' }}>Mande seu link para outra arena ou organizador. Quando ela assinar o Pro, você ganha 1 mês de Pro de presente, quantas vezes indicar.</p>
          <div className="copybox">{refLink}</div>
          <div className="actions">
            <CopyButton text={refLink} label="Copiar link" />
            <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `Uso a Campia para organizar os campeonatos: inscrição com PIX, tabela automática e placar ao vivo. Dá uma olhada: ${refLink}`)}>Mandar no WhatsApp</a>
          </div>
          <p className="sub small" style={{ margin: '10px 0 0' }}>{(refs ?? []).length ? `${(refs ?? []).length} indicada${(refs ?? []).length > 1 ? 's' : ''} · ${earned} mês${earned === 1 ? '' : 'es'} ganho${earned === 1 ? '' : 's'}` : 'Nenhuma indicação ainda.'}</p>
        </section>
      )}
      <p className="sub small" style={{ textAlign: 'center', marginTop: 16 }}>Dúvidas? <a href="mailto:contato@campia.app.br">contato@campia.app.br</a></p>
    </div>
  );
}
