import { Dot } from '@/components/champ';
import { sportRules } from '@/lib/domain/sports';
import { champStats } from '@/lib/domain/stats';
import type { Card, Championship, Game, Team } from '@/lib/domain/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Aba Números: médias, destaques e fair play. */
export default function ChampNumbers({ champ, games, teams, cards }: { champ: Championship; games: Game[]; teams: Team[]; cards: Card[] }) {
  const rules = sportRules(champ.sport);
  const s = champStats(games, teams, cards);
  if (!s.games) return <div className="card empty">Os números aparecem depois dos primeiros resultados.</div>;
  const unit = rules.unit;
  const name = (id: string | null) => teams.find(t => t.id === id)?.name ?? '?';
  return (
    <div className="numbers">
      <div className="stats team-stats">
        <div className="stat"><b>{s.games}</b><span>jogos com placar</span></div>
        <div className="stat"><b>{s.total}</b><span>{unit} no total</span></div>
        <div className="stat"><b>{fmt(s.average)}</b><span>{unit} por jogo</span></div>
      </div>
      <div className="numbers-grid">
        {s.attack && (
          <div className="card num-card">
            <span className="num-label">⚔️ Melhor ataque</span>
            <span className="num-team"><Dot team={s.attack.team} /><b>{s.attack.team.name}</b></span>
            <span className="sub small">{s.attack.value} {unit} em {s.attack.games} jogo{s.attack.games === 1 ? '' : 's'}</span>
          </div>
        )}
        {s.defense && (
          <div className="card num-card">
            <span className="num-label">🛡️ Melhor defesa</span>
            <span className="num-team"><Dot team={s.defense.team} /><b>{s.defense.team.name}</b></span>
            <span className="sub small">{s.defense.value} {unit} sofridos em {s.defense.games} jogo{s.defense.games === 1 ? '' : 's'}</span>
          </div>
        )}
        {s.biggest && (
          <div className="card num-card">
            <span className="num-label">💥 Maior {unit === 'gols' ? 'goleada' : 'vitória'}</span>
            <b>{name(s.biggest.homeId)} {s.biggest.homeScore} × {s.biggest.awayScore} {name(s.biggest.awayId)}</b>
            <span className="sub small">{s.biggest.stage === 'ko' ? s.biggest.name : s.biggest.label}</span>
          </div>
        )}
      </div>
      {rules.cards && s.fairPlay.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <h2>🤝 Fair Play</h2>
          <p className="sub small" style={{ marginTop: 0 }}>Time mais disciplinado no topo: cada amarelo vale 1 ponto e cada vermelho 3. Menos é melhor.</p>
          <div className="card" style={{ padding: '6px 10px' }}>
            {s.fairPlay.map((f, i) => (
              <div key={f.team.id} className="rank-row">
                <span className="rank-pos">{i + 1}º</span>
                <Dot team={f.team} />
                <span className="grow">{f.team.name}</span>
                <span className="sub small">🟨 {f.yellow} · 🟥 {f.red}</span>
                <b className="rank-total">{f.points}</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
