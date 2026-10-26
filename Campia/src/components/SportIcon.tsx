// Ícones próprios dos esportes (traço, herdam a cor do texto). Substituem os emojis,
// que mudam de aparência em cada celular.
import type { SportIcon as Glyph } from '@/lib/domain/sports';
import { sportRules } from '@/lib/domain/sports';

const PATHS: Record<Glyph, React.ReactNode> = {
  futebol: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l3.4 2.5-1.3 4h-4.2l-1.3-4z" />
      <path d="M12 3v4.5M15.4 10l4.9-1.6M14.1 14l3 4.1M9.9 14l-3 4.1M8.6 10L3.7 8.4" />
    </>
  ),
  basquete: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
      <path d="M5.6 5.6c2.6 2.6 2.6 10.2 0 12.8M18.4 5.6c-2.6 2.6-2.6 10.2 0 12.8" />
    </>
  ),
  volei: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c-1.5 3.5-1.2 6.4 0 9M12 12c3.5-.5 6.2.6 8.5 3M12 12c-2 2.9-4.8 4.4-8.3 4.6" />
      <path d="M7.4 4.3c2.6 1.7 4.2 4.3 4.6 7.7" />
    </>
  ),
  handebol: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M4.5 7.5c4 1.5 11 1.5 15 0M4.5 16.5c4-1.5 11-1.5 15 0M9 3.5c-1.8 5.5-1.8 11.5 0 17M15 3.5c1.8 5.5 1.8 11.5 0 17" />
    </>
  ),
  tenis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6c3.4 3.4 3.4 9.4 0 12.8M18.4 5.6c-3.4 3.4-3.4 9.4 0 12.8" />
    </>
  ),
  padel: (
    <>
      <rect x="4" y="2.5" width="11" height="13" rx="5.5" transform="rotate(-35 9.5 9)" />
      <path d="M13.2 15.3l4.6 5.2" strokeWidth="2.6" />
      <circle cx="8" cy="8.2" r=".7" /><circle cx="10.4" cy="7" r=".7" /><circle cx="9.2" cy="10.4" r=".7" />
      <circle cx="19" cy="5" r="2" />
    </>
  ),
  pingpong: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M14.6 14.6l5 5" strokeWidth="2.6" />
      <circle cx="18.5" cy="5.5" r="2" />
    </>
  ),
  games: (
    <>
      <path d="M7 7h10a4 4 0 0 1 4 4l.6 4.4a2.6 2.6 0 0 1-4.6 2.1L15 15H9l-2 2.5a2.6 2.6 0 0 1-4.6-2.1L3 11a4 4 0 0 1 4-4z" />
      <path d="M7.5 10v4M5.5 12h4" />
      <circle cx="15.5" cy="11" r=".8" /><circle cx="17.5" cy="13" r=".8" />
    </>
  ),
};

export function GlyphIcon({ glyph, size = 22 }: { glyph: Glyph; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[glyph]}
    </svg>
  );
}

/** Ícone do esporte dentro de um selo colorido. */
export default function SportIcon({ sport, size = 22, plain = false }: { sport: string; size?: number; plain?: boolean }) {
  const glyph = sportRules(sport).glyph;
  if (plain) return <GlyphIcon glyph={glyph} size={size} />;
  return <span className={`sport-ico g-${sportRules(sport).group.toLowerCase()}`}><GlyphIcon glyph={glyph} size={size} /></span>;
}
