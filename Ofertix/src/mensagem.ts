// Monta o texto da oferta para o WhatsApp a partir de um modelo com campos entre chaves.
// {a|b|c} são variações: cada grupo recebe uma delas, sorteada na hora do envio.
export const MODELO_PADRAO = `{🔥|⚡|🚨|😱} *{titulo}*

{de}Por *{por}* {desconto}
{cupom}
🛒 {Compre aqui|Link da oferta|Garanta o seu}: {link}`;

const VARIACAO = /\{([^{}\n]*\|[^{}\n]*)\}/g;

/** Sorteia uma opção de cada {a|b|c}. Com primeira = true, usa sempre a primeira (prévia). */
export function expandirVariacoes(texto: string, primeira = false, sorteio = Math.random): string {
  return texto.replace(VARIACAO, (_m, opcoes: string) => {
    const lista = opcoes.split('|');
    return lista[primeira ? 0 : Math.floor(sorteio() * lista.length)] ?? '';
  });
}

export const temVariacoes = (texto: string) => new RegExp(VARIACAO.source).test(texto);

export const reais = (c: number | null | undefined) =>
  c == null ? '' : 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const descontoPct = (de: number | null | undefined, por: number | null | undefined) =>
  de && por && de > por ? Math.round((1 - por / de) * 100) : 0;

export interface DadosMensagem {
  titulo: string; precoDe?: number | null; precoPor?: number | null; link: string; plataforma?: string; cupom?: string;
}

export function montarMensagem(d: DadosMensagem, modelo = ''): string {
  const pct = descontoPct(d.precoDe, d.precoPor);
  const campos: Record<string, string> = {
    titulo: d.titulo || 'Oferta',
    de: d.precoDe && pct > 0 ? `De ~${reais(d.precoDe)}~\n` : '',
    por: d.precoPor ? reais(d.precoPor) : 'preço no link',
    desconto: pct > 0 ? `(${pct}% OFF)` : '',
    cupom: d.cupom ? `🎟️ Cupom: *${d.cupom}*\n` : '',
    link: d.link,
    loja: d.plataforma ?? '',
  };
  const texto = (modelo.trim() || MODELO_PADRAO).replace(/\{(\w+)\}/g, (m, k) => (k in campos ? campos[k] : m));
  // Sem linhas em branco repetidas quando um campo fica vazio.
  return texto.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
