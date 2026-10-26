import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/champ';
import SportIcon from '@/components/SportIcon';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { paymentProvider } from '@/lib/env';
import { brl } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { registerTeam } from './actions';

export const metadata: Metadata = { title: 'Inscrição' };
export const dynamic = 'force-dynamic';

export default async function Inscricao({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: champ } = await supabase.from('championships').select('id, name, sport, fee_cents').eq('slug', slug).maybeSingle();
  if (!champ) notFound();
  const { count } = await supabase.from('teams').select('id', { count: 'exact', head: true }).eq('championship_id', champ.id).neq('status', 'inscrita');
  const rules = sportRules(champ.sport);
  const needsCpf = paymentProvider() === 'asaas';

  return (
    <div className="narrow">
      <Link href={`/c/${slug}`} className="back-link">‹ {champ.name}</Link>
      <h1>Inscrição de {rules.who === 'Dupla' ? 'dupla' : 'time'}</h1>
      <p className="sub" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><SportIcon sport={champ.sport} size={16} plain />{sportLabel(champ.sport)} · {brl(champ.fee_cents)} · {count ?? 0} vaga{count === 1 ? '' : 's'} em aberto</p>
      <Flash erro={sp.erro} />
      {!count ? <div className="card empty">As vagas estão preenchidas no momento. Vagas reservadas e não pagas voltam em até 30 minutos.</div> : (
        <form action={registerTeam} className="card">
          <input type="hidden" name="slug" value={slug} />
          <label htmlFor="name" style={{ marginTop: 0 }}>Nome do {rules.who === 'Dupla' ? 'dupla' : 'time'}</label>
          <input id="name" name="name" className="inp" required minLength={2} maxLength={40} placeholder={rules.who === 'Dupla' ? 'Ex.: Ana & Bia' : 'Ex.: Resenha FC'} />
          <div className="grid2">
            <div><label htmlFor="short">Sigla (3 letras)</label><input id="short" name="short" className="inp" maxLength={3} placeholder="RES" /></div>
            <div><label htmlFor="captain">Capitão</label><input id="captain" name="captain" className="inp" required /></div>
          </div>
          <label htmlFor="phone">WhatsApp do capitão</label>
          <input id="phone" name="phone" className="inp" inputMode="tel" required placeholder="(11) 99999-9999" />
          {needsCpf && <><label htmlFor="cpf">CPF ou CNPJ do responsável (para o PIX)</label><input id="cpf" name="cpf" className="inp" inputMode="numeric" required /></>}
          <label htmlFor="players">{rules.who} (um por linha, com o número se quiser)</label>
          <textarea id="players" name="players" className="inp" required placeholder={'10 João\n7 Pedro\nCarlos'} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--text)', fontSize: 13 }}>
            <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
            Os atletas autorizam exibir nome e estatísticas na página do campeonato. O WhatsApp não é exibido.
          </label>
          <div style={{ marginTop: 16 }}><button className="btn block">Continuar para o pagamento</button></div>
          <p className="sub small" style={{ margin: '10px 0 0' }}>A vaga fica reservada por 30 minutos enquanto o PIX não é pago.</p>
        </form>
      )}
    </div>
  );
}
