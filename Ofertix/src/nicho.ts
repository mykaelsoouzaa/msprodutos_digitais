// Recursos de nicho (v3): categorias, regras de curadoria, coleções por dia da semana,
// modelos de mensagem prontos e rodapé de afiliado. Tudo fica num JSON em config_conta.nicho.

export interface Categoria { id: string; nome: string; emoji: string; palavras: string[] }

// A ordem importa: a primeira categoria cujas palavras aparecem no título vence.
export const CATEGORIAS: Categoria[] = [
  { id: 'infantil', nome: 'Infantil e bebê', emoji: '🧸', palavras: ['bebe', 'infantil', 'crianca', 'kids', 'menina', 'menino', 'fralda', 'mamadeira', 'chupeta', 'brinquedo', 'berco', 'maternidade'] },
  { id: 'organizacao', nome: 'Organização', emoji: '🗂️', palavras: ['organizador', 'organizadora', 'cabide', 'caixa organizadora', 'nicho', 'prateleira', 'porta treco', 'divisoria', 'sapateira', 'gaveteiro', 'etiqueta', 'cesto', 'suporte de parede'] },
  { id: 'beleza', nome: 'Beleza e autocuidado', emoji: '💄', palavras: ['skincare', 'serum', 'hidratante', 'maquiagem', 'batom', 'base liquida', 'rimel', 'mascara de cilios', 'perfume', 'shampoo', 'condicionador', 'creme', 'protetor solar', 'esmalte', 'unha', 'cabelo', 'escova secadora', 'chapinha', 'babyliss', 'pincel', 'facial', 'sabonete', 'body splash', 'depilador', 'cilios'] },
  { id: 'moda', nome: 'Moda e acessórios', emoji: '👗', palavras: ['vestido', 'blusa', 'cropped', 'saia', 'calca', 'short', 'jaqueta', 'casaco', 'biquini', 'lingerie', 'sutia', 'calcinha', 'pijama', 'tenis', 'sandalia', 'rasteira', 'bolsa', 'carteira', 'brinco', 'colar', 'pulseira', 'anel', 'oculos', 'relogio feminino', 'legging', 'meia'] },
  { id: 'cozinha', nome: 'Cozinha', emoji: '🍳', palavras: ['panela', 'frigideira', 'air fryer', 'airfryer', 'liquidificador', 'cafeteira', 'garrafa termica', 'pote', 'potes', 'talher', 'faca', 'tabua', 'forma', 'assadeira', 'mixer', 'batedeira', 'pipoqueira', 'chaleira', 'escorredor', 'copo', 'xicara', 'prato', 'cozinha'] },
  { id: 'casa', nome: 'Casa e decoração', emoji: '🏠', palavras: ['tapete', 'cortina', 'almofada', 'lencol', 'edredom', 'toalha', 'luminaria', 'abajur', 'vela', 'difusor', 'aromatizador', 'quadro', 'espelho', 'vaso', 'mop', 'vassoura', 'limpeza', 'aspirador', 'banheiro', 'decoracao', 'jogo de cama', 'travesseiro'] },
  { id: 'eletronicos', nome: 'Eletrônicos', emoji: '🎧', palavras: ['fone', 'bluetooth', 'smartwatch', 'carregador', 'cabo usb', 'power bank', 'caixa de som', 'celular', 'tablet', 'notebook', 'mouse', 'teclado', 'alexa', 'echo', 'kindle', 'camera', 'ring light', 'tripe', 'smart'] },
  { id: 'outros', nome: 'Outros', emoji: '🛍️', palavras: [] },
];
export const ID_CATEGORIAS = new Set(CATEGORIAS.map((c) => c.id));
export const nomeCategoria = (id: string) => CATEGORIAS.find((c) => c.id === id)?.nome ?? 'Outros';

const normalizar = (t: string) => ` ${String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ')} `;

/** Categoria pelo título do produto: a primeira com uma palavra-chave presente, ou "outros". */
export function classificar(titulo: string): string {
  const t = normalizar(titulo);
  for (const c of CATEGORIAS) if (c.palavras.some((p) => t.includes(` ${p} `) || t.includes(` ${p}s `))) return c.id;
  return 'outros';
}

export interface Regras {
  categorias: string[];      // vazio = todas
  incluir: string[];         // vazio = sem exigência; se houver, o título precisa ter ao menos uma
  excluir: string[];         // o título não pode ter nenhuma
  precoMax: number;          // centavos; 0 = sem limite
  notaMin: number;           // 0 = sem exigência (só confere quando a loja informa)
  vendasMin: number;         // 0 = sem exigência (idem)
}
export interface Nicho {
  regras: Regras;
  colecoes: string[];        // 7 posições (domingo = 0), id da categoria ou '' para qualquer uma
  rodape: string;            // acrescentado ao fim de cada oferta; vazio = sem rodapé
  pacote: string;            // nome do pacote aplicado por último, só para mostrar
}

export const NICHO_VAZIO: Nicho = {
  regras: { categorias: [], incluir: [], excluir: [], precoMax: 0, notaMin: 0, vendasMin: 0 },
  colecoes: ['', '', '', '', '', '', ''], rodape: '', pacote: '',
};

const lista = (v: unknown, max = 30) => (Array.isArray(v) ? v : String(v ?? '').split(','))
  .map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, max).map((x) => x.slice(0, 40));
const numero = (v: unknown, min: number, max: number) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0; };

/** Valida o que veio do formulário (ou do banco) e devolve um nicho completo. */
export function limparNicho(b: any): Nicho {
  const r = b?.regras ?? {};
  const cats = lista(r.categorias, 10).filter((c) => ID_CATEGORIAS.has(c));
  const col = Array.from({ length: 7 }, (_, i) => { const v = String(b?.colecoes?.[i] ?? ''); return ID_CATEGORIAS.has(v) ? v : ''; });
  return {
    regras: {
      categorias: cats, incluir: lista(r.incluir), excluir: lista(r.excluir),
      precoMax: Math.round(numero(r.precoMax, 0, 10_000_000)), notaMin: Math.round(numero(r.notaMin, 0, 5) * 10) / 10,
      vendasMin: Math.round(numero(r.vendasMin, 0, 10_000_000)),
    },
    colecoes: col, rodape: String(b?.rodape ?? '').trim().slice(0, 200), pacote: String(b?.pacote ?? '').slice(0, 40),
  };
}

export function lerNicho(json: string): Nicho {
  try { return json ? limparNicho(JSON.parse(json)) : structuredClone(NICHO_VAZIO); } catch { return structuredClone(NICHO_VAZIO); }
}

export interface Candidata { titulo: string; categoria?: string; precoPor: number | null; nota?: number | null; vendas?: number | null }

/** Motivo para a oferta ficar de fora do nicho, ou null se ela passa. */
export function motivoRecusa(r: Regras, o: Candidata): string | null {
  const cat = o.categoria || classificar(o.titulo);
  const t = normalizar(o.titulo);
  if (r.categorias.length && !r.categorias.includes(cat)) return `Categoria fora do nicho (${nomeCategoria(cat)})`;
  if (r.incluir.length && !r.incluir.some((p) => t.includes(normalizar(p)))) return 'Não tem nenhuma das palavras exigidas';
  const ruim = r.excluir.find((p) => t.includes(normalizar(p)));
  if (ruim) return `Tem uma palavra bloqueada (${ruim})`;
  if (r.precoMax && o.precoPor != null && o.precoPor > r.precoMax) return 'Preço acima do limite';
  if (r.notaMin && o.nota != null && o.nota < r.notaMin) return `Nota ${String(o.nota).replace('.', ',')} abaixo da mínima`;
  if (r.vendasMin && o.vendas != null && o.vendas < r.vendasMin) return 'Poucas vendas';
  return null;
}

/** Categoria da coleção do dia (domingo = 0) ou '' quando o dia não tem coleção. */
export const colecaoDoDia = (n: Nicho, ms: number) => n.colecoes[new Date(ms).getDay()] ?? '';

export const rodapeAfiliado = (texto: string, rodape: string) => (rodape ? `${texto}\n\n${rodape}` : texto);

// Modelos de mensagem prontos. {a|b|c} são variações sorteadas por grupo.
export const MODELOS: { id: string; nome: string; texto: string }[] = [
  { id: 'padrao', nome: 'Padrão (promoção)', texto: '' },
  {
    id: 'achadinhos', nome: 'Achadinhos (tom de amiga)',
    texto: `{✨|💛|🛍️} *{titulo}*

{Achei e precisava te mostrar|Olha que achadinho|Esse vale a pena, viu}!
{de}Por *{por}* {desconto}
{cupom}
👉 {link}`,
  },
  {
    id: 'relampago', nome: 'Relâmpago (urgência)',
    texto: `{⚡|🚨|⏰} *CORRE: {titulo}*

{de}Só *{por}* {desconto}
{cupom}
{Pode acabar a qualquer momento|Estoque limitado|Preço de hoje}: {link}`,
  },
  {
    id: 'vale-a-pena', nome: 'Vale a pena? (indicação)',
    texto: `{💡|⭐|✅} *Vale a pena?* {titulo}

{Testado e aprovado por quem comprou|Bem avaliado por quem já comprou|Um dos mais elogiados da loja}.
{de}Por *{por}* {desconto}
{cupom}
🛒 {link}`,
  },
];

export const RODAPE_PADRAO = '_Link de afiliado: você paga o mesmo preço e ajuda o grupo a continuar._';

/** Pacote pronto para grupos de achadinhos femininos: casa, cozinha, organização, beleza e moda até R$ 50. */
export const PACOTE_ACHADINHOS = {
  nicho: limparNicho({
    pacote: 'Achadinhos femininos',
    regras: { categorias: ['casa', 'cozinha', 'organizacao', 'beleza', 'moda'], incluir: [], excluir: ['replica', 'similar', 'usado', 'masculino'], precoMax: 5000, notaMin: 4.7, vendasMin: 100 },
    //         dom       seg            ter       qua        qui       sex     sáb
    colecoes: ['', 'organizacao', 'beleza', 'cozinha', 'beleza', 'moda', 'casa'],
    rodape: RODAPE_PADRAO,
  }),
  modelo: MODELOS.find((m) => m.id === 'achadinhos')!.texto,
  horarios: '09:00, 12:00, 15:00, 19:00, 21:00',
};
