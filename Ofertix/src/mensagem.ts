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
  /** Loja que não deixa mostrar preço (Amazon): a linha de preço e o desconto saem da mensagem. */
  semPreco?: boolean;
}
const SEM_PRECO = '\u0000sem-preco\u0000';

/** Sexta-feira da Black Friday (a sexta depois da 4ª quinta de novembro), no fuso do servidor. */
export function diaBlackFriday(ano: number) { const d = new Date(ano, 10, 1); d.setDate(1 + ((4 - d.getDay() + 7) % 7) + 21 + 1); return d; }

/** Contagem para a Black Friday: "· faltam 15 dias", "· é amanhã!", "· é HOJE!", "· últimos dias" ou vazio fora da época. */
export function contagemBlackFriday(agora = Date.now()): string {
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  for (const ano of [hoje.getFullYear() - 1, hoje.getFullYear()]) {
    const dias = Math.round((diaBlackFriday(ano).getTime() - hoje.getTime()) / 86_400_000);
    if (dias > 1 && dias <= 30) return `· faltam ${dias} dias`;
    if (dias === 1) return '· é amanhã!';
    if (dias === 0) return '· é HOJE!';
    if (dias < 0 && dias >= -3) return '· últimos dias';
  }
  return '';
}

export function montarMensagem(d: DadosMensagem, modelo = '', agora = Date.now()): string {
  const pct = descontoPct(d.precoDe, d.precoPor);
  const campos: Record<string, string> = {
    titulo: d.titulo || 'Oferta',
    de: d.precoDe && pct > 0 && !d.semPreco ? `De ~${reais(d.precoDe)}~\n` : '',
    por: d.semPreco ? SEM_PRECO : d.precoPor ? reais(d.precoPor) : 'preço no link',
    desconto: pct > 0 && !d.semPreco ? `(${pct}% OFF)` : '',
    cupom: d.cupom ? `🎟️ Cupom: *${d.cupom}*\n` : '',
    link: d.link,
    loja: d.plataforma ?? '',
    contagem: contagemBlackFriday(agora),
  };
  let texto = (modelo.trim() || MODELO_PADRAO).replace(/\{(\w+)\}/g, (m, k) => (k in campos ? campos[k] : m));
  if (d.semPreco) texto = texto.split('\n').filter((l) => !l.includes(SEM_PRECO)).join('\n');
  // Sem linhas em branco repetidas quando um campo fica vazio.
  return texto.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
