import type { Game } from './domain/types';
// Informações extras de um jogo: árbitro e links de lances (guardados nas regras do campeonato).

export interface GameInfo { referee?: string; videos?: string[] }
export const VIDEO_LIMIT = 5;

/** Aceita só links https de até 300 caracteres; até 5 por jogo. */
export function cleanVideos(text: string): string[] {
  return [...new Set(text.split(/\s+/).map(s => s.trim()).filter(s => /^https:\/\/[^\s]{4,300}$/.test(s)))].slice(0, VIDEO_LIMIT);
}

/** Id do vídeo do YouTube (para mostrar o player), ou null. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
    if (host === 'youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/^\/(shorts|live|embed)\/([\w-]{11})/);
      return m ? m[2] : null;
    }
  } catch { /* link inválido */ }
  return null;
}

export function videoLabel(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (/youtu/.test(h)) return 'YouTube';
    if (/instagram/.test(h)) return 'Instagram';
    if (/tiktok/.test(h)) return 'TikTok';
    if (/facebook|fb\.watch/.test(h)) return 'Facebook';
    return h;
  } catch { return 'Vídeo'; }
}

/** Placar em uma linha, para aviso no celular e compartilhamento. */
export function resultText(g: Pick<Game, 'homeScore' | 'awayScore' | 'penHome' | 'penAway' | 'wo'>, home: string, away: string) {
  if (g.wo === 'both') return `${home} e ${away}: W.O. duplo`;
  const pen = g.penHome !== null && g.penAway !== null && g.homeScore === g.awayScore ? ` (${g.penHome} × ${g.penAway})` : '';
  return `${home} ${g.homeScore} × ${g.awayScore} ${away}${pen}${g.wo ? ' · W.O.' : ''}`;
}
