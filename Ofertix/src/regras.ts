// Regras das lojas que mudam o que o Ofertix manda (6.4).
//
// Amazon (Programa de Associados Brasil, Políticas do Programa e Contrato Operacional):
//  - encurtador que não deixa claro que leva à Amazon é proibido, e compra que passa por um site intermediário
//    que redireciona sozinho pode não ser comissionada → link da Amazon sai direto, sem o link curto /r/;
//  - preço só pode aparecer se vier da API de Divulgação de Produtos, com data e hora → oferta da Amazon sai sem preço;
//  - imagens do conteúdo da Amazon não podem ser guardadas → oferta da Amazon sai sem foto (o WhatsApp mostra a prévia da própria Amazon);
//  - aviso obrigatório: "Como participante do Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas".
//
// Mercado Livre: o link oficial sai do Gerador de links do painel de afiliados. Ao trocar o link de outra pessoa,
// todos os parâmetros de rastreio dela saem antes de entrar os da conta.

export const AVISO_AMAZON = '_Como participante do Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas._';

/** Acrescenta o aviso da Amazon no fim, uma vez só. */
export function comAvisoAmazon(texto: string): string {
  const t = String(texto ?? '').trimEnd();
  return t.includes('Programa de Associados da Amazon') ? t : `${t}\n\n${AVISO_AMAZON}`;
}

/** Tira as linhas com preço ou desconto (para mensagens com link da Amazon). Se a linha também tem link, fica só o link. */
export function tirarPrecos(texto: string): string {
  const PRECO = /R\$\s*~?\s*\d|\d+\s*%\s*(off|de\s+desconto|mais\s+barato)|\bpor\s+apenas\b|\bmenor\s+pre[çc]o\b/i;
  return String(texto ?? '').split('\n').flatMap((l) => {
    if (!PRECO.test(l)) return [l];
    const links = l.match(/https?:\/\/[^\s<>"'`]+/gi);
    return links ? [links.join(' ')] : [];
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Mensagem com link da Amazon: sem preço e com o aviso obrigatório. */
export const ajustarAmazon = (texto: string) => comAvisoAmazon(tirarPrecos(texto));

// Parâmetros de afiliado e de rastreio da Amazon que identificam outra pessoa.
const AMAZON_RASTREIO = ['tag', 'linkCode', 'linkId', 'ascsubtag', 'creative', 'creativeASIN', 'camp', 'ref_', 'th', 'psc', 'smid', 'pd_rd_r', 'pd_rd_w', 'pd_rd_wg', 'pf_rd_p', 'pf_rd_r', 'content-id', 'qid', 'sr', 'sprefix', 'crid', 'keywords', 'dib', 'dib_tag'];
export function limparAmazon(url: string): string {
  const u = new URL(url);
  for (const k of AMAZON_RASTREIO) u.searchParams.delete(k);
  return u.toString();
}

// Mercado Livre: parâmetros do programa de afiliados (matt_*), de campanha e de rastreio.
const ML_RASTREIO = /^(matt_.*|tracking_id|utm_.*|c_.*|ref|reco_.*|sid|source|forceInApp|deal_print_id|sp_.*|ag_.*|aff_.*)$/i;
export function limparRastreioML(url: string): string {
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()]) if (ML_RASTREIO.test(k)) u.searchParams.delete(k);
  u.hash = u.hash.replace(/(^#|&)(tracking_id|matt_[^=&]*|reco_[^=&]*|c_[^=&]*)=[^&]*/gi, '$1').replace(/^#&+|&+$/g, '').replace(/^#$/, '');
  return u.toString();
}
