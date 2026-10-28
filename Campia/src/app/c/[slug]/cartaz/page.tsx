import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import PrintButton from '@/components/PrintButton';
import SportIcon from '@/components/SportIcon';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import type { Rules } from '@/lib/domain/types';
import { siteUrl } from '@/lib/env';
import { brl, fmtDate, placeLabel } from '@/lib/format';
import { priceText } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Cartaz', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Cartaz A4 para imprimir e colar na arena: QR code leva direto para a inscrição. */
export default async function Cartaz({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from('championships')
    .select('id, name, sport, fee_cents, price_tiers, rules, location, city, state, online')
    .eq('slug', slug).maybeSingle();
  if (!c) notFound();
  const [{ count: open }, { data: first }] = await Promise.all([
    supabase.from('teams').select('id', { count: 'exact', head: true }).eq('championship_id', c.id).neq('status', 'inscrita'),
    supabase.from('games').select('date').eq('championship_id', c.id).not('date', 'is', null).order('date').limit(1),
  ]);
  const rules = sportRules(c.sport);
  const price = priceText(c.fee_cents, c.price_tiers, brl);
  const who = rules.who === 'Dupla' ? 'dupla' : 'time';
  const prizes = (c.rules as Rules | null)?.prizes;
  const url = `${siteUrl()}/c/${slug}/inscricao?origem=cartaz`;
  const qr = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1410', light: '#ffffff' } });
  const place = placeLabel({ online: c.online, location: c.location, city: c.city, state: c.state ?? '' });
  const start = first?.[0]?.date as string | undefined;
  const prizeList = prizes ? ([['🥇', prizes.first], ['🥈', prizes.second], ['🥉', prizes.third], ['⭐', prizes.best]] as const).filter(([, v]) => v) : [];

  return (
    <div className="poster-wrap">
      <div className="actions no-print" style={{ marginBottom: 12 }}>
        <Link href={`/c/${slug}`} className="btn ghost sm">‹ Voltar</Link>
        <PrintButton label="Imprimir cartaz" />
      </div>
      <article className="poster">
        <div className="poster-sport"><SportIcon sport={c.sport} size={22} plain /> {sportLabel(c.sport)}</div>
        <h1>{c.name}</h1>
        <p className="poster-open">{(open ?? 0) > 0 ? 'Inscrições abertas' : 'Lista de espera aberta'}</p>
        <div className="poster-facts">
          <div><span>Inscrição</span><b>{price.now ? `${price.long} por ${who}` : 'Grátis'}</b></div>
          {start && <div><span>Início</span><b>{fmtDate(start)}</b></div>}
          {place && <div><span>Local</span><b>{place}</b></div>}
          {(open ?? 0) > 0 && <div><span>Vagas</span><b>{open} restante{open === 1 ? '' : 's'}</b></div>}
        </div>
        {prizeList.length > 0 && (
          <div className="poster-prizes">
            <b>Premiação</b>
            {prizeList.map(([icon, v]) => <span key={icon}>{icon} {v}</span>)}
          </div>
        )}
        <div className="poster-qr">
          <div className="qr-box" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>
            <b>Aponte a câmera do celular</b>
            <span>e inscreva {rules.who === 'Dupla' ? 'sua dupla' : 'seu time'} na hora{price.now ? ', com PIX' : ''}.</span>
            <small>{url.replace(/^https?:\/\//, '').replace('?origem=cartaz', '')}</small>
          </div>
        </div>
        <p className="poster-foot">Tabela, jogos e resultados ao vivo em campia.app.br</p>
      </article>
    </div>
  );
}
