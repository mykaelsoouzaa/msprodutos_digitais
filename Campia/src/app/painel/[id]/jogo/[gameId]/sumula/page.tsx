import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PrintButton from '@/components/PrintButton';
import { roleIn } from '@/lib/access';
import { loadChampionship } from '@/lib/data';
import { discipline } from '@/lib/domain/discipline';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { fmtDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Súmula' };
export const dynamic = 'force-dynamic';

/** Súmula em papel: elenco dos dois times com espaço para gols, cartões e assinaturas. */
export default async function Sumula({ params }: { params: Promise<{ id: string; gameId: string }> }) {
  const { id, gameId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await loadChampionship(supabase, { id });
  const g = data?.games.find(x => x.id === gameId);
  if (!data || !g || !g.homeId || !g.awayId || !(await roleIn(supabase, data.row, user))) notFound();
  const { champ, teams, players } = data;
  const rules = sportRules(champ.sport);
  const info = champ.rules.gameInfo?.[g.id] ?? {};
  const out = discipline(data.games, data.cards, data.players, data.teams, champ.rules.yellowLimit).suspended.get(g.id) ?? new Set<string>();
  const sides = [g.homeId, g.awayId].map(tid => ({
    team: teams.find(t => t.id === tid)!,
    roster: players.filter(p => p.teamId === tid).sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999) || a.name.localeCompare(b.name)),
  }));
  const blank = (n: number) => Array.from({ length: n }, (_, i) => i);
  const unit = rules.unit === 'pontos' ? 'Pts' : 'Gols';

  return (
    <div className="sumula">
      <div className="actions no-print" style={{ marginBottom: 12 }}>
        <Link href={`/painel/${id}/jogo/${g.id}`} className="btn ghost sm">‹ Voltar ao jogo</Link>
        <PrintButton label="Imprimir súmula" />
      </div>
      <header className="sumula-head">
        <div>
          <h1>Súmula</h1>
          <p>{champ.name} · {sportLabel(champ.sport)}</p>
        </div>
        <div className="sumula-meta">
          <span>{g.stage === 'ko' ? g.name : [g.group ? `Grupo ${g.group}` : '', g.label].filter(Boolean).join(' · ')}</span>
          <span>Data: {g.date ? fmtDate(g.date) : '____/____'}  Hora: {g.time || '____'}</span>
          <span>Local: {g.field || '________________'}</span>
          <span>Árbitro: {info.referee || '________________________'}</span>
        </div>
      </header>

      <div className="sumula-score">
        <span>{sides[0].team.name}</span><b className="box" /><span>×</span><b className="box" /><span>{sides[1].team.name}</span>
      </div>

      <div className="sumula-cols">
        {sides.map(({ team, roster }) => (
          <table key={team.id} className="sumula-table">
            <thead>
              <tr><th colSpan={rules.cards ? 6 : 4}>{team.name}</th></tr>
              <tr><th>Nº</th><th className="name">Atleta</th><th>✓</th>{rules.scorers && <th>{unit}</th>}{rules.cards && <><th>🟨</th><th>🟥</th></>}</tr>
            </thead>
            <tbody>
              {[...roster.map(p => ({ key: p.id, num: p.number, name: p.name, out: out.has(p.id) })), ...blank(Math.max(2, 14 - roster.length)).map(i => ({ key: `b${i}`, num: '', name: '', out: false }))].map(r => (
                <tr key={r.key} className={r.out ? 'out' : ''}>
                  <td className="num">{r.num}</td>
                  <td className="name">{r.name}{r.out && <small> (suspenso)</small>}</td>
                  <td />{rules.scorers && <td />}{rules.cards && <><td /><td /></>}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      <div className="sumula-notes">
        <b>Observações</b>
        <div className="lines">{blank(4).map(i => <span key={i} />)}</div>
      </div>
      <div className="sumula-signs">
        <span>Árbitro</span><span>Capitão {sides[0].team.short}</span><span>Capitão {sides[1].team.short}</span>
      </div>
      <p className="print-foot">Lance o resultado em campia.app.br/painel depois do jogo.</p>
    </div>
  );
}
