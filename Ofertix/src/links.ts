// Reconhece links de lojas, troca pelo link de afiliado e busca os dados do produto.
import { limparAmazon, limparRastreioML } from './regras.ts';
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
  // Tira a tag e o rastreio de quem mandou o link antes de pôr a da conta.
  const u = new URL(limparAmazon(url));
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
  // Tira os parâmetros de afiliado de quem mandou o link antes de pôr os da conta.
  const limpo = limparRastreioML(url);
  if (modelo.includes('{url}')) return modelo.replace('{url}', encodeURIComponent(limpo));
  const u = new URL(limpo);
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

/**
 * Mercado Livre: link /social/ (a vitrine do afiliado que mandou a oferta) → o produto dela.
 * Procura o código do anúncio (MLB…) primeiro no próprio endereço e, se não estiver lá, na página.
 * Com vários produtos, fica o do título da página (o destacado da oferta); sem como decidir, devolve vazio.
 */
export async function produtoDoSocialML(url: string, f: typeof fetch = fetch): Promise<string> {
  const ids = (t: string) => [...new Set([...t.matchAll(/\bMLB-?(\d{6,})/gi)].map((m) => m[1]!))];
  let texto = url;
  try { texto = decodeURIComponent(decodeURIComponent(url)); } catch { /* fica o original */ }
  const noEndereco = ids(texto);
  if (noEndereco.length === 1) return `https://produto.mercadolivre.com.br/MLB-${noEndereco[0]}`;
  try {
    const r = await f(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Ofertix/1.0)', 'accept-language': 'pt-BR' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return '';
    const html = (await r.text()).slice(0, 600_000);
    // Links de produto completos na página (anúncio ou catálogo), na ordem em que aparecem.
    // Códigos soltos não servem: o nome das fotos também tem "MLB…" (ex.: D_NQ_NP_846237-MLB104793048175_012026-P.webp).
    const vezes = new Map<string, number>();
    const linkDe = new Map<string, string>();
    for (const m of html.matchAll(/https?:\/\/(?:www\.|produto\.)?mercadoli(?:vre|bre)\.com\.br\/[^"'\s<>\\]*?(?:MLB-?\d{6,}|\/p\/MLB\d{6,})[^"'\s<>\\]*/gi)) {
      const u = m[0].split('?')[0]!.split('#')[0]!;
      if (/\.(webp|jpe?g|png|gif|svg)$/i.test(u) || /\/social\//.test(u)) continue;
      const id = ids(u)[0];
      if (!id) continue;
      if (!linkDe.has(id)) linkDe.set(id, u);
      vezes.set(id, (vezes.get(id) ?? 0) + 1);
    }
    if (linkDe.size === 1) return [...linkDe.values()][0]!;
    if (linkDe.size > 1) {
      // Vitrine com vários: o produto da oferta é o do título da página (og:title); senão, o que mais aparece.
      const titulo = (html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1] ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const palavras = titulo.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^(mercado|livre|r)$/.test(w));
      const nota = (u: string) => {
        const slug = u.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return palavras.filter((w) => slug.includes(w)).length;
      };
      const ordem = [...linkDe].map(([id, u]) => ({ u, n: nota(u), v: vezes.get(id) ?? 0 }))
        .sort((x, y) => y.n - x.n || y.v - x.v);
      const [p1, p2] = ordem;
      if (p1 && (p1.n > (p2?.n ?? -1) || (p1.n === p2!.n && p1.v > p2!.v))) return p1.u;
      return '';
    }
    // Sem link de produto: só aceita código que não seja de foto, e só se for um.
    const soltos = [...new Set([...html.matchAll(/\bMLB-?(\d{6,})(?![\d_])/gi)].filter((m) => !/-$/.test(html.slice(Math.max(0, m.index! - 1), m.index!))).map((m) => m[1]!))];
    if (soltos.length === 1) return `https://produto.mercadolivre.com.br/MLB-${soltos[0]}`;
  } catch { /* sem página */ }
  return '';
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
