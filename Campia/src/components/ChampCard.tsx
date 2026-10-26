import Link from 'next/link';
import SportIcon from '@/components/SportIcon';
import { STATUS_BADGE, STATUS_LABEL, type ListingItem } from '@/lib/explore';
import { FORMATS, sportLabel } from '@/lib/domain/sports';
import { brl, fmtDate, placeLabel } from '@/lib/format';

/** Cartão de campeonato nas listagens. `organizer` mostra "por Arena X". */
export default function ChampCard({ c, organizer }: { c: ListingItem; organizer?: { name: string; slug: string } }) {
  const place = placeLabel(c);
  return (
    <Link href={`/c/${c.slug}`} className="card champ-card">
      <div className="champ-card-head">
        <SportIcon sport={c.sport} />
        <div className="grow">
          <b>{c.name}</b>
          <span>{sportLabel(c.sport)} · {FORMATS[c.format]}</span>
        </div>
      </div>
      <div className="champ-card-meta">
        {c.online ? <span className="badge online">🌐 Online</span> : place && <span>📍 {place}</span>}
        {c.start && <span>📅 {c.status === 'encerrado' ? 'começou' : 'começa'} {fmtDate(c.start)}</span>}
        {organizer && <span>por {organizer.name}</span>}
      </div>
      <div className="champ-card-foot">
        <span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
        {c.status === 'abertas' && <span className="small">{c.open} vaga{c.open > 1 ? 's' : ''} · {c.fee_cents ? brl(c.fee_cents) : 'grátis'}</span>}
      </div>
    </Link>
  );
}
