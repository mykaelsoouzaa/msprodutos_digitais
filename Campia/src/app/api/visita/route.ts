import { createClient } from '@supabase/supabase-js';
import { isBot } from '@/lib/visits';

const SLUG = /^[a-z0-9-]{3,80}$/;
const PAGES = new Set(['pagina', 'inscricao']);

/**
 * Recebe o aviso de visita do navegador (sendBeacon) e soma 1 no contador do dia.
 * Não guarda IP nem nada que identifique a pessoa.
 */
export async function POST(req: Request) {
  if (isBot(req.headers.get('user-agent') ?? '')) return new Response(null, { status: 204 });
  let body: { slug?: unknown; page?: unknown; source?: unknown };
  try { body = JSON.parse((await req.text()).slice(0, 500)); } catch { return new Response(null, { status: 400 }); }
  const slug = String(body.slug ?? ''), page = String(body.page ?? ''), source = String(body.source ?? '').slice(0, 20);
  if (!SLUG.test(slug) || !PAGES.has(page)) return new Response(null, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.rpc('track_view', { p_slug: slug, p_page: page, p_source: source });
  }
  return new Response(null, { status: 204 });
}
