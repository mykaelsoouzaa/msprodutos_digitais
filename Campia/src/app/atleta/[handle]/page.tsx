import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SportIcon from '@/components/SportIcon';
import { athleteTotals } from '@/lib/athlete';
import { type Athlete, loadAthleteEntries } from '@/lib/athlete-data';
import { initials } from '@/lib/arena';
import { sportLabel, sportRules } from '@/lib/domain/sports';
import { siteUrl } from '@/lib/env';
import { waLink } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getAthlete(handle: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('athletes').select('user_id, handle, name, city, state, bio').eq('handle', handle).maybeSingle<Athlete>();
  return { supabase, athlete: data };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { athlete } = await getAthlete((await params).handle);
  if (!athlete) return { title: 'Atleta' };
  return {
    title: athlete.name,
    description: athlete.bio || `Gols, títulos e prêmios de ${athlete.name} nos campeonatos da Campia.`,
    alternates: { canonical: `/atleta/${athlete.handle}` },
  };
}

export default async function AtletaPublico({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const { supabase, athlete } = await getAthlete(handle);
  if (!athlete) notFound();
  const rows = await loadAthleteEntries(supabase, athlete.user_id);
  const entries = rows.map(r => r.e);
  const t = athleteTotals(entries);
  const { data: { user } } = await supabase.auth.getUser();
  const url = `${siteUrl()}/atleta/${athlete.handle}`;
  const place = [athlete.city, athlete.state].filter(Boolean).join(' - ');
  const allPoints = entries.length > 0 && entries.every(e => sportRules(e.championship.sport).unit === 'pontos');

  return (
    <div className="narrow">
      <section className="athlete-hero">
        <span className="athlete-avatar">{initials(athlete.name)}</span>
        <div className="grow">
          <h1 style={{ margin: 0 }}>{athlete.name}</h1>
          {place && <p className="sub" style={{ margin: '2px 0 0' }}>📍 {place}</p>}
          {athlete.bio && <p className="arena-bio">{athlete.bio}</p>}
          <div className="actions">
            <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `⚽ Meu perfil de atleta na Campia: ${url}?origem=whatsapp`)}>Compartilhar</a>
            {user?.id === athlete.user_id && <Link href="/atleta" className="btn ghost sm">Editar perfil</Link>}
          </div>
        </div>
      </section>

      <div className="stats athlete-stats">
        <div className="stat"><b>{t.championships}</b><span>campeonato{t.championships === 1 ? '' : 's'}</span></div>
        <div className="stat"><b>{t.goals}</b><span>{allPoints ? 'pontos' : 'gols'}</span></div>
        <div className="stat"><b>{t.titles}</b><span>título{t.titles === 1 ? '' : 's'}</span></div>
        <div className="stat"><b>{t.awards}</b><span>prêmio{t.awards === 1 ? '' : 's'}</span></div>
      </div>

      {entries.length ? (
        <div className="stack">
          {entries.map(e => {
            const pts = sportRules(e.championship.sport).unit === 'pontos';
            return (
              <article key={e.championship.id} className="card athlete-entry">
                <header>
                  <span className="dot" style={{ background: e.team.color }}>{e.team.short}</span>
                  <div className="grow">
                    <Link href={`/c/${e.championship.slug}`}><b>{e.championship.name}</b></Link>
                    <span className="sub small"><SportIcon sport={e.championship.sport} size={12} plain /> {sportLabel(e.championship.sport)} · {e.team.name}</span>
                  </div>
                  {e.champion && <span className="badge ok">🏆 Campeão</span>}
                </header>
                <div className="athlete-line">
                  <span><b>{e.games}</b> jogo{e.games === 1 ? '' : 's'}</span>
                  <span><b>{e.goals}</b> {pts ? 'pontos' : e.goals === 1 ? 'gol' : 'gols'}</span>
                  {(e.yellow > 0 || e.red > 0) && <span>🟨 {e.yellow}{e.red ? ` · 🟥 ${e.red}` : ''}</span>}
                  {!e.finished && <span className="badge open">em andamento</span>}
                </div>
                {e.awards.length > 0 && <div className="athlete-awards">{e.awards.map(a => <span key={a} className="badge wait">🏅 {a}</span>)}</div>}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card empty">
          Nenhum campeonato ligado ainda.
          {user?.id === athlete.user_id && <> Abra a página de um campeonato que você jogou, vá em <b>Times</b> e toque em <b>Sou eu</b> no seu nome.</>}
        </div>
      )}
      <p className="sub small" style={{ textAlign: 'center', marginTop: 24 }}>Joga campeonatos? <Link href="/atleta">Crie seu perfil de atleta</Link> na Campia.</p>
    </div>
  );
}
