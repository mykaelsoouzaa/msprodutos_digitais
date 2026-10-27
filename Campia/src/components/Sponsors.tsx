import { type Sponsor, sortSponsors } from '@/lib/sponsors';

/** Faixa de patrocinadores: master em destaque, apoio menor. Links marcados como patrocinados. */
export default function Sponsors({ list, compact = false }: { list: Sponsor[]; compact?: boolean }) {
  if (!list.length) return null;
  const sorted = sortSponsors(list);
  const master = sorted.filter(s => s.tier === 'master');
  const apoio = sorted.filter(s => s.tier !== 'master');
  const item = (s: Sponsor, big: boolean) => {
    const inner = s.logo_url
      ? <img src={s.logo_url} alt={s.name} title={s.name} loading="lazy" />
      : <span>{s.name}</span>;
    const cls = `sponsor ${big ? 'big' : ''} ${s.logo_url ? '' : 'text'}`;
    return s.url
      ? <a key={s.id} href={s.url} target="_blank" rel="sponsored noopener" className={cls}>{inner}</a>
      : <div key={s.id} className={cls}>{inner}</div>;
  };
  return (
    <section className={`sponsors ${compact ? 'compact' : ''}`} aria-label="Patrocinadores">
      {master.length > 0 && (
        <>
          <div className="sponsors-title">{master.length > 1 ? 'Patrocinadores' : 'Patrocínio'}</div>
          <div className="sponsors-row">{master.map(s => item(s, true))}</div>
        </>
      )}
      {apoio.length > 0 && (
        <>
          <div className="sponsors-title">Apoio</div>
          <div className="sponsors-row">{apoio.map(s => item(s, false))}</div>
        </>
      )}
    </section>
  );
}
