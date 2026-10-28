import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/champ';
import Prizes from '@/components/Prizes';
import type { Rules } from '@/lib/domain/types';
import ViewBeacon from '@/components/ViewBeacon';
import SportIcon from '@/components/SportIcon';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { paymentProvider } from '@/lib/env';
import { brl, placeLabel } from '@/lib/format';
import { priceText } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/server';
import { registerTeam } from './actions';
import { joinWaitlist } from './waitlist-actions';

export const metadata: Metadata = { title: 'Inscrição' };
export const dynamic = 'force-dynamic';

export default async function Inscricao({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: champ } = await supabase.from('championships').select('id, owner_id, name, sport, fee_cents, price_tiers, card_installments, rules, location, city, state, online').eq('slug', slug).maybeSingle();
  if (!champ) notFound();
  const { count } = await supabase.from('teams').select('id', { count: 'exact', head: true }).eq('championship_id', champ.id).neq('status', 'inscrita');
  const { data: started } = await supabase.from('games').select('id').eq('championship_id', champ.id).not('home_score', 'is', null).limit(1);
  const rules = sportRules(champ.sport);
  const place = placeLabel({ online: champ.online, location: champ.location, city: champ.city, state: champ.state ?? '' });
  const needsCpf = paymentProvider() === 'asaas';
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="narrow">
      {user?.id !== champ.owner_id && <ViewBeacon slug={slug} page="inscricao" />}
      <Link href={`/c/${slug}`} className="back-link">‹ {champ.name}</Link>
      <h1>Inscrição de {rules.who === 'Dupla' ? 'dupla' : 'time'}</h1>
      <p className="sub" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><SportIcon sport={champ.sport} size={16} plain />{sportLabel(champ.sport)} · {priceText(champ.fee_cents, champ.price_tiers, brl).long} · {count ?? 0} vaga{count === 1 ? '' : 's'} em aberto{place ? ` · ${place}` : ''}</p>
      <Prizes prizes={(champ.rules as Rules | null)?.prizes} compact />
      <Flash erro={sp.erro} ok={sp.ok} />
      {started?.length ? <div className="card empty">As inscrições estão encerradas: o campeonato já começou.</div> : !count ? (
        sp.ok ? null : (
        <form action={joinWaitlist} className="card">
          <input type="hidden" name="slug" value={slug} />
          <b>As vagas acabaram. Entre na lista de espera</b>
          <p className="sub" style={{ margin: '4px 0 0' }}>Se um time desistir ou não pagar o PIX, avisamos por e-mail na ordem da fila. A vaga fica com quem se inscrever e pagar primeiro.</p>
          <label htmlFor="w-team">Nome {rules.who === 'Dupla' ? 'da dupla' : 'do time'}</label>
          <input id="w-team" name="team" className="inp" required minLength={2} maxLength={40} />
          <div className="grid2">
            <div><label htmlFor="w-captain">Capitão</label><input id="w-captain" name="captain" className="inp" maxLength={60} /></div>
            <div><label htmlFor="w-phone">WhatsApp</label><input id="w-phone" name="phone" className="inp" inputMode="tel" placeholder="(11) 99999-9999" /></div>
          </div>
          <label htmlFor="w-email">E-mail para o aviso</label>
          <input id="w-email" name="email" type="email" className="inp" required autoComplete="email" placeholder="voce@exemplo.com" />
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--text)', fontSize: 13 }}>
            <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
            <span>Li e aceito os <Link href="/termos" target="_blank">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank">Política de Privacidade</Link>.</span>
          </label>
          <div style={{ marginTop: 16 }}><button className="btn block">Entrar na lista de espera</button></div>
        </form>
        )
      ) : (
        <form action={registerTeam} className="card">
          <input type="hidden" name="slug" value={slug} />
          <label htmlFor="name" style={{ marginTop: 0 }}>Nome {rules.who === 'Dupla' ? 'da dupla' : 'do time'}</label>
          <input id="name" name="name" className="inp" required minLength={2} maxLength={40} placeholder={rules.who === 'Dupla' ? 'Ex.: Ana & Bia' : 'Ex.: Resenha FC'} />
          <div className="grid2">
            <div><label htmlFor="short">Sigla (3 letras)</label><input id="short" name="short" className="inp" maxLength={3} placeholder="RES" /></div>
            <div><label htmlFor="captain">Capitão</label><input id="captain" name="captain" className="inp" required /></div>
          </div>
          <label htmlFor="phone">WhatsApp do capitão</label>
          <input id="phone" name="phone" className="inp" inputMode="tel" required placeholder="(11) 99999-9999" />
          <label htmlFor="email">E-mail do capitão</label>
          <input id="email" name="email" type="email" className="inp" required autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" />
          <p className="sub small" style={{ margin: '6px 0 0' }}>Com esse e-mail você acompanha o time em <b>Meus times</b>: próximos jogos, resultados e posição.</p>
          {needsCpf && <><label htmlFor="cpf">CPF ou CNPJ do responsável (para a cobrança)</label><input id="cpf" name="cpf" className="inp" inputMode="numeric" required /></>}
          <label htmlFor="coupon">Cupom de desconto (se tiver)</label>
          <input id="coupon" name="coupon" className="inp" maxLength={20} autoCapitalize="characters" placeholder="Ex.: PARCEIRO10" />
          {(champ.card_installments ?? 0) > 0 && (
            <fieldset>
              <legend>Como vai pagar</legend>
              <div className="choice">
                <label><input type="radio" name="method" value="pix" defaultChecked /> ⚡ PIX (confirma na hora)</label>
                <label><input type="radio" name="method" value="cartao" /> 💳 Cartão de crédito{champ.card_installments > 1 ? ` (até ${champ.card_installments}x)` : ''}</label>
              </div>
              {champ.card_installments > 1 && (
                <div className="if-card">
                  <label htmlFor="installments">Parcelas no cartão</label>
                  <select id="installments" name="installments" className="inp" defaultValue="1">
                    {Array.from({ length: champ.card_installments }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x sem juros para você`}</option>)}
                  </select>
                </div>
              )}
              <p className="sub small" style={{ margin: '6px 0 0' }}>No cartão, você digita os dados na página segura do Asaas; a Campia não vê o número do cartão.</p>
            </fieldset>
          )}
          <label htmlFor="players">{rules.who} (um por linha, com o número se quiser)</label>
          <textarea id="players" name="players" className="inp" required placeholder={'10 João\n7 Pedro\nCarlos'} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--text)', fontSize: 13 }}>
            <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
            <span>Li e aceito {(champ.rules as { regulation?: string } | null)?.regulation ? <>o <Link href={`/c/${slug}?aba=regulamento`} target="_blank">Regulamento do campeonato</Link>, </> : ''}os <Link href="/termos" target="_blank">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank">Política de Privacidade</Link>. Os atletas autorizam exibir nome e estatísticas na página do campeonato; WhatsApp, e-mail e CPF não são exibidos.</span>
          </label>
          <div style={{ marginTop: 16 }}><button className="btn block">Continuar para o pagamento</button></div>
          <p className="sub small" style={{ margin: '10px 0 0' }}>A vaga fica reservada por 30 minutos enquanto o PIX não é pago.</p>
        </form>
      )}
    </div>
  );
}
