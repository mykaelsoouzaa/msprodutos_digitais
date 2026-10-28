import type { Rules } from '@/lib/domain/types';

/** Quadro de premiação (só mostra as linhas preenchidas). */
export default function Prizes({ prizes, compact = false }: { prizes: Rules['prizes']; compact?: boolean }) {
  if (!prizes) return null;
  const rows = ([['🥇', 'Campeão', prizes.first], ['🥈', 'Vice', prizes.second], ['🥉', '3º lugar', prizes.third], ['⭐', 'Craque', prizes.best]] as const).filter(r => r[2]);
  if (!rows.length) return null;
  return (
    <div className={`card prizes ${compact ? 'compact' : ''}`}>
      <b>🏆 Premiação</b>
      {rows.map(([icon, label, value]) => (
        <div key={label} className="prize-row"><span className="prize-icon">{icon}</span><span className="grow"><span className="prize-label">{label}</span><b>{value}</b></span></div>
      ))}
    </div>
  );
}
