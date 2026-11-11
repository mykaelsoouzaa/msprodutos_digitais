// Reconhece links de lojas, troca pelo link de afiliado e busca os dados do produto.
export type Plataforma = 'shopee' | 'mercadolivre' | 'amazon' | 'magalu' | 'outra';

export const NOME_PLATAFORMA: Record<Plataforma, string> = {
  shopee: 'Shopee', mercadolivre: 'Mercado Livre', amazon: 'Amazon', magalu: 'Magalu', outra: 'Loja',
};

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

/** Todos os links de uma mensagem, sem pontuação no fim. */
export function extrairLinks(texto: string): string[] {
  const achados = texto.match(URL_RE) ?? [];
  return [...new Set(achados.map((u) => u.replace(/[).,;!?*_~]+$/, '')))];
}

export function plataformaDe(url: string): Plataforma {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return 'outra'; }
  if (/(^|\.)shopee\.com\.br$|(^|\.)shp\.ee$|^s\.shopee\./.test(host)) return 'shopee';
  if (/(^|\.)mercadolivre\.com\.br$|(^|\.)mercadolibre\.com$|(^|\.)meli\.la$|(^|\.)mlstatic\.com$/.test(host)) return 'mercadolivre';
  if (/(^|\.)amazon\.com\.br$|(^|\.)amzn\.to$|(^|\.)a\.co$/.test(host)) return 'amazon';
  if (/(^|\.)magazineluiza\.com\.br$|(^|\.)magalu\.com$|(^|\.)divulgador\.magalu\.com$/.test(host)) return 'magalu';
  return 'outra';
}

export const lojaSuportada = (url: string) => plataformaDe(url) !== 'outra';

/** IDs da Shopee em links como .../nome-i.123.456 ou /product/123/456. */
export function idsShopee(url: string): { shopId: string; itemId: string } | null {
  const m = url.match(/-i\.(\d+)\.(\d+)/) ?? url.match(/\/product\/(\d+)\/(\d+)/);
  return m ? { shopId: m[1], itemId: m[2] } : null;
}

/** Link da Amazon com a tag de afiliado (remove outras tags). */
export function linkAmazon(url: string, tag: string): string {
  if (!tag) return url;
  const u = new URL(url);
  u.searchParams.delete('tag');
  u.searchParams.delete('linkCode');
  u.searchParams.set('tag', tag);
  return u.toString();
}

/**
 * Mercado Livre: o link oficial de afiliado sai do painel de afiliados do ML.
 * Aqui a conta informa um modelo com {url} (ex.: o próprio gerador de links, ou parâmetros de rastreio).
 * Sem modelo, o link segue como veio.
 */
export function linkModelo(url: string, modelo: string): string {
  if (!modelo) return url;
  if (modelo.includes('{url}')) return modelo.replace('{url}', encodeURIComponent(url));
  const u = new URL(url);
  for (const [k, v] of new URLSearchParams(modelo.replace(/^\?/, ''))) u.searchParams.set(k, v);
  return u.toString();
}

/** Segue redirecionamentos (links curtos) até a página do produto, sem baixar o corpo. */
export async function resolverLink(url: string, f: typeof fetch = fetch, max = 5): Promise<string> {
  let atual = url;
  for (let i = 0; i < max; i++) {
    const r = await f(atual, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Ofertix)' } }).catch(() => null);
    if (!r) break;
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) { atual = new URL(loc, atual).toString(); continue; }
    break;
  }
  return atual;
}

export interface DadosPagina { titulo: string; imagem: string; preco: number | null }

const meta = (html: string, prop: string) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  return (html.match(re)?.[1] ?? html.match(re2)?.[1] ?? '').trim();
};

const desescapar = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Dados básicos pela página (Open Graph). Funciona para a maioria das lojas; a Shopee usa a API. */
export function lerPagina(html: string): DadosPagina {
  const titulo = desescapar(meta(html, 'og:title') || (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '')).slice(0, 200);
  const imagem = desescapar(meta(html, 'og:image'));
  const precoTxt = meta(html, 'product:price:amount') || meta(html, 'og:price:amount');
  const preco = precoTxt ? Math.round(Number(precoTxt.replace(',', '.')) * 100) : null;
  return { titulo, imagem, preco: Number.isFinite(preco) ? preco : null };
}

export async function buscarPagina(url: string, f: typeof fetch = fetch): Promise<DadosPagina> {
  try {
    const r = await f(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Ofertix/1.0)', 'accept-language': 'pt-BR' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { titulo: '', imagem: '', preco: null };
    return lerPagina((await r.text()).slice(0, 400_000));
  } catch {
    return { titulo: '', imagem: '', preco: null };
  }
}
