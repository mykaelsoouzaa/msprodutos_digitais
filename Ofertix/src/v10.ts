// v10: envio por tema e espelhamento de grupos.
// Envio por tema: cada grupo de envio escolhe as categorias que recebe e um preço máximo (ex.: "até R$ 50").
// Espelhamento: cada mensagem nova de um grupo de origem sai nos grupos da conta igualzinha
// (texto, imagem, cupom, chamada), trocando só os links de loja pelos links de afiliado da conta.
import { randomBytes, createHash } from 'node:crypto';
import type { DB } from './db.ts';
import type { Ctx } from './servico.ts';
import { ErroUso, config, planoDa, converterLink, salvarOferta, agendar } from './servico.ts';
import { ID_CATEGORIAS, nomeCategoria, lerNicho, motivoRecusa, rodapeAfiliado, classificar } from './nicho.ts';
import { plataformaDe, lojaSuportada, resolverLink, NOME_PLATAFORMA, type Plataforma } from './links.ts';
import { reais } from './mensagem.ts';
import { ajustarAmazon } from './regras.ts';

const t = (c: Ctx) => (c.agora ?? Date.now)();

// ======================================================================== envio por tema

export interface TemaGrupo { categorias: string[]; precoMax: number }

export function temaDoGrupo(g: any): TemaGrupo {
  const categorias = String(g?.categorias ?? '').split(',').map((x) => x.trim()).filter((x) => ID_CATEGORIAS.has(x));
  return { categorias, precoMax: Math.max(0, Number(g?.preco_max) || 0) };
}
export const temTema = (g: any) => { const x = temaDoGrupo(g); return x.categorias.length > 0 || x.precoMax > 0; };

/** O grupo recebe esta oferta? Grupo sem tema recebe tudo. Com preço máximo, oferta sem preço não entra. */
export function aceitaOferta(g: any, o: { categoria?: string | null; preco_por?: number | null }): boolean {
  const x = temaDoGrupo(g);
  if (x.categorias.length && !x.categorias.includes(o.categoria || 'outros')) return false;
  if (x.precoMax > 0 && !(o.preco_por != null && Number(o.preco_por) > 0 && Number(o.preco_por) <= x.precoMax)) return false;
  return true;
}

export function salvarTemaGrupo(db: DB, conta: number, id: number, b: any) {
  const g = db.prepare('SELECT id FROM grupos WHERE id = ? AND conta_id = ?').get(id, conta);
  if (!g) throw new ErroUso('Grupo não encontrado', 404);
  const cats = [...new Set((Array.isArray(b?.categorias) ? b.categorias : String(b?.categorias ?? '').split(',')).map((x: unknown) => String(x).trim()))]
    .filter((x) => ID_CATEGORIAS.has(x));
  const preco = Math.round(Number(String(b?.precoMax ?? b?.preco_max ?? 0).replace(',', '.')) || 0);
  if (preco < 0 || preco > 10_000_000) throw new ErroUso('Preço máximo inválido');
  db.prepare('UPDATE grupos SET categorias = ?, preco_max = ? WHERE id = ?').run(cats.join(','), preco, id);
}

export function descreverTema(g: any): string {
  const x = temaDoGrupo(g);
  const partes = [];
  if (x.categorias.length) partes.push(x.categorias.map(nomeCategoria).join(', '));
  if (x.precoMax) partes.push(`até ${reais(x.precoMax)}`);
  return partes.join(' · ') || 'Todas as ofertas';
}

/** Por que uma oferta enviada a "todos" não achou grupo nenhum. */
export function motivoSemGrupo(o: { categoria?: string | null; preco_por?: number | null }) {
  return `Nenhum grupo de envio recebe ${nomeCategoria(o.categoria || 'outros')}${o.preco_por ? ` de ${reais(o.preco_por)}` : ''}. Ajuste os temas em Grupos de envio.`;
}

// ======================================================================== espelhamento

export type Destino = 'tema' | 'todos' | 'grupos';
export interface Espelho {
  id: number; origem_grupo_id: number; destino: Destino; grupos: number[]; ativo: boolean;
  so_com_link: boolean; curadoria: boolean; rodape: boolean; atraso_min: number; remover: string[]; copiadas: number;
}

const lerEspelho = (r: any): Espelho => ({
  id: Number(r.id), origem_grupo_id: Number(r.origem_grupo_id), destino: (['tema', 'todos', 'grupos'].includes(r.destino) ? r.destino : 'tema') as Destino,
  grupos: (() => { try { return (JSON.parse(r.grupos) as unknown[]).map(Number).filter(Boolean); } catch { return []; } })(),
  ativo: !!r.ativo, so_com_link: !!r.so_com_link, curadoria: !!r.curadoria, rodape: !!r.rodape,
  atraso_min: Number(r.atraso_min) || 0, remover: String(r.remover ?? '').split('\n').map((x) => x.trim()).filter(Boolean), copiadas: Number(r.copiadas) || 0,
});

export function listarEspelhos(db: DB, conta: number) {
  return (db.prepare(`SELECT e.*, g.nome AS origem_nome, g.participantes AS origem_participantes FROM espelhos e JOIN grupos g ON g.id = e.origem_grupo_id
    WHERE e.conta_id = ? ORDER BY e.ativo DESC, e.id`).all(conta) as any[]).map((r) => ({ ...lerEspelho(r), origem_nome: r.origem_nome, origem_participantes: Number(r.origem_participantes) }));
}

export function salvarEspelho(db: DB, conta: number, b: any, id?: number): number {
  const p = planoDa(db, conta);
  if (!p.captura) throw new ErroUso('O espelhamento não faz parte do seu plano. Ele vem nos planos Pro e Escala.');
  const origem = Number(b?.origem ?? b?.origem_grupo_id);
  const g = db.prepare('SELECT * FROM grupos WHERE id = ? AND conta_id = ?').get(origem, conta) as any;
  if (!g) throw new ErroUso('Escolha o grupo de origem');
  if (g.enviar) throw new ErroUso('O grupo de origem não pode ser um dos seus grupos de envio (a mensagem voltaria para ele).');
  const destino: Destino = ['tema', 'todos', 'grupos'].includes(b?.destino) ? b.destino : 'tema';
  const grupos = destino === 'grupos'
    ? [...new Set((Array.isArray(b?.grupos) ? b.grupos : []).map(Number))].filter((x) => db.prepare('SELECT 1 FROM grupos WHERE id = ? AND conta_id = ? AND enviar = 1').get(x, conta))
    : [];
  if (destino === 'grupos' && !grupos.length) throw new ErroUso('Escolha ao menos um grupo de envio');
  const atraso = Math.min(240, Math.max(0, Math.round(Number(b?.atraso_min) || 0)));
  const remover = String(Array.isArray(b?.remover) ? b.remover.join('\n') : b?.remover ?? '').split('\n').map((x) => x.trim().slice(0, 80)).filter(Boolean).slice(0, 20).join('\n');
  const ativo = b?.ativo === undefined ? true : !!b.ativo;
  if (ativo) {
    const outros = (db.prepare('SELECT COUNT(*) AS n FROM espelhos WHERE conta_id = ? AND ativo = 1 AND id <> ?').get(conta, id ?? 0) as any).n;
    if (outros >= p.gruposMonitorados) throw new ErroUso(`Seu plano permite ${p.gruposMonitorados} espelhamento(s) ligado(s) ao mesmo tempo`);
  }
  const dup = db.prepare('SELECT id FROM espelhos WHERE conta_id = ? AND origem_grupo_id = ? AND id <> ?').get(conta, origem, id ?? 0);
  if (dup) throw new ErroUso('Esse grupo já tem um espelhamento. Edite o que existe.');
  const vals = [origem, destino, JSON.stringify(grupos), ativo ? 1 : 0, b?.so_com_link === false ? 0 : 1, b?.curadoria ? 1 : 0, b?.rodape === false ? 0 : 1, atraso, remover];
  if (id) {
    const r = db.prepare('UPDATE espelhos SET origem_grupo_id = ?, destino = ?, grupos = ?, ativo = ?, so_com_link = ?, curadoria = ?, rodape = ?, atraso_min = ?, remover = ? WHERE id = ? AND conta_id = ?').run(...vals, id, conta);
    if (!Number(r.changes)) throw new ErroUso('Espelhamento não encontrado', 404);
    return id;
  }
  return Number(db.prepare('INSERT INTO espelhos (origem_grupo_id, destino, grupos, ativo, so_com_link, curadoria, rodape, atraso_min, remover, conta_id, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(...vals, conta, Date.now()).lastInsertRowid);
}

export function apagarEspelho(db: DB, conta: number, id: number) {
  db.prepare('DELETE FROM espelhos WHERE id = ? AND conta_id = ?').run(id, conta);
}

// ------------------------------------------------------------------ troca de links

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const CONVITE = /(^|\/\/|\.)(chat\.whatsapp\.com|wa\.me|whatsapp\.com\/channel|t\.me|telegram\.me)\b/i;

export interface Troca { de: string; para: string; loja: string; status: 'trocado' | 'removido' | 'erro'; motivo?: string }
export interface Reescrita { texto: string; trocas: Troca[]; bloqueio: string; ofertas: any[]; amazon: boolean }

/** Link de afiliado da conta para a loja, ou erro se a conta ainda não tem como gerar um. */
async function linkDaConta(c: Ctx, conta: number, url: string) {
  const cfg = config(c.db, conta);
  if (c.demo) {
    // Demonstração: não sai para a internet; finge a conversão com o "link da Carla".
    const pl = plataformaDe(url);
    const cod = createHash('sha1').update(url).digest('hex').slice(0, 6);
    const para = pl === 'shopee' ? `https://s.shopee.com.br/carla${cod}` : `${url.split('?')[0]}?tag=carla-20`;
    return { plataforma: pl, urlOriginal: url.split('?')[0], urlAfiliado: para, titulo: '', imagem: '', precoDe: null, precoPor: null, comissaoPct: null };
  }
  const pl = plataformaDe(url);
  if (pl === 'shopee' && !(cfg.shopee_app_id && cfg.shopee_segredo)) throw new ErroUso('Cadastre a Open API da Shopee em Conectar plataformas para trocar links da Shopee');
  if (pl === 'amazon' && !cfg.amazon_tag) throw new ErroUso('Cadastre a sua tag da Amazon em Conectar plataformas');
  if (pl === 'mercadolivre' && !cfg.ml_modelo) throw new ErroUso('Cadastre o seu modelo de link do Mercado Livre em Conectar plataformas');
  if (pl === 'magalu') throw new ErroUso('O Ofertix ainda não gera link de afiliado da Magalu');
  const o = await converterLink(c, conta, url);
  if (!o.urlAfiliado) throw new ErroUso('A loja não devolveu o seu link de afiliado');
  return o;
}

/**
 * Troca os links da mensagem: link de loja → link de afiliado da conta; convite de grupo ou canal → a linha sai;
 * outro link (encurtador, site) → abre para ver se leva a uma loja; se não leva, sai do texto.
 * Se algum link de loja não puder ser trocado, a mensagem fica bloqueada (nunca sai com o link de outra pessoa).
 */
export async function reescrever(c: Ctx, conta: number, original: string, remover: string[] = []): Promise<Reescrita> {
  const trocas: Troca[] = [];
  const ofertas: any[] = [];
  const tira = remover.map((x) => x.toLowerCase());
  let linhas = String(original ?? '').replace(/\r/g, '').split('\n');
  linhas = linhas.filter((l) => {
    const baixa = l.toLowerCase();
    if (tira.some((x) => baixa.includes(x))) return false;
    const m = l.match(URL_RE) ?? [];
    for (const u of m) if (CONVITE.test(u)) { trocas.push({ de: limpar(u), para: '', loja: 'Convite', status: 'removido', motivo: 'Convite de outro grupo: a linha saiu' }); return false; }
    return true;
  });
  let texto = linhas.join('\n');
  const achados = [...new Set((texto.match(URL_RE) ?? []).map(limpar))];
  let bloqueio = '';
  for (const bruto of achados) {
    const url = bruto.startsWith('www.') ? `https://${bruto}` : bruto;
    let alvo = url;
    if (!lojaSuportada(url) && !c.demo) alvo = await resolverLink(url, c.f).catch(() => url);
    if (!lojaSuportada(alvo)) {
      texto = texto.split(bruto).join('');
      trocas.push({ de: bruto, para: '', loja: 'Outro site', status: 'removido', motivo: 'Não é link de loja: saiu do texto' });
      continue;
    }
    const loja = NOME_PLATAFORMA[plataformaDe(alvo) as Plataforma];
    try {
      const o = await linkDaConta(c, conta, alvo);
      texto = texto.split(bruto).join(o.urlAfiliado);
      trocas.push({ de: bruto, para: o.urlAfiliado, loja, status: 'trocado' });
      ofertas.push(o);
    } catch (e) {
      trocas.push({ de: bruto, para: '', loja, status: 'erro', motivo: (e as Error).message });
      bloqueio ||= `Link da ${loja} sem troca: ${(e as Error).message}`;
    }
  }
  // Linhas que ficaram vazias depois de tirar links não viram buracos no texto.
  texto = texto.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { texto, trocas, bloqueio, ofertas, amazon: ofertas.some((o) => o.plataforma === 'amazon') };
}
const limpar = (u: string) => u.replace(/[).,;!?*_~]+$/, '');

// ------------------------------------------------------------------ mídia (imagem da mensagem original)

export function guardarMidia(db: DB, conta: number, base64: string, tipo: string, agora: number): string {
  const dados = Buffer.from(base64.replace(/^data:[^,]+,/, ''), 'base64');
  if (!dados.length || dados.length > 8_000_000) throw new Error('Imagem vazia ou grande demais');
  const codigo = randomBytes(12).toString('base64url');
  db.prepare('INSERT INTO midias (codigo, conta_id, tipo, dados, criado_em) VALUES (?, ?, ?, ?, ?)').run(codigo, conta, /^image\/(jpeg|png|webp|gif)$/.test(tipo) ? tipo : 'image/jpeg', dados, agora);
  return codigo;
}
export function lerMidia(db: DB, codigo: string): { tipo: string; dados: Uint8Array } | null {
  const r = db.prepare('SELECT tipo, dados FROM midias WHERE codigo = ?').get(codigo) as any;
  return r ? { tipo: r.tipo, dados: r.dados } : null;
}
/** Imagens copiadas ficam 3 dias (o tempo de a fila mandar); depois saem. */
export function limparMidias(db: DB, agora: number) { db.prepare('DELETE FROM midias WHERE criado_em < ?').run(agora - 3 * 86_400_000); }

// ------------------------------------------------------------------ o espelhamento em si

const textoDaMensagem = (m: any): string =>
  String(m?.conversation ?? m?.extendedTextMessage?.text ?? m?.imageMessage?.caption ?? m?.videoMessage?.caption ?? '');

function registrar(db: DB, conta: number, espelho: number, status: 'agendada' | 'bloqueada' | 'ignorada', motivo: string, resumo: string, agora: number, extra: { agendamento?: number; hash?: string } = {}) {
  db.prepare('INSERT INTO espelho_log (conta_id, espelho_id, em, status, motivo, resumo, agendamento_id, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(conta, espelho, agora, status, motivo.slice(0, 200), resumo.slice(0, 160), extra.agendamento ?? null, extra.hash ?? '');
  // Guarda as últimas 500 linhas por conta.
  db.prepare('DELETE FROM espelho_log WHERE conta_id = ? AND id NOT IN (SELECT id FROM espelho_log WHERE conta_id = ? ORDER BY id DESC LIMIT 500)').run(conta, conta);
}

const resumoDe = (texto: string) => texto.split('\n').map((l) => l.replace(/[*_~]/g, '').trim()).find((l) => l && !/^https?:/.test(l)) ?? '(só imagem)';
const assinatura = (texto: string) => createHash('sha1').update(texto.replace(URL_RE, '').replace(/\s+/g, ' ').trim().toLowerCase()).digest('hex');

/**
 * Mensagem nova num grupo que tem espelhamento ligado. Devolve null se o grupo não é origem de nenhum espelhamento
 * (aí a captura comum segue), ou 1/0 conforme a cópia foi agendada.
 */
export async function espelhar(c: Ctx, inst: any, grupo: any, d: any): Promise<number | null> {
  const r = c.db.prepare('SELECT * FROM espelhos WHERE origem_grupo_id = ? AND ativo = 1').get(grupo.id) as any;
  if (!r) return null;
  const e = lerEspelho(r), conta = Number(inst.conta_id), agora = t(c);
  if (!planoDa(c.db, conta).captura) return 0;
  const msg = d?.message ?? {};
  const original = textoDaMensagem(msg);
  const temImagem = !!msg.imageMessage;
  if (!original.trim() && !temImagem) return 0; // figurinha, áudio, reação: não copia
  const resumo = resumoDe(original);
  const hash = assinatura(original);
  if (hash && original.trim() && c.db.prepare("SELECT 1 FROM espelho_log WHERE conta_id = ? AND hash = ? AND status = 'agendada' AND em > ?").get(conta, hash, agora - 12 * 3600_000)) {
    registrar(c.db, conta, e.id, 'ignorada', 'Repetida: a mesma mensagem já foi copiada nas últimas 12 horas', resumo, agora);
    return 0;
  }
  const rw = await reescrever(c, conta, original, e.remover);
  if (rw.bloqueio) { registrar(c.db, conta, e.id, 'bloqueada', rw.bloqueio, resumo, agora); return 0; }
  if (e.so_com_link && !rw.ofertas.length) { registrar(c.db, conta, e.id, 'ignorada', 'Sem link de loja', resumo, agora); return 0; }
  if (!rw.texto && !temImagem) { registrar(c.db, conta, e.id, 'ignorada', 'Nada sobrou depois de tirar os links', resumo, agora); return 0; }

  const cfg = config(c.db, conta);
  const nicho = lerNicho(cfg.nicho);
  const principal = rw.ofertas[0];
  if (principal && !principal.titulo) principal.titulo = resumo.slice(0, 120);
  if (e.curadoria && principal) {
    const motivo = motivoRecusa(nicho.regras, { titulo: principal.titulo, categoria: classificar(principal.titulo), precoPor: principal.precoPor, nota: principal.nota, vendas: principal.vendas });
    if (motivo) { registrar(c.db, conta, e.id, 'ignorada', `Curadoria: ${motivo}`, resumo, agora); return 0; }
  }

  // Amazon: a cópia sai sem preço, sem a imagem e com o aviso obrigatório (src/regras.ts).
  let imagem = '';
  if (temImagem && !rw.amazon) {
    try {
      const m = await c.wpp.midia(inst.chave, d);
      if (m?.base64) imagem = `${c.urlPublica}/m/${guardarMidia(c.db, conta, m.base64, m.mimetype, agora)}`;
    } catch { /* sem a imagem, segue só o texto */ }
  }
  const base = e.rodape ? rodapeAfiliado(rw.texto, nicho.rodape) : rw.texto;
  const texto = rw.amazon ? ajustarAmazon(base) : base;
  const ofertaId = principal ? salvarOferta(c, conta, principal, 'espelho', grupo.nome) : undefined;
  if (ofertaId && imagem) c.db.prepare("UPDATE ofertas SET imagem = CASE WHEN imagem = '' THEN ? ELSE imagem END WHERE id = ?").run(imagem, ofertaId);
  let grupos: number[] | 'todos' = 'todos';
  if (e.destino === 'grupos') grupos = e.grupos;
  if (e.destino === 'todos') grupos = (c.db.prepare('SELECT id FROM grupos WHERE conta_id = ? AND enviar = 1').all(conta) as any[]).map((x) => Number(x.id));
  try {
    const ag = agendar(c, conta, { ofertaId, texto: texto || resumo, imagem, quando: agora + e.atraso_min * 60_000, grupos: Array.isArray(grupos) && !grupos.length ? 'todos' : grupos, origem: 'espelho' });
    c.db.prepare('UPDATE espelhos SET copiadas = copiadas + 1 WHERE id = ?').run(e.id);
    const removidos = rw.trocas.filter((x) => x.status === 'removido').length;
    registrar(c.db, conta, e.id, 'agendada', `${rw.ofertas.length} link(s) trocado(s)${removidos ? `, ${removidos} removido(s)` : ''}${imagem ? ', com imagem' : ''}${rw.amazon ? '; Amazon: sem preço e sem imagem, com o aviso de associado' : ''}`, resumo, agora, { agendamento: ag, hash });
    return 1;
  } catch (err) {
    registrar(c.db, conta, e.id, 'bloqueada', (err as Error).message, resumo, agora);
    return 0;
  }
}

export function registroEspelhos(db: DB, conta: number, limite = 40) {
  return db.prepare(`SELECT l.*, g.nome AS origem_nome, a.status AS envio_status FROM espelho_log l JOIN espelhos e ON e.id = l.espelho_id JOIN grupos g ON g.id = e.origem_grupo_id
    LEFT JOIN agendamentos a ON a.id = l.agendamento_id WHERE l.conta_id = ? ORDER BY l.em DESC, l.id DESC LIMIT ?`).all(conta, limite);
}

export function painelEspelhos(db: DB, conta: number, agora: number) {
  const p = planoDa(db, conta);
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  const cont = (st: string) => (db.prepare('SELECT COUNT(*) AS n FROM espelho_log WHERE conta_id = ? AND status = ? AND em >= ?').get(conta, st, hoje.getTime()) as any).n;
  const grupos = db.prepare('SELECT id, nome, participantes, enviar, monitorar, categorias, preco_max FROM grupos WHERE conta_id = ? ORDER BY nome').all(conta) as any[];
  const cfg = config(db, conta);
  return {
    lista: listarEspelhos(db, conta),
    registro: registroEspelhos(db, conta),
    hoje: { agendadas: cont('agendada'), bloqueadas: cont('bloqueada'), ignoradas: cont('ignorada') },
    limite: p.gruposMonitorados, permitido: p.captura,
    grupos: grupos.map((g) => ({ id: g.id, nome: g.nome, participantes: g.participantes, enviar: !!g.enviar, tema: descreverTema(g) })),
    lojas: { shopee: !!(cfg.shopee_app_id && cfg.shopee_segredo), amazon: !!cfg.amazon_tag, mercadolivre: !!cfg.ml_modelo },
  };
}

export async function previaEspelho(c: Ctx, conta: number, texto: string, remover: string[] = []) {
  if (String(texto ?? '').length > 4000) throw new ErroUso('Texto muito longo');
  const rw = await reescrever(c, conta, String(texto ?? ''), remover);
  const nicho = lerNicho(config(c.db, conta).nicho);
  const comRodape = rodapeAfiliado(rw.texto, nicho.rodape);
  return { texto: rw.texto, comRodape: rw.amazon ? ajustarAmazon(comRodape) : comRodape, trocas: rw.trocas, bloqueio: rw.bloqueio, lojas: rw.ofertas.length, amazon: rw.amazon };
}
