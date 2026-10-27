export interface Sponsor { id: string; name: string; url: string; logo_url: string; tier: 'master' | 'apoio' }

export const SPONSOR_LIMIT = 12;
export const SPONSOR_SELECT = 'id, name, url, logo_url, tier';

/** Master primeiro, depois apoio, na ordem em que foram cadastrados. */
export function sortSponsors<T extends { tier: string }>(list: T[]) {
  return [...list].sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'master' ? -1 : 1));
}

/** Aceita "paobom.com.br" ou "instagram.com/paobom" e devolve https://...; vazio se não parecer um site. */
export function normalizeUrl(raw: string) {
  const s = raw.trim();
  if (!s) return '';
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
  try {
    const u = new URL(withProto);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString().slice(0, 200);
  } catch {
    return null;
  }
}

/** As artes (Satori) só desenham PNG e JPG; logo em WEBP vira o nome escrito. */
export const drawableLogo = (url: string) => /\.(png|jpe?g)(\?|$)/i.test(url);
