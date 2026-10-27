import { ImageResponse } from 'next/og';
import { loadChampionship } from '@/lib/data';
import { FORMATS, sportLabel } from '@/lib/domain/sports';
import { isDecided } from '@/lib/domain/standings';
import { brl, placeLabel } from '@/lib/format';
import { OG_SIZE, OgFrame } from '@/lib/og';
import { createClient } from '@/lib/supabase/server';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Campeonato na Campia';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadChampionship(supabase, { slug });
  if (!data) return new ImageResponse(<OgFrame title="Campeonato não encontrado" lines={[]} />, size);

  const { champ, teams, games } = data;
  const open = teams.filter(t => t.status !== 'inscrita').length;
  const played = games.filter(isDecided).length;
  const done = games.length > 0 && played === games.length;
  const badge = done ? { text: 'Encerrado', color: '#d1d5db' }
    : played > 0 ? { text: 'Em andamento', color: '#f59e0b' }
    : open > 0 ? { text: 'Inscrições abertas', color: '#22c55e' }
    : { text: 'Em breve', color: '#a3e635' };
  const status = played === 0 && open > 0
    ? `${open} vaga${open > 1 ? 's' : ''} · ${champ.feeCents ? `${brl(champ.feeCents)} por time` : 'inscrição grátis'}`
    : `${played} de ${games.length} jogos · ${teams.length} times`;

  return new ImageResponse(
    <OgFrame eyebrow={`${sportLabel(champ.sport)} · ${FORMATS[champ.format]}`} title={champ.name} badge={badge}
      lines={[status, champ.online ? 'Online' : placeLabel(champ)]} />,
    size,
  );
}
