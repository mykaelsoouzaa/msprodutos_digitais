import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { siteUrl } from '@/lib/env';

/** Atualiza a lista a cada hora. */
export const revalidate = 3600;

/**
 * Mapa do site para o Google: páginas fixas, campeonatos públicos e páginas das arenas.
 * Usa a chave pública (anon): só entra o que qualquer visitante já pode ver.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/campeonatos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/para-arenas`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/exemplo`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/ajuda`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/sobre`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/novidades`, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${base}/termos`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacidade`, changeFrequency: 'yearly', priority: 0.2 },
  ];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return fixed;

  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: champs }, { data: arenas }, { data: athletes }] = await Promise.all([
      db.from('championships').select('slug, created_at').eq('visibility', 'publico').order('created_at', { ascending: false }).limit(5000),
      db.from('arenas').select('slug, created_at').limit(5000),
      db.from('athletes').select('handle, created_at').limit(5000),
    ]);
    return [
      ...fixed,
      ...(champs ?? []).map(c => ({ url: `${base}/c/${c.slug}`, lastModified: c.created_at, changeFrequency: 'daily' as const, priority: 0.7 })),
      ...(arenas ?? []).map(a => ({ url: `${base}/arena/${a.slug}`, lastModified: a.created_at, changeFrequency: 'weekly' as const, priority: 0.6 })),
      ...(athletes ?? []).map(a => ({ url: `${base}/atleta/${a.handle}`, lastModified: a.created_at, changeFrequency: 'weekly' as const, priority: 0.4 })),
    ];
  } catch {
    return fixed;
  }
}
