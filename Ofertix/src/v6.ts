// Novidades da v6: busca de produtos na Shopee, vitrine abastecida sozinha, enquetes, lista do dia,
// respostas automáticas no privado, "enviar de novo", próximas datas do varejo e visitas da página de vendas.
import { type DB } from './db.ts';
import { type Ctx, ErroUso, agendar, config, salvarOferta, alternarVitrine, lerHorarios, nichoDa, ROBO } from './servico.ts';
import { buscarProdutosShopee, linkCurtoShopee, type ItemBusca } from './shopee.ts';
import { CATEGORIAS, classificar, colecaoDoDia, motivoRecusa } from './nicho.ts';
import { pausada } from './extras.ts';
import { expandirVariacoes, reais } from './mensagem.ts';
import { comAvisoAmazon } from './regras.ts';

const DIA = 86_400_000;
const t = (c: Ctx) => (c.agora ?? Date.now)();
const diaLocal = (ms: number) => { const d = new Date(ms); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const normalizar = (s: string) => ` ${String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
const jsonOu = <T>(txt: string, padrao: T): T => { try { return txt ? { ...padrao, ...JSON.parse(txt) } : padrao; } catch { return padrao; } };
/** Horário do dia (HH:MM) já passou há no máximo `folga` minutos? Evita disparar com o servidor voltando horas depois. */
function naHora(agora: number, hora: string, folgaMin: number) {
  const [h, m] = hora.split(':').map(Number);
  const marcado = new Date(agora); marcado.setHours(h!, m!, 0, 0);
  return agora >= marcado.getTime() && agora - marcado.getTime() <= folgaMin * 60_000;
}

// ---------------- 1. Busca de produtos na Shopee ----------------

const credDe = (db: DB, conta: number) => { const k = config(db, conta); return { appId: String(k.shopee_app_id ?? ''), segredo: String(k.shopee_segredo ?? '') }; };

// Catálogo fictício para a demonstração (sem credenciais da Shopee).
const CATALOGO_DEMO: [string, string, number, number, number, number, number][] = [
  ['Kit 6 Potes Herméticos de Vidro com Tampa', '🫙', 8990, 4490, 4.9, 12800, 12],
  ['Organizador de Maquiagem Giratório 360°', '💄', 6990, 3490, 4.8, 9400, 10],
  ['Sérum Facial Vitamina C 30ml', '✨', 5990, 2790, 4.8, 21000, 14],
  ['Escova Secadora 3 em 1 Íons', '💇‍♀️', 18990, 9990, 4.7, 6300, 8],
  ['Kit 10 Cabides de Veludo Antideslizante', '👗', 4990, 2290, 4.9, 30500, 11],
  ['Garrafa Térmica Inox 1L com Infusor', '🧉', 7990, 3990, 4.8, 15200, 9],
  ['Tapete Antiderrapante para Banheiro', '🛁', 5990, 2990, 4.7, 8800, 13],
  ['Mini Processador Elétrico de Alimentos', '🧄', 6990, 3290, 4.6, 11900, 10],
  ['Bolsa Transversal Feminina Matelassê', '👜', 12990, 5990, 4.8, 4100, 12],
  ['Luminária de Mesa LED Recarregável', '💡', 8990, 4290, 4.7, 7600, 9],
  ['Organizador de Gaveta Colmeia 24 Nichos', '🗂️', 3990, 1890, 4.8, 19400, 13],
  ['Body Splash Frutas Vermelhas 200ml', '🍓', 4990, 2490, 4.9, 25000, 15],
  ['Conjunto Pijama Feminino Manga Curta', '🛌', 8990, 4790, 4.7, 5200, 11],
  ['Mop Giratório com Balde Centrífuga', '🧹', 11990, 6990, 4.8, 13400, 7],
  ['Brinco Argola Banhado a Ouro 18k', '💫', 5990, 1990, 4.6, 16700, 16],
  ['Fone Bluetooth com Estojo Carregador', '🎧', 9990, 4990, 4.5, 41000, 6],
];

function buscaDemo(termo: string): ItemBusca[] {
  const q = normalizar(termo).trim().split(' ').filter((p) => p.length > 2);
  const todos = CATALOGO_DEMO.map(([titulo, emoji, de, por, nota, vendas, com], i): ItemBusca => ({
    itemId: String(900 + i), shopId: '777', titulo, imagem: `emoji:${emoji}`, link: `https://shopee.com.br/product/777/${900 + i}`,
    linkAfiliado: `https://s.shopee.com.br/demo${900 + i}`, precoDe: de, precoPor: por, comissaoPct: com, nota, vendas,
  }));
  const achados = q.length ? todos.filter((x) => q.some((p) => normalizar(x.titulo).includes(p.slice(0, 5)))) : todos;
  return achados.length ? achados : todos;
}

export async function buscarShopee(c: Ctx, conta: number, termo: string, ordem = 'vendidos', pagina = 1) {
  termo = String(termo ?? '').trim();
  if (termo.length < 2) throw new ErroUso('Escreva o que você procura (ex.: organizador, sérum, air fryer)');
  const cred = credDe(c.db, conta);
  let r: { itens: ItemBusca[]; temMais: boolean };
  if (cred.appId && cred.segredo) r = await buscarProdutosShopee(cred, termo, ordem, pagina, 20, c.f);
  else if (c.demo) {
    const itens = buscaDemo(termo);
    if (ordem === 'comissao') itens.sort((a, b) => (b.comissaoPct ?? 0) - (a.comissaoPct ?? 0));
    else if (ordem === 'preco') itens.sort((a, b) => (a.precoPor ?? 0) - (b.precoPor ?? 0));
    else if (ordem === 'vendidos') itens.sort((a, b) => (b.vendas ?? 0) - (a.vendas ?? 0));
    r = { itens, temMais: false };
  } else throw new ErroUso('Cadastre o AppID e a Senha da Shopee em Configurações para buscar produtos');
  const regras = nichoDa(c.db, conta).regras;
  const itens = r.itens.map((x) => {
    const ja = c.db.prepare('SELECT id, vitrine FROM ofertas WHERE conta_id = ? AND url_original = ?').get(conta, x.link) as any;
    const categoria = classificar(x.titulo);
    return { ...x, categoria, motivo: motivoRecusa(regras, { titulo: x.titulo, categoria, precoPor: x.precoPor, nota: x.nota, vendas: x.vendas }), ja: ja ? { id: Number(ja.id), vitrine: !!ja.vitrine } : null };
  });
  return { itens, temMais: r.temMais, pagina };
}

/** Item da busca vira oferta (com link de afiliado). O link precisa ser da Shopee. */
export async function adicionarDaBusca(c: Ctx, conta: number, item: any, vitrine = false): Promise<number> {
  const link = String(item?.link ?? '').split('?')[0];
  if (!/^https:\/\/(www\.)?shopee\.com\.br\//.test(link)) throw new ErroUso('Produto inválido');
  let afiliado = String(item?.linkAfiliado ?? '');
  if (!/^https:\/\/(s\.shopee\.com\.br|shope\.ee)\//.test(afiliado)) {
    const cred = credDe(c.db, conta);
    if (!cred.appId || !cred.segredo) throw new ErroUso('Cadastre o AppID e a Senha da Shopee em Configurações');
    afiliado = await linkCurtoShopee(cred, link, 'ofertix', c.f);
  }
  const cent = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  const img = String(item?.imagem ?? '');
  const id = salvarOferta(c, conta, {
    plataforma: 'shopee', urlOriginal: link, urlAfiliado: afiliado, titulo: String(item?.titulo ?? '').slice(0, 200),
    imagem: /^https:\/\//.test(img) || (c.demo && img.startsWith('emoji:')) ? img.slice(0, 500) : '',
    precoDe: cent(item?.precoDe), precoPor: cent(item?.precoPor), comissaoPct: Number.isFinite(Number(item?.comissaoPct)) ? Number(item.comissaoPct) : null,
    nota: Number.isFinite(Number(item?.nota)) && item?.nota != null ? Number(item.nota) : null, vendas: Number.isFinite(Number(item?.vendas)) && item?.vendas != null ? Number(item.vendas) : null,
  }, 'busca');
  if (vitrine) alternarVitrine(c.db, conta, id, true);
  return id;
}

// ---------------- 2. Vitrine abastecida sozinha ----------------

export interface Abastecer { ativo: boolean; palavras: string[]; quantidade: number; hora: string; ordem: string; colecao: boolean }
export const ABASTECER_PADRAO: Abastecer = { ativo: false, palavras: [], quantidade: 5, hora: '07:30', ordem: 'vendidos', colecao: true };

export function lerAbastecer(db: DB, conta: number): Abastecer { return jsonOu(String(config(db, conta)?.abastecer ?? ''), ABASTECER_PADRAO); }
export function salvarAbastecer(db: DB, conta: number, b: any): Abastecer {
  const a: Abastecer = {
    ativo: !!b?.ativo,
    palavras: (Array.isArray(b?.palavras) ? b.palavras : String(b?.palavras ?? '').split(',')).map((p: unknown) => String(p).trim().slice(0, 40)).filter(Boolean).slice(0, 10),
    quantidade: Math.min(20, Math.max(1, Math.round(Number(b?.quantidade) || 5))),
    hora: lerHorarios(String(b?.hora ?? ''))[0] ?? '07:30',
    ordem: ['vendidos', 'comissao', 'relevancia'].includes(String(b?.ordem)) ? String(b.ordem) : 'vendidos',
    colecao: b?.colecao !== false,
  };
  if (a.ativo && !a.palavras.length && !a.colecao) throw new ErroUso('Escreva ao menos uma palavra para buscar, ou use a coleção do dia');
  db.prepare('UPDATE config_conta SET abastecer = ? WHERE conta_id = ?').run(JSON.stringify(a), conta);
  return a;
}

/** Termos de busca do dia: as palavras escolhidas e, se ligado, palavras da coleção do dia (ex.: terça = beleza). */
export function termosDoDia(db: DB, conta: number, a: Abastecer, agora: number): string[] {
  const termos = [...a.palavras];
  const col = a.colecao ? colecaoDoDia(nichoDa(db, conta), agora) : '';
  const cat = CATEGORIAS.find((x) => x.id === col);
  if (cat?.palavras.length) {
    // Três palavras da categoria, que mudam a cada dia, para variar os produtos.
    const dia = Math.floor(agora / DIA);
    for (let i = 0; i < 3; i++) termos.push(cat.palavras[(dia * 3 + i) % cat.palavras.length]!);
  }
  return [...new Set(termos)].slice(0, 6);
}

/** Busca, filtra pelo nicho, tira o que já existe e põe as melhores na vitrine. */
export async function abastecerAgora(c: Ctx, conta: number): Promise<{ adicionadas: string[]; termos: string[] }> {
  const a = lerAbastecer(c.db, conta);
  const termos = termosDoDia(c.db, conta, a, t(c));
  if (!termos.length) throw new ErroUso('Escreva ao menos uma palavra para buscar, ou escolha as coleções da semana em Nicho');
  const listas: any[][] = [];
  for (const termo of termos) {
    try { listas.push((await buscarShopee(c, conta, termo, a.ordem)).itens.filter((x) => !x.ja && !x.motivo)); }
    catch (e) { if (e instanceof ErroUso) throw e; listas.push([]); }
  }
  // Intercala os termos para não encher a vitrine de um produto só.
  const escolhidos: any[] = [], vistos = new Set<string>();
  for (let i = 0; escolhidos.length < a.quantidade && listas.some((l) => l.length > i); i++) {
    for (const l of listas) {
      const x = l[i];
      if (x && !vistos.has(x.link) && escolhidos.length < a.quantidade) { vistos.add(x.link); escolhidos.push(x); }
    }
  }
  const adicionadas: string[] = [];
  for (const x of escolhidos) {
    try { await adicionarDaBusca(c, conta, x, true); adicionadas.push(x.titulo); } catch { /* segue com os outros */ }
  }
  return { adicionadas, termos };
}

export async function rodarAbastecer(c: Ctx): Promise<number> {
  let total = 0;
  const hoje = diaLocal(t(c));
  for (const k of c.db.prepare("SELECT conta_id, abastecer, ultimo_abastecer FROM config_conta WHERE abastecer LIKE '%\"ativo\":true%'").all() as any[]) {
    const a = jsonOu(String(k.abastecer), ABASTECER_PADRAO);
    if (k.ultimo_abastecer === hoje || !naHora(t(c), a.hora, 120)) continue;
    c.db.prepare('UPDATE config_conta SET ultimo_abastecer = ? WHERE conta_id = ?').run(hoje, k.conta_id);
    try { total += (await abastecerAgora(c, Number(k.conta_id))).adicionadas.length; } catch (e) { console.error('abastecer', k.conta_id, (e as Error).message); }
  }
  return total;
}

// ---------------- 3. Enquetes ----------------

export function criarEnquete(c: Ctx, conta: number, b: any): number {
  const pergunta = String(b?.pergunta ?? '').trim();
  if (pergunta.length < 3) throw new ErroUso('Escreva a pergunta da enquete');
  if (pergunta.length > 255) throw new ErroUso('Pergunta muito longa (até 255 letras)');
  const opcoes = [...new Set((Array.isArray(b?.opcoes) ? b.opcoes : String(b?.opcoes ?? '').split('\n')).map((o: unknown) => String(o).trim()).filter(Boolean))] as string[];
  if (opcoes.length < 2) throw new ErroUso('A enquete precisa de pelo menos 2 opções');
  if (opcoes.length > 12) throw new ErroUso('Use no máximo 12 opções');
  if (opcoes.some((o) => o.length > 100)) throw new ErroUso('Cada opção pode ter até 100 letras');
  const id = agendar(c, conta, { texto: pergunta, quando: b?.quando, grupos: Array.isArray(b?.grupos) ? b.grupos : 'todos', origem: 'enquete' });
  c.db.prepare('UPDATE agendamentos SET enquete = ? WHERE id = ?').run(JSON.stringify({ opcoes, multipla: !!b?.multipla }), id);
  return id;
}

// ---------------- 4. Lista do dia ----------------

export interface ListaDia { ativo: boolean; hora: string; quantas: number; titulo: string }
export const LISTA_PADRAO: ListaDia = { ativo: false, hora: '21:30', quantas: 5, titulo: '🛍️ *Os achadinhos de hoje*' };
export const lerListaDia = (db: DB, conta: number): ListaDia => jsonOu(String(config(db, conta)?.lista_dia ?? ''), LISTA_PADRAO);
export function salvarListaDia(db: DB, conta: number, b: any): ListaDia {
  const l: ListaDia = {
    ativo: !!b?.ativo, hora: lerHorarios(String(b?.hora ?? ''))[0] ?? '21:30',
    quantas: Math.min(10, Math.max(3, Math.round(Number(b?.quantas) || 5))),
    titulo: String(b?.titulo ?? '').trim().slice(0, 120) || LISTA_PADRAO.titulo,
  };
  db.prepare('UPDATE config_conta SET lista_dia = ? WHERE conta_id = ?').run(JSON.stringify(l), conta);
  return l;
}

const curto = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** Uma mensagem com as ofertas que saíram hoje (as mais clicadas primeiro) e o link da vitrine. Vazio se saíram menos de 2. */
export function textoListaDia(c: Ctx, conta: number, l = lerListaDia(c.db, conta)): string {
  const ini = new Date(t(c)); ini.setHours(0, 0, 0, 0);
  const ofertas = c.db.prepare(`SELECT o.id, o.titulo, o.preco_por, o.url_afiliado, o.plataforma,
      (SELECT COUNT(*) FROM links k JOIN cliques q ON q.codigo = k.codigo WHERE k.oferta_id = o.id AND q.em >= ?) AS cliques, MIN(a.quando) AS primeiro
    FROM ofertas o JOIN agendamentos a ON a.oferta_id = o.id
    WHERE o.conta_id = ? AND a.status IN ('enviado','enviando') AND a.quando >= ? AND o.esgotada = 0
    GROUP BY o.id ORDER BY cliques DESC, primeiro LIMIT ?`).all(ini.getTime(), conta, ini.getTime(), l.quantas) as any[];
  if (ofertas.length < 2) return '';
  const e = c.db.prepare('SELECT slug FROM entradas WHERE conta_id = ? AND ativo = 1 ORDER BY id LIMIT 1').get(conta) as any;
  const linhas = [l.titulo, '', `{Perdeu alguma?|Caso tenha perdido:|Para quem chegou agora:} ${ofertas.length === 1 ? 'a oferta' : `as ${ofertas.length} mais procuradas`} do dia 👇`, ''];
  ofertas.forEach((o, i) => {
    linhas.push(`${i + 1}. ${curto(o.titulo)}${o.preco_por && o.plataforma !== 'amazon' ? ` · *${reais(o.preco_por)}*` : ''}`);
    if (!e) linhas.push(`   ${o.url_afiliado}`);
  });
  if (e) linhas.push('', `👉 Todas na vitrine: ${c.urlPublica}/v/${e.slug}`);
  // Amazon na lista: aviso obrigatório do Programa de Associados (src/regras.ts).
  return ofertas.some((o) => o.plataforma === 'amazon') ? comAvisoAmazon(linhas.join('\n')) : linhas.join('\n');
}

export function rodarListaDia(c: Ctx): number {
  let feitas = 0;
  const hoje = diaLocal(t(c));
  for (const k of c.db.prepare("SELECT conta_id, lista_dia, ultima_lista FROM config_conta WHERE lista_dia LIKE '%\"ativo\":true%'").all() as any[]) {
    const l = jsonOu(String(k.lista_dia), LISTA_PADRAO);
    if (k.ultima_lista === hoje || !naHora(t(c), l.hora, 15) || pausada(c.db, k.conta_id)) continue;
    c.db.prepare('UPDATE config_conta SET ultima_lista = ? WHERE conta_id = ?').run(hoje, k.conta_id);
    const texto = textoListaDia(c, Number(k.conta_id), l);
    if (!texto) continue;
    try { agendar(c, Number(k.conta_id), { texto, origem: 'lista' }); feitas++; } catch { /* sem grupos de envio */ }
  }
  return feitas;
}

// ---------------- 5. Respostas automáticas no privado ----------------

const MAX_RESPOSTAS = 15, RESPOSTAS_DIA = 300, INTERVALO_MESMA = 12 * 3600_000;
const palavrasDe = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((p) => String(p).trim().toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 15);

export function listarRespostas(db: DB, conta: number) {
  return (db.prepare('SELECT * FROM respostas WHERE conta_id = ? ORDER BY id').all(conta) as any[]).map((r) => ({ ...r, palavras: String(r.palavras).split(',').filter(Boolean) }));
}
export function salvarResposta(db: DB, conta: number, b: any, id?: number): number {
  const palavras = palavrasDe(b?.palavras);
  if (!palavras.length) throw new ErroUso('Escreva ao menos uma palavra que dispara a resposta');
  const texto = String(b?.texto ?? '').trim().slice(0, 1500);
  if (!texto) throw new ErroUso('Escreva a resposta');
  if (id) {
    const r = db.prepare('UPDATE respostas SET palavras = ?, texto = ? WHERE id = ? AND conta_id = ?').run(palavras.join(','), texto, id, conta);
    if (!Number(r.changes)) throw new ErroUso('Resposta não encontrada', 404);
    return id;
  }
  if (Number((db.prepare('SELECT COUNT(*) AS n FROM respostas WHERE conta_id = ?').get(conta) as any).n) >= MAX_RESPOSTAS) throw new ErroUso(`Use no máximo ${MAX_RESPOSTAS} respostas`);
  return Number(db.prepare('INSERT INTO respostas (conta_id, palavras, texto, criado_em) VALUES (?, ?, ?, ?)').run(conta, palavras.join(','), texto, Date.now()).lastInsertRowid);
}

/** Resposta que combina com a mensagem (a primeira cadastrada que tiver uma das palavras). */
export function respostaPara(db: DB, conta: number, mensagem: string) {
  const m = normalizar(mensagem);
  if (m.trim().length < 2) return null;
  return (db.prepare('SELECT * FROM respostas WHERE conta_id = ? AND ativo = 1 ORDER BY id').all(conta) as any[])
    .find((r) => String(r.palavras).split(',').some((p) => p && m.includes(normalizar(p)))) ?? null;
}

/** Campos da resposta: {nome}, {link_grupos}, {vitrine} e {cupons}. */
export function montarResposta(c: Ctx, conta: number, texto: string, nome: string) {
  const e = c.db.prepare('SELECT slug FROM entradas WHERE conta_id = ? AND ativo = 1 ORDER BY id LIMIT 1').get(conta) as any;
  const cupons = (c.db.prepare('SELECT codigo, plataforma, descricao FROM cupons WHERE conta_id = ? AND ativo = 1 ORDER BY id DESC LIMIT 5').all(conta) as any[])
    .map((x) => `🎟️ *${x.codigo}*${x.descricao ? ` (${x.descricao})` : ''}`).join('\n');
  const primeiro = String(nome ?? '').trim().split(/\s+/)[0] ?? '';
  return expandirVariacoes(texto)
    .replace(/\{nome\}/g, primeiro)
    .replace(/\{link_grupos\}/g, e ? `${c.urlPublica}/g/${e.slug}` : '')
    .replace(/\{vitrine\}/g, e ? `${c.urlPublica}/v/${e.slug}` : '')
    .replace(/\{cupons\}/g, cupons || 'No momento não temos cupom ativo.')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function responderPrivado(c: Ctx, inst: { id: number; conta_id: number; chave: string }, jid: string, mensagem: string, nome = ''): Promise<boolean> {
  const conta = Number(inst.conta_id);
  if (pausada(c.db, conta)) return false;
  const r = respostaPara(c.db, conta, mensagem);
  if (!r) return false;
  const agora = t(c);
  if (c.db.prepare('SELECT 1 FROM respostas_envios WHERE resposta_id = ? AND contato = ? AND em > ?').get(r.id, jid, agora - INTERVALO_MESMA)) return false;
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  const n = Number((c.db.prepare('SELECT COUNT(*) AS n FROM respostas_envios e JOIN respostas r ON r.id = e.resposta_id WHERE r.conta_id = ? AND e.em >= ?').get(conta, hoje.getTime()) as any).n);
  if (n >= RESPOSTAS_DIA) return false;
  const texto = montarResposta(c, conta, r.texto, nome);
  if (!texto) return false;
  c.db.prepare('INSERT INTO respostas_envios (resposta_id, contato, em) VALUES (?, ?, ?)').run(r.id, jid, agora);
  c.db.prepare('UPDATE respostas SET usos = usos + 1 WHERE id = ?').run(r.id);
  c.db.prepare('DELETE FROM respostas_envios WHERE em < ?').run(agora - 7 * DIA);
  await c.wpp.enviar(inst.chave, jid, texto);
  return true;
}

export const RESPOSTAS_SUGERIDAS = [
  { palavras: 'grupo, grupos, entrar, link', texto: 'Oi, {nome}! 💖 Escolha o seu grupo de achadinhos aqui: {link_grupos}' },
  { palavras: 'cupom, cupons, desconto', texto: '{Oi|Olá}, {nome}! Os cupons que estão valendo agora:\n{cupons}' },
  { palavras: 'vitrine, ofertas, achadinhos', texto: 'Os achadinhos da semana estão todos aqui: {vitrine} ✨' },
];

// ---------------- 6. Enviar de novo ----------------

export function enviarDeNovo(c: Ctx, conta: number, id: number, quando?: number): number {
  const a = c.db.prepare('SELECT * FROM agendamentos WHERE id = ? AND conta_id = ?').get(id, conta) as any;
  if (!a) throw new ErroUso('Agendamento não encontrado', 404);
  const ids = JSON.parse(a.grupos);
  let grupos: number[] | 'todos' = 'todos';
  if (Array.isArray(ids)) {
    grupos = (c.db.prepare(`SELECT id FROM grupos WHERE conta_id = ? AND enviar = 1 AND id IN (${ids.map(() => '?').join(',') || 'NULL'})`).all(conta, ...ids) as any[]).map((g) => Number(g.id));
    if (!grupos.length) throw new ErroUso('Os grupos desse envio não estão mais com envio ligado');
  }
  const novo = agendar(c, conta, { ofertaId: a.oferta_id ?? undefined, texto: a.texto, imagem: a.imagem, quando, grupos, origem: a.origem === 'enquete' ? 'enquete' : 'repetido' });
  if (a.enquete) c.db.prepare('UPDATE agendamentos SET enquete = ? WHERE id = ?').run(a.enquete, novo);
  return novo;
}

// ---------------- 7. Próximas datas do varejo ----------------

const enesimoDomingo = (ano: number, mes: number, n: number) => { const d = new Date(ano, mes, 1); d.setDate(1 + ((7 - d.getDay()) % 7) + (n - 1) * 7); return d; };
function blackFriday(ano: number) { const d = new Date(ano, 10, 1); d.setDate(1 + ((4 - d.getDay() + 7) % 7) + 21 + 1); return d; } // sexta depois da 4ª quinta de novembro

function datasDoAno(ano: number) {
  const bf = blackFriday(ano);
  return [
    { nome: 'Dia do Consumidor', data: new Date(ano, 2, 15), dica: 'Semana do consumidor: cupons e frete grátis em várias lojas.' },
    { nome: 'Dia das Mães', data: enesimoDomingo(ano, 4, 2), dica: 'Comece 2 semanas antes com kits de beleza, bolsas e casa.' },
    { nome: 'Dia dos Namorados', data: new Date(ano, 5, 12), dica: 'Presentes até R$ 100 e kits para casal.' },
    { nome: 'Dia dos Pais', data: enesimoDomingo(ano, 7, 2), dica: 'Eletrônicos, relógios e churrasco.' },
    { nome: '9.9 da Shopee', data: new Date(ano, 8, 9), dica: 'Campanha com cupons e frete grátis na Shopee.' },
    { nome: 'Dia das Crianças', data: new Date(ano, 9, 12), dica: 'Brinquedos e roupas infantis: abra a coleção Infantil.' },
    { nome: '10.10 da Shopee', data: new Date(ano, 9, 10), dica: 'Campanha com cupons e frete grátis na Shopee.' },
    { nome: '11.11 da Shopee', data: new Date(ano, 10, 11), dica: 'Uma das maiores campanhas do ano na Shopee.' },
    { nome: 'Black Friday', data: bf, dica: 'Aumente os horários automáticos e prepare a vitrine na semana anterior.' },
    { nome: 'Cyber Monday', data: new Date(bf.getFullYear(), bf.getMonth(), bf.getDate() + 3), dica: 'Últimas ofertas da Black Friday, com foco em eletrônicos.' },
    { nome: '12.12 da Shopee', data: new Date(ano, 11, 12), dica: 'Campanha de fim de ano da Shopee.' },
    { nome: 'Natal', data: new Date(ano, 11, 25), dica: 'Presentes até R$ 50 e "chega antes do Natal" vendem bem.' },
  ];
}

export function proximasDatas(agora: number, quantas = 4, janelaDias = 120) {
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  const ano = hoje.getFullYear();
  return [...datasDoAno(ano), ...datasDoAno(ano + 1)]
    .map((d) => ({ nome: d.nome, data: diaLocal(d.data.getTime()), dias: Math.round((d.data.getTime() - hoje.getTime()) / DIA), dica: d.dica }))
    .filter((d) => d.dias >= 0 && d.dias <= janelaDias).sort((a, b) => a.dias - b.dias).slice(0, quantas);
}

// ---------------- 8. Visitas da página de vendas ----------------

export const limparOrigemSite = (o: string) => String(o ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);

export function registrarSite(db: DB, tipo: 'visita' | 'teste' | 'demo' | 'zap', origem: string, plano: string, ua: string, em = Date.now()) {
  if (!ua || ROBO.test(ua)) return;
  db.prepare('INSERT INTO site_acessos (tipo, origem, plano, em) VALUES (?, ?, ?, ?)').run(tipo, limparOrigemSite(origem), String(plano ?? '').replace(/[^a-z]/g, '').slice(0, 12), em);
}

export function relatorioSite(db: DB, dias = 30, agora = Date.now()) {
  const de = agora - dias * DIA;
  const tot = (tipo: string) => Number((db.prepare('SELECT COUNT(*) AS n FROM site_acessos WHERE tipo = ? AND em >= ?').get(tipo, de) as any).n);
  const origens = (db.prepare(`SELECT CASE WHEN origem = '' THEN 'direto' ELSE origem END AS origem, SUM(tipo = 'visita') AS visitas, SUM(tipo = 'teste') AS testes, SUM(tipo = 'demo') AS demos, SUM(tipo = 'zap') AS zaps
    FROM site_acessos WHERE em >= ? GROUP BY 1 ORDER BY visitas DESC LIMIT 20`).all(de) as any[]).map((o) => ({ origem: o.origem, visitas: Number(o.visitas), testes: Number(o.testes), demos: Number(o.demos), zaps: Number(o.zaps) }));
  const planos = (db.prepare("SELECT plano, COUNT(*) AS n FROM site_acessos WHERE tipo = 'teste' AND plano <> '' AND em >= ? GROUP BY plano ORDER BY n DESC").all(de) as any[]).map((p) => ({ plano: p.plano, n: Number(p.n) }));
  const porDia = new Map<string, { dia: string; visitas: number; testes: number }>();
  for (let i = dias - 1; i >= 0; i--) { const d = diaLocal(agora - i * DIA); porDia.set(d, { dia: d, visitas: 0, testes: 0 }); }
  for (const a of db.prepare("SELECT tipo, em FROM site_acessos WHERE em >= ? AND tipo IN ('visita','teste')").all(de) as any[]) {
    const x = porDia.get(diaLocal(Number(a.em))); if (!x) continue;
    if (a.tipo === 'visita') x.visitas++; else x.testes++;
  }
  return { dias, visitas: tot('visita'), testes: tot('teste'), demos: tot('demo'), zaps: tot('zap'), origens, planos, serie: [...porDia.values()] };
}

export { hm };
