import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChampCard from '@/components/ChampCard';
import { type ArenaRow, initials } from '@/lib/arena';
import { LISTING_SELECT, type ListingRow, toListing } from '@/lib/explore';
import { cityState, waLink } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getArena(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('arenas').select('*').eq('slug', slug).maybeSingle<ArenaRow>();
  return { supabase, arena: data };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { arena } = await getArena((await params).slug);
  if (!arena) return { title: 'Arena' };
  return { title: arena.name, description: arena.bio || `Campeonatos organizados por ${arena.name} na Campia.` };
}

export default async function ArenaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, arena } = await getArena(slug);
  if (!arena) notFound();

  const { data } = await supabase.from('championships').select(LISTING_SELECT)
    .eq('owner_id', arena.owner_id).eq('visibility', 'publico').order('created_at', { ascending: false }).limit(100).returns<ListingRow[]>();
  const items = toListing(data ?? []);
  const current = items.filter(c => c.status !== 'encerrado');
  const past = items.filter(c => c.status === 'encerrado');
  const place = [arena.address, cityState(arena.city, arena.state)].filter(Boolean).join(' · ');

  return (
    <>
      <section className="arena-hero">
        {arena.logo_url ? <img src={arena.logo_url} alt={`Logo ${arena.name}`} className="arena-logo" /> : <span className="arena-logo empty">{initials(arena.name)}</span>}
        <div className="grow">
          <h1>{arena.name}</h1>
          {place && <p className="sub" style={{ margin: '0 0 6px' }}>📍 {place}</p>}
          {arena.bio && <p className="arena-bio">{arena.bio}</p>}
          <div className="actions">
            {arena.whatsapp && <a className="btn wa sm" target="_blank" rel="noopener" href={waLink(arena.whatsapp, `Olá! Vi a página da ${arena.name} na Campia.`)}>WhatsApp</a>}
            {arena.instagram && <a className="btn ghost sm" target="_blank" rel="noopener" href={`https://instagram.com/${arena.instagram}`}>@{arena.instagram}</a>}
            {place && !/^\s*$/.test(place) && <a className="btn ghost sm" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${arena.name} ${place}`)}`}>Como chegar</a>}
          </div>
        </div>
      </section>

      <h2 className="section-title" style={{ marginTop: 28 }}>Campeonatos</h2>
      {current.length ? <div className="grid-cards" style={{ marginTop: 12 }}>{current.map(c => <ChampCard key={c.id} c={c} />)}</div>
        : <div className="card empty" style={{ marginTop: 12 }}>Nenhum campeonato acontecendo agora.</div>}

      {past.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 32 }}>Anteriores</h2>
          <div className="grid-cards" style={{ marginTop: 12 }}>{past.map(c => <ChampCard key={c.id} c={c} />)}</div>
        </>
      )}
      <p className="sub small" style={{ textAlign: 'center', marginTop: 32 }}>Organiza campeonatos? <Link href="/">Crie o seu na Campia</Link>.</p>
    </>
  );
}
