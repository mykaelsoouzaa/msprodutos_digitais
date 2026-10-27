export type Source = 'whatsapp' | 'instagram' | 'facebook' | 'google' | 'busca' | 'campia' | 'direto' | 'outros';
export type ViewPage = 'pagina' | 'inscricao';

export const SOURCE_LABEL: Record<Source, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', google: 'Google',
  busca: 'Outros buscadores', campia: 'Dentro da Campia', direto: 'Link direto', outros: 'Outros sites',
};

/** Marca que vai nos links compartilhados pela Campia: ?origem=whatsapp. */
export function withOrigin(url: string, source: Source) {
  return `${url}${url.includes('?') ? '&' : '?'}origem=${source}`;
}

/**
 * De onde veio o visitante. Primeiro a marca no link (?origem= ou ?utm_source=),
 * depois o site anterior (referrer). O WhatsApp quase nunca manda referrer, por isso
 * os links de compartilhar levam ?origem=whatsapp.
 */
export function classifySource(referrer: string, params: URLSearchParams, ownHost: string): Source {
  const tag = (params.get('origem') || params.get('utm_source') || params.get('ref') || '').toLowerCase();
  if (tag) {
    if (/^(wa|whats|whatsapp|zap)/.test(tag)) return 'whatsapp';
    if (/^(ig|insta)/.test(tag)) return 'instagram';
    if (/^(fb|face)/.test(tag)) return 'facebook';
    if (tag.startsWith('google')) return 'google';
    return 'outros';
  }
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { return 'direto'; }
  if (!host) return 'direto';
  if (host === ownHost || host.endsWith('.vercel.app') || host.endsWith('campia.app.br')) return 'campia';
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return 'whatsapp';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(host)) return 'facebook';
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google';
  if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|brave\.com)$/.test(host)) return 'busca';
  return 'outros';
}

/** Navegadores automáticos (Google, prévia do WhatsApp etc.) não contam como visita. */
export function isBot(userAgent: string) {
  return !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse|curl|wget|python|node-fetch/i.test(userAgent);
}

export interface ViewRow { day: string; page: ViewPage; source: Source; views: number }

/** Resumo para o painel: total, inscrição, por origem (maior primeiro) e por dia (sem buracos). */
export function summarize(rows: ViewRow[], today: string, days: number) {
  const start = shiftDay(today, -(days - 1));
  const recent = rows.filter(r => r.day >= start && r.day <= today);
  const pageViews = recent.filter(r => r.page === 'pagina');
  const total = pageViews.reduce((s, r) => s + r.views, 0);
  const signup = recent.filter(r => r.page === 'inscricao').reduce((s, r) => s + r.views, 0);

  const bySource = new Map<Source, number>();
  for (const r of pageViews) bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.views);
  const sources = [...bySource].map(([source, views]) => ({ source, views })).sort((a, b) => b.views - a.views);

  const byDay = new Map<string, number>();
  for (const r of pageViews) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.views);
  const daily = Array.from({ length: days }, (_, i) => {
    const day = shiftDay(start, i);
    return { day, views: byDay.get(day) ?? 0 };
  });
  return { total, signup, sources, daily };
}

function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
