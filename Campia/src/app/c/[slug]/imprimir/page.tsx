import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Discipline, Scorers, TableTab } from '@/components/champ';
import PrintButton from '@/components/PrintButton';
import Sponsors from '@/components/Sponsors';
import { SPONSOR_SELECT, type Sponsor } from '@/lib/sponsors';
import { ownerIsPro } from '@/lib/plan-server';
import { loadChampionship } from '@/lib/data';
import { FORMATS, sportLabel, sportRules } from '@/lib/domain/sports';
import { isDecided, labels, ordered, sourceLabel } from '@/lib/domain/standings';
import { brl, fmtDate, placeLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase.from('championships').select('name').eq('slug', (await params).slug).maybeSingle();
  return { title: data ? `${data.name} · imprimir` : 'Imprimir', robots: { index: false, follow: false } };
}

export default async function Imprimir({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  if (!data) notFound();
  const { champ, teams, games, goals, players, cards } = data;
  const rules = sportRules(champ.sport);
  const pro = await ownerIsPro(supabase, data.row.owner_id);
  const { data: sponsors } = !pro ? { data: [] as Sponsor[] } : await supabase.from('sponsors').select(SPONSOR_SELECT).eq('championship_id', champ.id).order('created_at').returns<Sponsor[]>();
  const name = (id: string | null, src: Parameters<typeof sourceLabel>[1]) => teams.find(t => t.id === id)?.name ?? sourceLabel(games, src, teams);
  const score = (g: (typeof games)[number]) => {
    if (!isDecided(g)) return '×';
    if (g.wo === 'both') return 'W.O. duplo';
    const pen = g.penHome !== null && g.homeScore === g.awayScore ? ` (${g.penHome}×${g.penAway})` : '';
    return `${g.homeScore} × ${g.awayScore}${pen}${g.wo ? ' W.O.' : ''}`;
  };
  const place = placeLabel(champ);

  return (
    <div className="print-page">
      <div className="no-print print-toolbar">
        <Link href={`/c/${champ.slug}`} className="back-link">‹ {champ.name}</Link>
        <PrintButton />
        <span className="sub small">Na janela de impressão, escolha "Salvar como PDF" para ter o arquivo.</span>
      </div>

      <header className="print-head">
        <div>
          <h1>{champ.name}</h1>
          <p>{sportLabel(champ.sport)} · {FORMATS[champ.format]}{place ? ` · ${place}` : ''} · {teams.length} times{champ.feeCents ? ` · inscrição ${brl(champ.feeCents)}` : ''}</p>
        </div>
        <img src="/brand/campia-logo-claro.svg" alt="Campia" height={28} />
      </header>

      <section className="print-section">
        <h2>{champ.format === 'mata' ? 'Chaveamento' : 'Classificação'}</h2>
        <TableTab champ={champ} games={games} teams={teams} />
      </section>

      <section className="print-section">
        <h2>Jogos</h2>
        <table className="print-games">
          <thead><tr><th className="t">Fase</th><th>Data</th><th>Hora</th><th className="t">Local</th><th className="t r">Mandante</th><th>Placar</th><th className="t">Visitante</th></tr></thead>
          <tbody>
            {labels(games).flatMap(label => ordered(games).filter(g => g.label === label).map(g => (
              <tr key={g.id}>
                <td className="t">{g.stage === 'ko' ? g.name : `${g.group ? `G${g.group} · ` : ''}${g.label}`}</td>
                <td>{g.date ? fmtDate(g.date) : '-'}</td>
                <td>{g.time || '-'}</td>
                <td className="t">{g.field || '-'}</td>
                <td className="t r"><b>{name(g.homeId, g.srcHome)}</b></td>
                <td><b>{score(g)}</b></td>
                <td className="t"><b>{name(g.awayId, g.srcAway)}</b></td>
              </tr>
            )))}
          </tbody>
        </table>
      </section>

      {rules.scorers && goals.length > 0 && (
        <section className="print-section">
          <h2>{rules.unit === 'pontos' ? 'Cestinhas' : 'Artilharia'}</h2>
          <Scorers champ={champ} games={games} goals={goals} players={players} teams={teams} />
        </section>
      )}
      {rules.cards && cards.length > 0 && (
        <section className="print-section">
          <Discipline champ={champ} games={games} cards={cards} players={players} teams={teams} />
        </section>
      )}
      <Sponsors list={sponsors ?? []} compact />
      <p className="print-foot">Gerado em {new Date().toLocaleDateString('pt-BR')} · campia.app.br/c/{champ.slug}</p>
    </div>
  );
}
