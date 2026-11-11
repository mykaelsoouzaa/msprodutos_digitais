// API oficial de afiliados da Shopee Brasil (GraphQL).
// Credenciais: painel de afiliados da Shopee > Open API (AppID e Senha).
// Assinatura: SHA256(AppId + Timestamp + Payload + Segredo), em hexadecimal.
// Os nomes dos campos seguem a documentação da Open API de afiliados; confirmar no primeiro teste real.
import { createHash } from 'node:crypto';

export const SHOPEE_URL = 'https://open-api.affiliate.shopee.com.br/graphql';

export interface CredShopee { appId: string; segredo: string }

export function cabecalhoShopee(cred: CredShopee, payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const assinatura = createHash('sha256').update(`${cred.appId}${timestamp}${payload}${cred.segredo}`).digest('hex');
  return `SHA256 Credential=${cred.appId}, Timestamp=${timestamp}, Signature=${assinatura}`;
}

async function gql(cred: CredShopee, query: string, f: typeof fetch): Promise<any> {
  const payload = JSON.stringify({ query });
  const r = await f(SHOPEE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: cabecalhoShopee(cred, payload) },
    body: payload,
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json().catch(() => null) as any;
  if (!r.ok || !j || j.errors?.length) throw new Error(`Shopee: ${j?.errors?.[0]?.message ?? r.status}`);
  return j.data;
}

const str = (s: string) => JSON.stringify(s);

export async function linkCurtoShopee(cred: CredShopee, url: string, subId = 'ofertix', f: typeof fetch = fetch): Promise<string> {
  const d = await gql(cred, `mutation{generateShortLink(input:{originUrl:${str(url)},subIds:[${str(subId)}]}){shortLink}}`, f);
  const link = d?.generateShortLink?.shortLink;
  if (typeof link !== 'string' || !link) throw new Error('Shopee não devolveu o link curto');
  return link;
}

export interface ProdutoShopee { titulo: string; imagem: string; precoDe: number | null; precoPor: number | null; comissaoPct: number | null }

const centavos = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

export async function produtoShopee(cred: CredShopee, shopId: string, itemId: string, f: typeof fetch = fetch): Promise<ProdutoShopee | null> {
  const d = await gql(cred,
    `{productOfferV2(shopId:${Number(shopId)},itemId:${Number(itemId)},limit:1){nodes{productName imageUrl priceMin priceMax priceDiscountRate commissionRate}}}`, f);
  const n = d?.productOfferV2?.nodes?.[0];
  if (!n) return null;
  const por = centavos(n.priceMin);
  const desc = Number(n.priceDiscountRate) || 0;
  const de = por && desc > 0 && desc < 100 ? Math.round(por / (1 - desc / 100)) : null;
  const com = Number(n.commissionRate);
  return {
    titulo: String(n.productName ?? '').slice(0, 200),
    imagem: String(n.imageUrl ?? ''),
    precoDe: de, precoPor: por,
    comissaoPct: Number.isFinite(com) ? Math.round((com <= 1 ? com * 100 : com) * 10) / 10 : null,
  };
}

/** Nota e vendas do produto, numa consulta à parte: se os nomes dos campos mudarem, o resto da oferta não é afetado. */
export async function avaliacaoShopee(cred: CredShopee, shopId: string, itemId: string, f: typeof fetch = fetch): Promise<{ nota: number | null; vendas: number | null } | null> {
  const d = await gql(cred, `{productOfferV2(shopId:${Number(shopId)},itemId:${Number(itemId)},limit:1){nodes{ratingStar sales}}}`, f);
  const n = d?.productOfferV2?.nodes?.[0];
  if (!n) return null;
  const nota = Number(n.ratingStar), vendas = Number(n.sales);
  return { nota: Number.isFinite(nota) && nota > 0 ? Math.round(nota * 10) / 10 : null, vendas: Number.isFinite(vendas) && vendas >= 0 ? Math.round(vendas) : null };
}

export interface ItemComissao { pedido: string; produto: string; valor: number; comissao: number; status: 'pendente' | 'concluido' | 'cancelado'; em: number }

export function statusShopee(s: string): ItemComissao['status'] {
  const v = s.toUpperCase();
  if (v.includes('CANCEL') || v.includes('INVALID') || v.includes('UNPAID')) return 'cancelado';
  if (v.includes('COMPLETE') || v.includes('PAID') || v.includes('SETTLED')) return 'concluido';
  return 'pendente';
}

/** Relatório de conversões entre dois instantes (segundos). Pagina pelo scrollId. */
export async function comissoesShopee(cred: CredShopee, inicio: number, fim: number, f: typeof fetch = fetch): Promise<ItemComissao[]> {
  const itens: ItemComissao[] = [];
  let scroll = '';
  for (let pagina = 0; pagina < 50; pagina++) {
    const d = await gql(cred,
      `{conversionReport(purchaseTimeStart:${inicio},purchaseTimeEnd:${fim},limit:500${scroll ? `,scrollId:${str(scroll)}` : ''})` +
      `{nodes{purchaseTime orders{orderId orderStatus items{itemName actualAmount itemTotalCommission}}} pageInfo{hasNextPage scrollId}}}`, f);
    const rel = d?.conversionReport;
    for (const n of rel?.nodes ?? []) {
      for (const o of n.orders ?? []) {
        for (const it of o.items ?? []) {
          itens.push({
            pedido: String(o.orderId), produto: String(it.itemName ?? '').slice(0, 200),
            valor: centavos(it.actualAmount) ?? 0, comissao: centavos(it.itemTotalCommission) ?? 0,
            status: statusShopee(String(o.orderStatus ?? '')), em: Number(n.purchaseTime) * 1000,
          });
        }
      }
    }
    if (!rel?.pageInfo?.hasNextPage || !rel.pageInfo.scrollId) break;
    scroll = rel.pageInfo.scrollId;
  }
  return itens;
}

export interface ItemBusca {
  itemId: string; shopId: string; titulo: string; imagem: string; link: string; linkAfiliado: string;
  precoDe: number | null; precoPor: number | null; comissaoPct: number | null; nota: number | null; vendas: number | null;
}

/** Ordens da busca: 1 relevância, 2 mais vendidos, 4 menor preço, 5 maior comissão. */
export const ORDENS_SHOPEE: Record<string, number> = { relevancia: 1, vendidos: 2, preco: 4, comissao: 5 };

/** Busca produtos por palavra na Open API. Se a nota e as vendas não vierem (campos mudaram), tenta sem elas. */
export async function buscarProdutosShopee(cred: CredShopee, termo: string, ordem = 'vendidos', pagina = 1, limite = 20, f: typeof fetch = fetch): Promise<{ itens: ItemBusca[]; temMais: boolean }> {
  const base = `keyword:${str(termo.slice(0, 80))},sortType:${ORDENS_SHOPEE[ordem] ?? 2},page:${Math.max(1, Math.floor(pagina))},limit:${Math.min(50, Math.max(1, limite))}`;
  const campos = 'itemId shopId productName imageUrl priceMin priceDiscountRate commissionRate productLink offerLink';
  let d: any;
  try { d = await gql(cred, `{productOfferV2(${base}){nodes{${campos} ratingStar sales} pageInfo{hasNextPage}}}`, f); }
  catch { d = await gql(cred, `{productOfferV2(${base}){nodes{${campos}} pageInfo{hasNextPage}}}`, f); }
  const nodes = d?.productOfferV2?.nodes ?? [];
  const itens = nodes.map((n: any): ItemBusca => {
    const por = centavos(n.priceMin);
    const desc = Number(n.priceDiscountRate) || 0;
    const com = Number(n.commissionRate), nota = Number(n.ratingStar), vendas = Number(n.sales);
    return {
      itemId: String(n.itemId ?? ''), shopId: String(n.shopId ?? ''), titulo: String(n.productName ?? '').slice(0, 200), imagem: String(n.imageUrl ?? ''),
      link: String(n.productLink ?? (n.shopId && n.itemId ? `https://shopee.com.br/product/${n.shopId}/${n.itemId}` : '')).split('?')[0],
      linkAfiliado: String(n.offerLink ?? ''),
      precoDe: por && desc > 0 && desc < 100 ? Math.round(por / (1 - desc / 100)) : null, precoPor: por,
      comissaoPct: Number.isFinite(com) && com > 0 ? Math.round((com <= 1 ? com * 100 : com) * 10) / 10 : null,
      nota: Number.isFinite(nota) && nota > 0 ? Math.round(nota * 10) / 10 : null,
      vendas: Number.isFinite(vendas) && vendas >= 0 && n.sales != null ? Math.round(vendas) : null,
    };
  }).filter((x: ItemBusca) => x.titulo && x.link);
  return { itens, temMais: !!d?.productOfferV2?.pageInfo?.hasNextPage };
}
