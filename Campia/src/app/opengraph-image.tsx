import { ImageResponse } from 'next/og';
import { OG_SIZE, OgFrame } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Campia: campeonatos organizados em 2 minutos';

export default function Image() {
  return new ImageResponse(
    <OgFrame eyebrow="Futebol · quadra · areia · raquete · games" title="Seu campeonato organizado em 2 minutos"
      lines={['Tabela automática, inscrição com PIX e resultados no WhatsApp.']} />,
    size,
  );
}
