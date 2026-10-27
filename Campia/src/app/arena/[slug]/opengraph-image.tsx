import { ImageResponse } from 'next/og';
import type { ArenaRow } from '@/lib/arena';
import { cityState } from '@/lib/format';
import { OG_SIZE, OgFrame } from '@/lib/og';
import { createClient } from '@/lib/supabase/server';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Arena na Campia';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase.from('arenas').select('*').eq('slug', slug).maybeSingle<ArenaRow>();
  if (!a) return new ImageResponse(<OgFrame title="Arena não encontrada" lines={[]} />, size);
  const { count } = await supabase.from('championships').select('id', { count: 'exact', head: true }).eq('owner_id', a.owner_id).eq('visibility', 'publico');
  return new ImageResponse(
    <OgFrame eyebrow="Arena" title={a.name}
      lines={[cityState(a.city, a.state), `${count ?? 0} campeonato${count === 1 ? '' : 's'} na Campia`]} />,
    size,
  );
}
