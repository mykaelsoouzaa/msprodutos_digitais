// Fotos do campeonato: guardadas no Storage (pasta pública "arenas") e listadas nas regras do campeonato.

export interface Photo { url: string; path: string; caption?: string; at: string }

export const PHOTO_LIMIT = 60;
export const PHOTO_MAX_BYTES = 1024 * 1024;
export const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

/** Tamanho final da foto reduzida no celular (o lado maior). */
export function fitSize(w: number, h: number, max = 1600) {
  if (w <= max && h <= max) return { w, h };
  const k = max / Math.max(w, h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Mais nova primeiro. */
export const sortPhotos = (list: Photo[] | undefined) => [...(list ?? [])].sort((a, b) => b.at.localeCompare(a.at));
