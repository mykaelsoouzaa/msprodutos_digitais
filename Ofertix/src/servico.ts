// Regras do Ofertix: ofertas, agendamentos, fila de envio com intervalos, captura, membros e comissões.
import { randomBytes, randomInt } from 'node:crypto';
import { type DB, agora } from './db.ts';
import { plano } from './planos.ts';
import {
  type Plataforma, NOME_PLATAFORMA, plataformaDe, extrairLinks, lojaSuportada, idsShopee,
  linkAmazon, linkModelo, resolverLink, buscarPagina,
} from './links.ts';
import { linkCurtoShopee, produtoShopee, comissoesShopee, avaliacaoShopee } from './shopee.ts';
import { anotarEntrada, anotarPreco, limiteDoNumero } from './extras.ts';
import { classificar, colecaoDoDia, lerNicho, motivoRecusa, rodapeAfiliado, CATEGORIAS, nomeCategoria } from './nicho.ts';
import { montarMensagem, descontoPct, expandirVariacoes, reais } from './mensagem.ts';
import type { WhatsApp } from './whatsapp.ts';
import { avisosEntradas } from './entradas.ts';
import { responderPrivado } from './v6.ts';
import { aceitaOferta, motivoSemGrupo, temTema, espelhar } from './v10.ts';
import { comAvisoAmazon } from './regras.ts';

export class ErroUso extends Error {
  status: number;
  constructor(msg: string, status = 400) { super(msg); this.status = status; }
}

export interface Ctx { db: DB; wpp: WhatsApp; f: typeof fetch; urlPublica: string; agora?: () => number; demo?: boolean }
const t = (c: Ctx) => (c.agora ?? agora)();

export const config = (db: DB, conta: number) => db.prepare('SELECT * FROM config_conta WHERE conta_id = ?').get(conta) as any;
export const planoDa = (db: DB, conta: number) => plano((db.prepare('SELECT plano FROM contas WHERE id = ?').get(conta) as any)?.plano);

// ---------------- Ofertas ----------------

export interface NovaOferta { plataforma: Plataforma; urlOriginal: string; urlAfiliado: string; titulo: string; imagem: string; precoDe: number | null; precoPor: number | null; comissaoPct: number | null; nota?: number | null; vendas?: number | null }

export const nichoDa = (db: DB, conta: number) => lerNicho(config(db, conta)?.nicho ?? '');

/** Resolve o link, troca pelo de afiliado e busca título, foto e preço. */
export async function converterLink(c: Ctx, conta: number, url: string): Promise<NovaOferta> {
  let u: URL;
  try { u = new URL(url.trim()); } catch { throw new ErroUso('Link inválido'); }
  if (!/^https?:$/.test(u.protocol)) throw new ErroUso('Link inválido');
  const cfg = config(c.db, conta);
  let final = u.toString();
  if (plataformaDe(final) === 'outra') throw new ErroUso('Por enquanto o Ofertix aceita links da Shopee, Mercado Livre, Amazon e Magalu');
  // Links curtos (s.shopee, amzn.to, meli.la...) precisam ser abertos para achar o produto.
  if (/^(s\.shopee\.com\.br|shp\.ee|amzn\.to|a\.co|meli\.la)$/i.test(u.hostname) || /\/(sec|social)\//.test(u.pathname)) final = await resolverLink(final, c.f);
  // Mercado Livre: link de vitrine de outro afiliado que não leva a um produto não tem como virar o link da conta.
  if (plataformaDe(final) === 'mercadolivre' && /\/social\//.test(new URL(final).pathname)) throw new ErroUso('Link de vitrine de outro afiliado do Mercado Livre: abra o produto e copie o link dele');
  const plataforma = plataformaDe(final) === 'outra' ? plataformaDe(url) : plataformaDe(final);

  const base: NovaOferta = { plataforma, urlOriginal: final, urlAfiliado: final, titulo: '', imagem: '', precoDe: null, precoPor: null, comissaoPct: null };

  if (plataforma === 'shopee') {
    const cred = { appId: cfg.shopee_app_id, segredo: cfg.shopee_segredo };
    const limpo = final.split('?')[0];
    base.urlOriginal = limpo;
    if (cred.appId && cred.segredo) {
      base.urlAfiliado = await linkCurtoShopee(cred, limpo, 'ofertix', c.f);
      const ids = idsShopee(limpo);
      const p = ids ? await produtoShopee(cred, ids.shopId, ids.itemId, c.f).catch(() => null) : null;
      if (p) Object.assign(base, { titulo: p.titulo, imagem: p.imagem, precoDe: p.precoDe, precoPor: p.precoPor, comissaoPct: p.comissaoPct });
      const av = ids ? await avaliacaoShopee(cred, ids.shopId, ids.itemId, c.f).catch(() => null) : null;
      if (av) Object.assign(base, av);
    }
  } else if (plataforma === 'amazon') {
    base.urlAfiliado = linkAmazon(final, cfg.amazon_tag);
  } else if (plataforma === 'mercadolivre') {
    base.urlAfiliado = linkModelo(final, cfg.ml_modelo);
  }

  if (!base.titulo) {
    const pg = await buscarPagina(final, c.f);
    base.titulo = pg.titulo;
    base.imagem ||= pg.imagem;
    base.precoPor ??= pg.preco;
  }
  return base;
}

export function salvarOferta(c: Ctx, conta: number, o: NovaOferta, origem = 'manual', origemGrupo = ''): number {
  c.db.prepare(`INSERT INTO ofertas (conta_id, plataforma, url_original, url_afiliado, titulo, imagem, preco_de, preco_por, comissao_pct, origem, origem_grupo, criado_em, categoria, nota, vendas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (conta_id, url_original) DO UPDATE SET url_afiliado = excluded.url_afiliado,
      titulo = CASE WHEN excluded.titulo <> '' THEN excluded.titulo ELSE ofertas.titulo END,
      imagem = CASE WHEN excluded.imagem <> '' THEN excluded.imagem ELSE ofertas.imagem END,
      preco_de = COALESCE(excluded.preco_de, ofertas.preco_de), preco_por = COALESCE(excluded.preco_por, ofertas.preco_por),
      comissao_pct = COALESCE(excluded.comissao_pct, ofertas.comissao_pct),
      categoria = CASE WHEN ofertas.categoria <> '' THEN ofertas.categoria ELSE excluded.categoria END,
      nota = COALESCE(excluded.nota, ofertas.nota), vendas = COALESCE(excluded.vendas, ofertas.vendas)`)
    .run(conta, o.plataforma, o.urlOriginal, o.urlAfiliado, o.titulo, o.imagem, o.precoDe, o.precoPor, o.comissaoPct, origem, origemGrupo, t(c),
      o.titulo ? classificar(o.titulo) : '', o.nota ?? null, o.vendas ?? null);
  const id = Number((c.db.prepare('SELECT id FROM ofertas WHERE conta_id = ? AND url_original = ?').get(conta, o.urlOriginal) as any).id);
  c.db.prepare('UPDATE ofertas SET arquivada = 0 WHERE id = ?').run(id);
  anotarPreco(c.db, id, o.precoPor, t(c));
  return id;
}

export function oferta(db: DB, conta: number, id: number) {
  const o = db.prepare('SELECT * FROM ofertas WHERE id = ? AND conta_id = ?').get(id, conta) as any;
  if (!o) throw new ErroUso('Oferta não encontrada', 404);
  return o;
}

/** Texto pronto da oferta, com o cupom ativo da loja (se houver). */
export function textoOferta(db: DB, conta: number, o: any): string {
  const cup = db.prepare('SELECT codigo FROM cupons WHERE conta_id = ? AND plataforma = ? AND ativo = 1 ORDER BY id DESC LIMIT 1').get(conta, o.plataforma) as any;
  const cfg = config(db, conta);
  const amazon = o.plataforma === 'amazon';
  const texto = rodapeAfiliado(montarMensagem({
    titulo: o.titulo, precoDe: o.preco_de, precoPor: o.preco_por, link: o.url_afiliado,
    plataforma: NOME_PLATAFORMA[o.plataforma as Plataforma] ?? '', cupom: cup?.codigo, semPreco: amazon,
  }, cfg.modelo_mensagem), lerNicho(cfg.nicho).rodape);
  // Amazon: sem preço e com o aviso obrigatório do Programa de Associados (src/regras.ts).
  return amazon ? comAvisoAmazon(texto) : texto;
}

// ---------------- Agendamentos e fila ----------------

export function agendar(c: Ctx, conta: number, a: { ofertaId?: number; texto: string; imagem?: string; quando?: number; grupos?: number[] | 'todos'; origem?: string }): number {
  const texto = String(a.texto ?? '').trim();
  if (!texto) throw new ErroUso('Escreva o texto da oferta');
  if (texto.length > 4000) throw new ErroUso('Texto muito longo');
  const quando = Math.max(Number(a.quando) || t(c), t(c));
  let grupos: number[] | 'todos' = 'todos';
  if (Array.isArray(a.grupos)) {
    grupos = a.grupos.map(Number).filter((g) => (c.db.prepare('SELECT 1 FROM grupos WHERE id = ? AND conta_id = ? AND enviar = 1').get(g, conta)));
    if (!grupos.length) throw new ErroUso('Escolha ao menos um grupo de envio');
  } else if (!(c.db.prepare('SELECT 1 FROM grupos WHERE conta_id = ? AND enviar = 1 LIMIT 1').get(conta))) {
    throw new ErroUso('Ligue o envio em ao menos um grupo');
  }
  const r = c.db.prepare('INSERT INTO agendamentos (conta_id, oferta_id, texto, imagem, quando, grupos, origem, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(conta, a.ofertaId ?? null, texto, a.imagem ?? '', quando, JSON.stringify(grupos), a.origem ?? 'manual', t(c));
  return Number(r.lastInsertRowid);
}

/** Vários links de uma vez: cada um vira uma oferta agendada, espaçada pelo intervalo escolhido. */
export async function ofertasEmLote(c: Ctx, conta: number, urls: string[], o: { espacoMin?: number; inicio?: number; grupos?: number[] | 'todos' }) {
  const lista = [...new Set(urls.map((u) => String(u).trim()).filter(Boolean))];
  if (!lista.length) throw new ErroUso('Cole ao menos um link');
  if (lista.length > 20) throw new ErroUso('Cole no máximo 20 links por vez');
  const espaco = Math.min(24 * 60, Math.max(5, Number(o.espacoMin) || 30)) * 60_000;
  const inicio = Math.max(Number(o.inicio) || t(c), t(c));
  const criadas: { id: number; titulo: string; quando: number }[] = [];
  const erros: { url: string; erro: string }[] = [];
  for (const url of lista) {
    try {
      const nova = await converterLink(c, conta, url);
      const id = salvarOferta(c, conta, nova);
      const of = oferta(c.db, conta, id);
      const quando = inicio + criadas.length * espaco;
      agendar(c, conta, { ofertaId: id, texto: textoOferta(c.db, conta, of), imagem: of.imagem, quando, grupos: o.grupos ?? 'todos', origem: 'lote' });
      criadas.push({ id, titulo: of.titulo, quando });
    } catch (e) {
      erros.push({ url, erro: (e as Error).message });
    }
  }
  return { criadas, erros };
}

// ---------------- Janela de envio ----------------

/** Hora local dentro da janela [inicio, fim). inicio = fim significa 24 horas. */
export function dentroDaJanela(ms: number, inicio: number, fim: number): boolean {
  if (inicio === fim) return true;
  const h = new Date(ms).getHours();
  return inicio < fim ? h >= inicio && h < fim : h >= inicio || h < fim;
}

export function proximaAbertura(ms: number, inicio: number, fim: number): number {
  if (dentroDaJanela(ms, inicio, fim)) return ms;
  const d = new Date(ms);
  d.setHours(inicio, 0, 0, 0);
  if (d.getTime() <= ms) d.setDate(d.getDate() + 1);
  return d.getTime();
}

const janela = (cfg: any) => [Number(cfg.janela_inicio ?? 8), Number(cfg.janela_fim ?? 22)] as const;

// ---------------- Conferência de preço (Shopee) ----------------

/** Antes de enviar: produto esgotado ou com preço maior que 5% acima do anunciado cancela o envio. */
export async function conferirOferta(c: Ctx, conta: number, ofertaId: number): Promise<string> {
  const cfg = config(c.db, conta);
  const o = c.db.prepare('SELECT * FROM ofertas WHERE id = ? AND conta_id = ?').get(ofertaId, conta) as any;
  if (!o || !cfg.conferir_preco || o.plataforma !== 'shopee' || !cfg.shopee_app_id || !cfg.shopee_segredo) return '';
  const ids = idsShopee(o.url_original);
  if (!ids) return '';
  let p;
  try { p = await produtoShopee({ appId: cfg.shopee_app_id, segredo: cfg.shopee_segredo }, ids.shopId, ids.itemId, c.f); }
  catch { return ''; } // falha de rede não bloqueia o envio
  if (!p) {
    c.db.prepare('UPDATE ofertas SET esgotada = 1 WHERE id = ?').run(o.id);
    return 'Produto indisponível na Shopee';
  }
  if (o.preco_por && p.precoPor && p.precoPor > o.preco_por * 1.05) {
    c.db.prepare('UPDATE ofertas SET preco_por = ?, preco_de = ? WHERE id = ?').run(p.precoPor, p.precoDe, o.id);
    anotarPreco(c.db, o.id, p.precoPor, t(c));
    return `Preço subiu de ${reais(o.preco_por)} para ${reais(p.precoPor)}`;
  }
  c.db.prepare('UPDATE ofertas SET esgotada = 0, preco_por = COALESCE(?, preco_por), preco_de = COALESCE(?, preco_de), comissao_pct = COALESCE(?, comissao_pct) WHERE id = ?')
    .run(p.precoPor, p.precoDe, p.comissaoPct, o.id);
  anotarPreco(c.db, o.id, p.precoPor, t(c));
  return '';
}

export function cancelarAgendamento(db: DB, conta: number, id: number) {
  const r = db.prepare("UPDATE agendamentos SET status = 'cancelado' WHERE id = ? AND conta_id = ? AND status IN ('pendente','enviando')").run(id, conta);
  if (!Number(r.changes)) throw new ErroUso('Esse agendamento não pode mais ser cancelado');
  db.prepare("DELETE FROM envios WHERE agendamento_id = ? AND status = 'fila'").run(id);
}

/**
 * Agendamentos que chegaram na hora viram envios, um por grupo, espaçados por um intervalo
 * aleatório (padrão 25–70 s) por número, continuando de onde a fila daquele número já está.
 */
export async function despachar(c: Ctx): Promise<number> {
  const vencidos = c.db.prepare("SELECT * FROM agendamentos WHERE status = 'pendente' AND quando <= ? ORDER BY quando LIMIT 50").all(t(c)) as any[];
  let feitos = 0;
  for (const a of vencidos) {
    const cfg = config(c.db, a.conta_id);
    if (Number(cfg.pausado)) continue; // pausa geral: fica pendente até retomar
    const [ini, fim] = janela(cfg);
    if (!dentroDaJanela(t(c), ini, fim)) continue; // fica pendente até a janela abrir
    const cancelar = (obs: string) => c.db.prepare("UPDATE agendamentos SET status = 'cancelado', obs = ? WHERE id = ?").run(obs, a.id);

    if (a.oferta_id) {
      const motivo = await conferirOferta(c, a.conta_id, a.oferta_id);
      if (motivo) { cancelar(motivo); continue; }
    }

    const ids = JSON.parse(a.grupos);
    let grupos = (ids === 'todos'
      ? c.db.prepare('SELECT g.id, g.instancia_id, g.categorias, g.preco_max FROM grupos g WHERE g.conta_id = ? AND g.enviar = 1 ORDER BY g.id').all(a.conta_id)
      : c.db.prepare(`SELECT g.id, g.instancia_id FROM grupos g WHERE g.conta_id = ? AND g.enviar = 1 AND g.id IN (${ids.map(() => '?').join(',')}) ORDER BY g.id`).all(a.conta_id, ...ids)) as any[];
    if (!grupos.length) { c.db.prepare("UPDATE agendamentos SET status = 'erro', obs = 'Nenhum grupo de envio ligado' WHERE id = ?").run(a.id); continue; }
    // Envio por tema (v10): oferta mandada para "todos" vai só para os grupos cujo tema aceita a categoria e o preço dela.
    if (ids === 'todos' && a.oferta_id) {
      const of = c.db.prepare('SELECT categoria, preco_por FROM ofertas WHERE id = ?').get(a.oferta_id) as any;
      if (of) {
        grupos = grupos.filter((g) => aceitaOferta(g, of));
        if (!grupos.length) { cancelar(motivoSemGrupo(of)); continue; }
      }
    }

    // Proteção contra repetição: a mesma oferta não volta ao mesmo grupo dentro do prazo.
    const horas = Number(cfg.repeticao_horas) || 0;
    const jaRecebeu = (g: number) => !!(a.oferta_id && horas > 0 && c.db.prepare(`SELECT 1 FROM envios e JOIN agendamentos x ON x.id = e.agendamento_id
        WHERE e.grupo_id = ? AND x.oferta_id = ? AND x.id <> ? AND e.status IN ('enviado','fila') AND COALESCE(e.enviado_em, e.enviar_em) > ? LIMIT 1`)
      .get(g, a.oferta_id, a.id, t(c) - horas * 3600_000));
    const livres = grupos.filter((g) => !jaRecebeu(g.id));
    for (const g of grupos.filter((g) => jaRecebeu(g.id))) {
      c.db.prepare("INSERT INTO envios (conta_id, agendamento_id, grupo_id, instancia_id, enviar_em, status, erro) VALUES (?, ?, ?, ?, ?, 'pulado', ?)")
        .run(a.conta_id, a.id, g.id, g.instancia_id, t(c), `Já recebeu esta oferta nas últimas ${horas} h`);
    }
    if (!livres.length) { cancelar(`Todos os grupos já receberam esta oferta nas últimas ${horas} h`); continue; }

    const min = Math.max(5, Number(cfg.intervalo_min) || 25), max = Math.max(min + 1, Number(cfg.intervalo_max) || 70);
    const ultimo = new Map<number, number>();
    for (const g of livres) {
      if (!ultimo.has(g.instancia_id)) {
        const u = c.db.prepare("SELECT MAX(enviar_em) AS m FROM envios WHERE instancia_id = ? AND status = 'fila'").get(g.instancia_id) as any;
        // Fila vazia: o primeiro sai logo; fila com envios: continua depois do último.
        ultimo.set(g.instancia_id, u?.m != null && Number(u.m) > t(c) - min * 1000 ? Number(u.m) : t(c) - min * 1000);
      }
      // Se o espaçamento passar do fim da janela, o resto continua na próxima abertura.
      const quando = proximaAbertura(ultimo.get(g.instancia_id)! + randomInt(min, max + 1) * 1000, ini, fim);
      ultimo.set(g.instancia_id, quando);
      c.db.prepare('INSERT INTO envios (conta_id, agendamento_id, grupo_id, instancia_id, enviar_em) VALUES (?, ?, ?, ?, ?)')
        .run(a.conta_id, a.id, g.id, g.instancia_id, quando);
    }
    c.db.prepare("UPDATE agendamentos SET status = 'enviando' WHERE id = ?").run(a.id);
    feitos++;
  }
  return feitos;
}

// ---------------- Cliques ----------------

const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const novoCodigo = () => Array.from(randomBytes(7), (b) => ALFABETO[b % ALFABETO.length]).join('');

/** Troca o link de afiliado por um link curto do Ofertix, um por grupo, para contar os cliques. */
export function linkRastreado(c: Ctx, e: { conta_id: number; oferta_id: number | null; grupo_id: number; agendamento_id: number }, destino: string): string {
  let codigo = novoCodigo();
  while (c.db.prepare('SELECT 1 FROM links WHERE codigo = ?').get(codigo)) codigo = novoCodigo();
  c.db.prepare('INSERT INTO links (codigo, conta_id, oferta_id, grupo_id, agendamento_id, destino, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(codigo, e.conta_id, e.oferta_id, e.grupo_id, e.agendamento_id, destino, t(c));
  return `${c.urlPublica}/r/${codigo}`;
}

export const ROBO = /bot|crawl|spider|slurp|facebookexternalhit|^WhatsApp\/|preview|curl|wget|python|node-fetch|headless/i;

/** Clique no link curto: devolve o destino e conta o clique (robôs de prévia não contam). */
export function registrarClique(c: Ctx, codigo: string, userAgent: string): string | null {
  const l = c.db.prepare('SELECT * FROM links WHERE codigo = ?').get(codigo) as any;
  if (!l) return null;
  if (userAgent && !ROBO.test(userAgent)) c.db.prepare('INSERT INTO cliques (codigo, conta_id, em) VALUES (?, ?, ?)').run(codigo, l.conta_id, t(c));
  return l.destino;
}

const inicioDoDia = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Manda o que está na hora. Respeita o limite diário por número do plano. */
export async function processarFila(c: Ctx, maximo = 20): Promise<number> {
  const fila = c.db.prepare(`SELECT e.*, i.chave, i.status AS inst_status, g.jid, a.texto, a.imagem, a.oferta_id, a.enquete, o.url_afiliado, o.plataforma
    FROM envios e JOIN instancias i ON i.id = e.instancia_id JOIN grupos g ON g.id = e.grupo_id JOIN agendamentos a ON a.id = e.agendamento_id
    LEFT JOIN ofertas o ON o.id = a.oferta_id
    WHERE e.status = 'fila' AND e.enviar_em <= ? ORDER BY e.enviar_em LIMIT ?`).all(t(c), maximo) as any[];
  let feitos = 0;
  const vistos = new Set<number>();
  const adiadas = new Set<number>();
  for (const e of fila) {
    if (vistos.has(e.instancia_id) || adiadas.has(e.conta_id)) continue; // um envio por número a cada rodada, para manter o intervalo
    vistos.add(e.instancia_id);
    const cfg = config(c.db, e.conta_id);
    if (Number(cfg.pausado)) {
      // Pausa geral: a fila espera, e o tempo parado é somado a todos os envios da conta.
      c.db.prepare("UPDATE envios SET enviar_em = enviar_em + 60000 WHERE conta_id = ? AND status = 'fila' AND enviar_em <= ?").run(e.conta_id, t(c) + 60_000);
      adiadas.add(e.conta_id);
      continue;
    }
    const [ini, fim] = janela(cfg);
    if (!dentroDaJanela(t(c), ini, fim)) {
      // Janela fechou com envios na fila: empurra a fila inteira da conta, mantendo o espaçamento.
      const primeiro = Number((c.db.prepare("SELECT MIN(enviar_em) AS m FROM envios WHERE conta_id = ? AND status = 'fila'").get(e.conta_id) as any).m);
      const atraso = proximaAbertura(t(c), ini, fim) - primeiro;
      if (atraso > 0) c.db.prepare("UPDATE envios SET enviar_em = enviar_em + ? WHERE conta_id = ? AND status = 'fila'").run(atraso, e.conta_id);
      adiadas.add(e.conta_id);
      continue;
    }
    const aq = limiteDoNumero(c.db, e.conta_id, e.instancia_id, t(c));
    const limite = aq.limite;
    const hoje = (c.db.prepare("SELECT COUNT(*) AS n FROM envios WHERE instancia_id = ? AND status = 'enviado' AND enviado_em >= ?").get(e.instancia_id, inicioDoDia(t(c))) as any).n;
    if (hoje >= limite) {
      c.db.prepare("UPDATE envios SET status = 'erro', erro = ? WHERE id = ?").run(aq.aquecendo ? `Limite do aquecimento atingido (${limite} por dia no dia ${aq.dia} do número)` : 'Limite diário do plano atingido', e.id);
    } else if (e.inst_status !== 'conectado') {
      c.db.prepare("UPDATE envios SET status = 'erro', erro = 'WhatsApp desconectado' WHERE id = ?").run(e.id);
    } else {
      try {
        if (e.enquete) {
          // Enquete: a pergunta vai no texto e as opções ficam guardadas em JSON.
          const q = JSON.parse(e.enquete);
          await c.wpp.enquete(e.chave, e.jid, expandirVariacoes(e.texto), q.opcoes, !!q.multipla);
          c.db.prepare("UPDATE envios SET status = 'enviado', enviado_em = ? WHERE id = ?").run(t(c), e.id);
          feitos++;
          fecharAgendamento(c.db, e.agendamento_id);
          continue;
        }
        let texto = expandirVariacoes(e.texto);
        // Amazon: o link sai direto (sem /r/) e sem foto; regras do Programa de Associados em src/regras.ts.
        const amazon = e.plataforma === 'amazon';
        if (!amazon && cfg.contar_cliques && e.url_afiliado && /^https?:\/\//.test(c.urlPublica) && texto.includes(e.url_afiliado)) {
          texto = texto.split(e.url_afiliado).join(linkRastreado(c, e, e.url_afiliado));
        }
        await c.wpp.enviar(e.chave, e.jid, texto, !amazon && /^https?:\/\//.test(e.imagem) ? e.imagem : undefined);
        c.db.prepare("UPDATE envios SET status = 'enviado', enviado_em = ? WHERE id = ?").run(t(c), e.id);
        feitos++;
      } catch (err) {
        c.db.prepare("UPDATE envios SET status = 'erro', erro = ? WHERE id = ?").run(String((err as Error).message).slice(0, 300), e.id);
      }
    }
    fecharAgendamento(c.db, e.agendamento_id);
  }
  return feitos;
}

function fecharAgendamento(db: DB, id: number) {
  const r = db.prepare("SELECT SUM(status = 'fila') AS fila, SUM(status = 'enviado') AS ok, SUM(status = 'erro') AS erros FROM envios WHERE agendamento_id = ?").get(id) as any;
  if (Number(r.fila) > 0) return;
  db.prepare("UPDATE agendamentos SET status = ? WHERE id = ? AND status = 'enviando'").run(Number(r.ok) > 0 ? 'enviado' : Number(r.erros) > 0 ? 'erro' : 'cancelado', id);
}

// ---------------- WhatsApp: números e grupos ----------------

export async function novaInstancia(c: Ctx, conta: number, nome: string) {
  const p = planoDa(c.db, conta);
  const n = (c.db.prepare('SELECT COUNT(*) AS n FROM instancias WHERE conta_id = ?').get(conta) as any).n;
  if (n >= p.numeros) throw new ErroUso(`Seu plano permite ${p.numeros} número(s) de WhatsApp`);
  const chave = `ofx-${conta}-${randomBytes(4).toString('hex')}`;
  const token = randomBytes(18).toString('base64url');
  await c.wpp.criarInstancia(chave, `${c.urlPublica}/webhook/whatsapp/${chave}?t=${token}`);
  const r = c.db.prepare('INSERT INTO instancias (conta_id, nome, chave, token_webhook, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(conta, (nome || `WhatsApp ${n + 1}`).slice(0, 40), chave, token, t(c));
  return Number(r.lastInsertRowid);
}

export function instancia(db: DB, conta: number, id: number) {
  const i = db.prepare('SELECT * FROM instancias WHERE id = ? AND conta_id = ?').get(id, conta) as any;
  if (!i) throw new ErroUso('Número não encontrado', 404);
  return i;
}

export async function atualizarEstado(c: Ctx, conta: number, id: number) {
  const i = instancia(c.db, conta, id);
  const e = await c.wpp.estado(i.chave);
  c.db.prepare('UPDATE instancias SET status = ?, numero = CASE WHEN ? <> \'\' THEN ? ELSE numero END WHERE id = ?').run(e.estado, e.numero, e.numero, id);
  if (e.estado === 'conectado' && i.status !== 'conectado') await sincronizarGrupos(c, conta, id);
  return e.estado;
}

export async function sincronizarGrupos(c: Ctx, conta: number, id: number) {
  const i = instancia(c.db, conta, id);
  const lista = await c.wpp.listarGrupos(i.chave);
  for (const g of lista) {
    c.db.prepare(`INSERT INTO grupos (conta_id, instancia_id, jid, nome, participantes, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (instancia_id, jid) DO UPDATE SET nome = excluded.nome, participantes = excluded.participantes, atualizado_em = excluded.atualizado_em`)
      .run(conta, id, g.jid, g.nome.slice(0, 100), g.participantes, t(c));
  }
  return lista.length;
}

export function alternarGrupo(db: DB, conta: number, id: number, campo: 'enviar' | 'monitorar', ligado: boolean) {
  const g = db.prepare('SELECT * FROM grupos WHERE id = ? AND conta_id = ?').get(id, conta) as any;
  if (!g) throw new ErroUso('Grupo não encontrado', 404);
  if (ligado) {
    // Grupo monitorado (captura ou origem de espelhamento) não vira grupo de envio, e vice-versa (6.6).
    const origem = db.prepare('SELECT 1 FROM espelhos WHERE origem_grupo_id = ?').get(id);
    if (campo === 'enviar' && (g.monitorar || origem)) throw new ErroUso(`Esse grupo é de monitoramento (${origem ? 'origem de um espelhamento em Automação' : 'captura ligada'}). Desligue o monitoramento antes de enviar ofertas para ele.`);
    if (campo === 'monitorar' && g.enviar) throw new ErroUso('Esse grupo é de envio. Desligue o envio antes de monitorar.');
    const p = planoDa(db, conta);
    if (campo === 'monitorar' && !p.captura) throw new ErroUso('A captura de ofertas não faz parte do seu plano');
    const max = campo === 'enviar' ? p.gruposEnvio : p.gruposMonitorados;
    const n = (db.prepare(`SELECT COUNT(*) AS n FROM grupos WHERE conta_id = ? AND ${campo} = 1 AND id <> ?`).get(conta, id) as any).n;
    if (n >= max) throw new ErroUso(`Seu plano permite ${max} grupo(s) ${campo === 'enviar' ? 'de envio' : 'monitorados'}`);
  }
  db.prepare(`UPDATE grupos SET ${campo} = ? WHERE id = ?`).run(ligado ? 1 : 0, id);
}

// ---------------- Webhook: captura e membros ----------------

const textoDaMensagem = (m: any): string =>
  String(m?.conversation ?? m?.extendedTextMessage?.text ?? m?.imageMessage?.caption ?? m?.videoMessage?.caption ?? '');

/** Evento da Evolution API. Retorna quantas ofertas foram capturadas. */
export async function eventoWhatsApp(c: Ctx, chave: string, token: string, ev: any): Promise<number> {
  const i = c.db.prepare('SELECT * FROM instancias WHERE chave = ?').get(chave) as any;
  if (!i || i.token_webhook !== token) throw new ErroUso('Não autorizado', 401);
  const tipo = String(ev?.event ?? '').toLowerCase().replace(/[_-]/g, '.');

  if (tipo === 'connection.update') {
    const s = String(ev?.data?.state ?? '');
    const estado = s === 'open' ? 'conectado' : s === 'connecting' ? 'conectando' : 'desconectado';
    c.db.prepare('UPDATE instancias SET status = ? WHERE id = ?').run(estado, i.id);
    if (estado === 'conectado' && i.status !== 'conectado') await sincronizarGrupos(c, i.conta_id, i.id).catch(() => {});
    return 0;
  }

  if (tipo === 'group.participants.update') {
    const d = ev?.data ?? {};
    const g = c.db.prepare('SELECT id FROM grupos WHERE instancia_id = ? AND jid = ?').get(i.id, String(d.id ?? '')) as any;
    const qtd = Array.isArray(d.participants) ? d.participants.length : 1;
    const acao = String(d.action ?? '');
    if (g && (acao === 'add' || acao === 'remove')) {
      c.db.prepare('INSERT INTO membros_eventos (conta_id, grupo_id, tipo, qtd, em) VALUES (?, ?, ?, ?, ?)').run(i.conta_id, g.id, acao === 'add' ? 'entrou' : 'saiu', qtd, t(c));
      c.db.prepare('UPDATE grupos SET participantes = MAX(0, participantes + ?) WHERE id = ?').run(acao === 'add' ? qtd : -qtd, g.id);
      if (acao === 'add') anotarEntrada(c.db, g.id, qtd);
    }
    return 0;
  }

  if (tipo !== 'messages.upsert') return 0;
  const d = Array.isArray(ev?.data) ? ev.data[0] : ev?.data;
  const jid = String(d?.key?.remoteJid ?? '');
  if (d?.key?.fromMe) return 0;
  if (!jid.endsWith('@g.us')) {
    // Conversa no privado: respostas automáticas por palavra-chave.
    if (/@(s\.whatsapp\.net|lid)$/.test(jid)) await responderPrivado(c, i, jid, textoDaMensagem(d.message), String(d?.pushName ?? '')).catch(() => {});
    return 0;
  }
  const origem = c.db.prepare('SELECT * FROM grupos WHERE instancia_id = ? AND jid = ?').get(i.id, jid) as any;
  if (!origem) return 0;
  // Espelhamento (v10): o grupo é origem de um espelhamento ligado? Então copia a mensagem e não faz a captura comum.
  const espelhada = await espelhar(c, i, origem, d).catch((e) => { console.error('espelho', (e as Error).message); return 0; });
  if (espelhada !== null) return espelhada;
  const g = origem.monitorar ? origem : null;
  if (!g || !planoDa(c.db, i.conta_id).captura) return 0;

  const links = extrairLinks(textoDaMensagem(d.message)).filter(lojaSuportada).slice(0, 3);
  const cfg = config(c.db, i.conta_id);
  let capturadas = 0;
  for (const link of links) {
    try {
      const o = await converterLink(c, i.conta_id, link);
      if (Number(cfg.desconto_minimo) > 0 && descontoPct(o.precoDe, o.precoPor) < Number(cfg.desconto_minimo)) continue;
      // Curadoria do nicho: categoria, palavras, preço máximo, nota e vendas.
      if (motivoRecusa(lerNicho(cfg.nicho).regras, o)) continue;
      const ja = c.db.prepare('SELECT 1 FROM ofertas WHERE conta_id = ? AND url_original = ?').get(i.conta_id, o.urlOriginal);
      const id = salvarOferta(c, i.conta_id, o, 'captura', g.nome);
      capturadas++;
      if (!ja && cfg.auto_publicar) {
        const of = oferta(c.db, i.conta_id, id);
        try { agendar(c, i.conta_id, { ofertaId: id, texto: textoOferta(c.db, i.conta_id, of), imagem: of.imagem, origem: 'captura' }); } catch { /* sem grupos de envio */ }
      }
    } catch { /* link que não deu para converter: ignora */ }
  }
  return capturadas;
}

// ---------------- Comissões ----------------

export async function sincronizarComissoes(c: Ctx, conta: number, dias = 30): Promise<number> {
  const cfg = config(c.db, conta);
  if (!cfg.shopee_app_id || !cfg.shopee_segredo) throw new ErroUso('Cadastre o AppID e a Senha da Open API da Shopee em Conectar plataformas');
  const fim = Math.floor(t(c) / 1000), inicio = fim - dias * 86400;
  const itens = await comissoesShopee({ appId: cfg.shopee_app_id, segredo: cfg.shopee_segredo }, inicio, fim, c.f);
  for (const it of itens) {
    c.db.prepare(`INSERT INTO comissoes (conta_id, plataforma, pedido, produto, valor_centavos, comissao_centavos, status, em) VALUES (?, 'shopee', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (conta_id, plataforma, pedido, produto) DO UPDATE SET valor_centavos = excluded.valor_centavos, comissao_centavos = excluded.comissao_centavos, status = excluded.status`)
      .run(conta, it.pedido, it.produto, it.valor, it.comissao, it.status, it.em);
  }
  return itens.length;
}

// ---------------- Painel ----------------

export function periodo(nome: string, agoraMs: number): { de: number; ate: number } {
  const ref = agoraMs + 1; // inclui o que aconteceu neste exato instante
  const hoje = inicioDoDia(ref), dia = 86_400_000;
  const d = new Date(agoraMs);
  switch (nome) {
    case 'hoje': return { de: hoje, ate: ref };
    case 'ontem': return { de: hoje - dia, ate: hoje };
    case '30d': return { de: hoje - 29 * dia, ate: ref };
    case 'mes': return { de: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), ate: ref };
    case 'mes-anterior': return { de: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), ate: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
    default: return { de: hoje - 6 * dia, ate: ref };
  }
}

const porDia = (de: number, ate: number) => {
  const dias: string[] = [];
  for (let x = inicioDoDia(de); x < ate; x += 86_400_000) dias.push(new Date(x).toISOString().slice(0, 10));
  return dias;
};
const diaLocal = (ms: number) => { const d = new Date(ms); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export function visaoGeral(c: Ctx, conta: number, nomePeriodo: string) {
  const { de, ate } = periodo(nomePeriodo, t(c));
  const db = c.db, p = planoDa(db, conta);
  const enviados = db.prepare("SELECT enviado_em FROM envios WHERE conta_id = ? AND status = 'enviado' AND enviado_em >= ? AND enviado_em < ?").all(conta, de, ate) as any[];
  const capt = db.prepare("SELECT criado_em FROM ofertas WHERE conta_id = ? AND origem = 'captura' AND criado_em >= ? AND criado_em < ?").all(conta, de, ate) as any[];
  const dias = porDia(de, ate).map((x) => diaLocal(new Date(x + 'T12:00:00').getTime()));
  const cliques = db.prepare('SELECT em FROM cliques WHERE conta_id = ? AND em >= ? AND em < ?').all(conta, de, ate) as any[];
  const serie = dias.map((dia) => ({
    dia,
    enviados: enviados.filter((e) => diaLocal(e.enviado_em) === dia).length,
    capturadas: capt.filter((e) => diaLocal(e.criado_em) === dia).length,
    cliques: cliques.filter((e) => diaLocal(e.em) === dia).length,
  }));
  // Ranking: cliques por oferta e por grupo, comparados com os envios no mesmo período.
  const topOfertas = db.prepare(`SELECT o.id, o.titulo, o.imagem, o.plataforma, COUNT(k.id) AS cliques,
      (SELECT COUNT(*) FROM envios e JOIN agendamentos a ON a.id = e.agendamento_id WHERE a.oferta_id = o.id AND e.status = 'enviado' AND e.enviado_em >= ? AND e.enviado_em < ?) AS envios
    FROM cliques k JOIN links l ON l.codigo = k.codigo JOIN ofertas o ON o.id = l.oferta_id
    WHERE k.conta_id = ? AND k.em >= ? AND k.em < ? GROUP BY o.id ORDER BY cliques DESC LIMIT 5`).all(de, ate, conta, de, ate);
  const topGrupos = db.prepare(`SELECT g.id, g.nome, g.participantes, COUNT(k.id) AS cliques,
      (SELECT COUNT(*) FROM envios e WHERE e.grupo_id = g.id AND e.status = 'enviado' AND e.enviado_em >= ? AND e.enviado_em < ?) AS envios
    FROM cliques k JOIN links l ON l.codigo = k.codigo JOIN grupos g ON g.id = l.grupo_id
    WHERE k.conta_id = ? AND k.em >= ? AND k.em < ? GROUP BY g.id ORDER BY cliques DESC LIMIT 5`).all(de, ate, conta, de, ate);
  const inst = db.prepare('SELECT status FROM instancias WHERE conta_id = ?').all(conta) as any[];
  const com = db.prepare("SELECT COALESCE(SUM(comissao_centavos),0) AS v FROM comissoes WHERE conta_id = ? AND status <> 'cancelado' AND em >= ? AND em < ?").get(conta, de, ate) as any;
  return {
    plano: p,
    enviados: enviados.length,
    numeros: { conectados: inst.filter((i) => i.status === 'conectado').length, total: inst.length, limite: p.numeros },
    pendentes: (db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE conta_id = ? AND status IN ('pendente','enviando')").get(conta) as any).n,
    capturadas: capt.length,
    comissao: Number(com.v),
    cliques: cliques.length,
    cliquesPorEnvio: enviados.length ? Math.round((cliques.length / enviados.length) * 100) / 100 : 0,
    topOfertas, topGrupos,
    gruposEnvio: (db.prepare('SELECT COUNT(*) AS n FROM grupos WHERE conta_id = ? AND enviar = 1').get(conta) as any).n,
    erros: (db.prepare("SELECT COUNT(*) AS n FROM envios WHERE conta_id = ? AND status = 'erro' AND enviar_em >= ? AND enviar_em < ?").get(conta, de, ate) as any).n,
    serie,
    porCategoria: porCategoria(db, conta, de, ate),
    proximos: db.prepare(`SELECT a.id, a.quando, a.status, o.titulo, o.imagem, o.plataforma FROM agendamentos a LEFT JOIN ofertas o ON o.id = a.oferta_id
      WHERE a.conta_id = ? AND a.status IN ('pendente','enviando') ORDER BY a.quando LIMIT 5`).all(conta),
  };
}

/** Envios e cliques por categoria no período: mostra o que o público do grupo compra. */
export function porCategoria(db: DB, conta: number, de: number, ate: number) {
  const env = db.prepare(`SELECT COALESCE(NULLIF(o.categoria, ''), 'outros') AS cat, COUNT(*) AS n FROM envios e JOIN agendamentos a ON a.id = e.agendamento_id
    JOIN ofertas o ON o.id = a.oferta_id WHERE e.conta_id = ? AND e.status = 'enviado' AND e.enviado_em >= ? AND e.enviado_em < ? GROUP BY cat`).all(conta, de, ate) as any[];
  const cli = db.prepare(`SELECT COALESCE(NULLIF(o.categoria, ''), 'outros') AS cat, COUNT(*) AS n
    FROM cliques k JOIN links l ON l.codigo = k.codigo JOIN ofertas o ON o.id = l.oferta_id WHERE k.conta_id = ? AND k.em >= ? AND k.em < ? GROUP BY cat`).all(conta, de, ate) as any[];
  return CATEGORIAS.map((c) => {
    const envios = Number(env.find((x) => x.cat === c.id)?.n ?? 0), cliques = Number(cli.find((x) => x.cat === c.id)?.n ?? 0);
    return { id: c.id, nome: nomeCategoria(c.id), emoji: c.emoji, envios, cliques, cliquesPorEnvio: envios ? Math.round((cliques / envios) * 100) / 100 : 0 };
  }).filter((x) => x.envios || x.cliques).sort((a, b) => b.cliquesPorEnvio - a.cliquesPorEnvio || b.cliques - a.cliques);
}

export function membros(c: Ctx, conta: number, nomePeriodo: string, grupo?: number) {
  const { de, ate } = periodo(nomePeriodo, t(c));
  const filtro = grupo ? ' AND grupo_id = ?' : '';
  const args: any[] = grupo ? [conta, de, ate, grupo] : [conta, de, ate];
  const ev = c.db.prepare(`SELECT tipo, qtd, em FROM membros_eventos WHERE conta_id = ? AND em >= ? AND em < ?${filtro}`).all(...args) as any[];
  const grupos = c.db.prepare(`SELECT id, nome, participantes FROM grupos WHERE conta_id = ? AND (enviar = 1 OR monitorar = 1)${grupo ? ' AND id = ?' : ''} ORDER BY participantes DESC`).all(...(grupo ? [conta, grupo] : [conta])) as any[];
  const total = grupos.reduce((s, g) => s + g.participantes, 0);
  const dias = porDia(de, ate).map((x) => diaLocal(new Date(x + 'T12:00:00').getTime()));
  const entrou = (d: string) => ev.filter((e) => e.tipo === 'entrou' && diaLocal(e.em) === d).reduce((s, e) => s + e.qtd, 0);
  const saiu = (d: string) => ev.filter((e) => e.tipo === 'saiu' && diaLocal(e.em) === d).reduce((s, e) => s + e.qtd, 0);
  const saldoTotal = ev.reduce((s, e) => s + (e.tipo === 'entrou' ? e.qtd : -e.qtd), 0);
  // Total de cada dia reconstruído de trás para frente a partir do total atual.
  let acumulado = total;
  const serie = dias.slice().reverse().map((d) => { const r = { dia: d, total: acumulado, entrou: entrou(d), saiu: saiu(d) }; acumulado -= r.entrou - r.saiu; return r; }).reverse();
  const saidas = ev.filter((e) => e.tipo === 'saiu').reduce((s, e) => s + e.qtd, 0);
  return {
    grupos: grupos.length, total, saldoDiario: dias.length ? Math.round((saldoTotal / dias.length) * 10) / 10 : 0,
    churnDiario: total ? Math.round((saidas / dias.length / total) * 1000) / 10 : 0,
    serie, lista: grupos,
  };
}

export function resumoComissoes(c: Ctx, conta: number, nomePeriodo: string, status = '') {
  const { de, ate } = periodo(nomePeriodo, t(c));
  const linhas = c.db.prepare(`SELECT * FROM comissoes WHERE conta_id = ? AND em >= ? AND em < ?${status ? ' AND status = ?' : ''} ORDER BY em DESC`)
    .all(...(status ? [conta, de, ate, status] : [conta, de, ate])) as any[];
  const validos = linhas.filter((l) => l.status !== 'cancelado');
  const pedidos = new Set(validos.map((l) => l.pedido)).size;
  const gmv = validos.reduce((s, l) => s + l.valor_centavos, 0);
  return {
    comissao: validos.reduce((s, l) => s + l.comissao_centavos, 0),
    gmv, pedidos, ticket: pedidos ? Math.round(gmv / pedidos) : 0,
    cancelados: new Set(linhas.filter((l) => l.status === 'cancelado').map((l) => l.pedido)).size,
    concluidos: linhas.filter((l) => l.status === 'concluido').length,
    pendentes: linhas.filter((l) => l.status === 'pendente').length,
    taxa: linhas.length ? Math.round((validos.length / linhas.length) * 1000) / 10 : 0,
    linhas: linhas.slice(0, 100),
  };
}

// ---------------- Vitrine e horários automáticos ----------------

/** "9h, 12:30, 18:00" → ["09:00", "12:30", "18:00"] (sem repetidos, em ordem). */
export function lerHorarios(txt: string): string[] {
  const lista = String(txt ?? '').split(/[,;\s]+/).map((p) => {
    const m = p.trim().match(/^(\d{1,2})(?:[:h](\d{2})?)?h?$/i);
    if (!m) return '';
    const h = Number(m[1]), min = Number(m[2] ?? 0);
    return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : '';
  }).filter(Boolean);
  return [...new Set(lista)].sort();
}

const horaMin = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/**
 * Em cada horário configurado, a oferta mais antiga da vitrine vai para todos os grupos de envio
 * e sai da vitrine. Um horário que passou há mais de 15 minutos (servidor desligado) é ignorado.
 */
export function rodarHorarios(c: Ctx): number {
  const contas = c.db.prepare("SELECT conta_id, horarios_auto, ultimo_auto, nicho FROM config_conta WHERE horarios_auto <> ''").all() as any[];
  let publicadas = 0;
  const agoraHm = horaMin(t(c)), hoje = diaLocal(t(c));
  for (const cfg of contas) {
    const passados = lerHorarios(cfg.horarios_auto).filter((h) => h <= agoraHm);
    const ultimo = passados.at(-1);
    if (!ultimo) continue;
    const chave = `${hoje} ${ultimo}`;
    if (cfg.ultimo_auto >= chave) continue;
    c.db.prepare('UPDATE config_conta SET ultimo_auto = ? WHERE conta_id = ?').run(chave, cfg.conta_id);
    const [h, m] = ultimo.split(':').map(Number);
    const marcado = new Date(t(c)); marcado.setHours(h, m, 0, 0);
    if (t(c) - marcado.getTime() > 15 * 60_000) continue;
    // Coleção do dia primeiro (ex.: terça = beleza); sem oferta dela, a mais antiga da vitrine.
    const col = colecaoDoDia(lerNicho(cfg.nicho), t(c));
    const fila = c.db.prepare(`SELECT * FROM ofertas WHERE conta_id = ? AND vitrine = 1 AND esgotada = 0
      ORDER BY ${col ? 'CASE WHEN categoria = ? THEN 0 ELSE 1 END, ' : ''}vitrine_em, id LIMIT 60`).all(...(col ? [cfg.conta_id, col] : [cfg.conta_id])) as any[];
    if (!fila.length) continue;
    const envio = c.db.prepare('SELECT id, categorias, preco_max FROM grupos WHERE conta_id = ? AND enviar = 1').all(cfg.conta_id) as any[];
    if (!envio.some(temTema)) {
      const o = fila[0];
      try {
        agendar(c, cfg.conta_id, { ofertaId: o.id, texto: textoOferta(c.db, cfg.conta_id, o), imagem: o.imagem, origem: 'vitrine' });
        c.db.prepare('UPDATE ofertas SET vitrine = 0 WHERE id = ?').run(o.id);
        publicadas++;
      } catch { /* sem grupos de envio: tenta no próximo horário */ }
      continue;
    }
    // Grupos com tema (v10): cada horário tenta mandar uma oferta para cada grupo, a que combina com o tema dele.
    let faltam = envio.slice();
    for (const o of fila) {
      if (!faltam.length) break;
      const alvo = faltam.filter((g) => aceitaOferta(g, o));
      if (!alvo.length) continue;
      try {
        agendar(c, cfg.conta_id, { ofertaId: o.id, texto: textoOferta(c.db, cfg.conta_id, o), imagem: o.imagem, origem: 'vitrine', grupos: alvo.map((g) => Number(g.id)) });
        c.db.prepare('UPDATE ofertas SET vitrine = 0 WHERE id = ?').run(o.id);
        publicadas++;
        faltam = faltam.filter((g) => !alvo.includes(g));
      } catch { break; }
    }
  }
  return publicadas;
}

export function alternarVitrine(db: DB, conta: number, id: number, ligada: boolean) {
  oferta(db, conta, id);
  db.prepare('UPDATE ofertas SET vitrine = ?, vitrine_em = ? WHERE id = ?').run(ligada ? 1 : 0, ligada ? Date.now() : 0, id);
}

// ---------------- Avisos e resumo diário ----------------

export interface Aviso { nivel: 'erro' | 'atencao' | 'info'; texto: string; link: string }

export function avisos(c: Ctx, conta: number): Aviso[] {
  const db = c.db, cfg = config(db, conta), lista: Aviso[] = [];
  const inst = db.prepare('SELECT id, nome, status FROM instancias WHERE conta_id = ?').all(conta) as any[];
  for (const i of inst.filter((i) => i.status !== 'conectado'))
    lista.push({ nivel: 'erro', texto: `O número "${i.nome}" está desconectado. Os envios dele vão falhar até você ler o QR Code de novo.`, link: '#whatsapp' });
  if (!inst.length) lista.push({ nivel: 'info', texto: 'Conecte um número de WhatsApp para começar a enviar.', link: '#whatsapp' });
  else if (!(db.prepare('SELECT 1 FROM grupos WHERE conta_id = ? AND enviar = 1 LIMIT 1').get(conta)))
    lista.push({ nivel: 'atencao', texto: 'Nenhum grupo está com o envio ligado.', link: '#grupos' });
  const erros = (db.prepare("SELECT COUNT(*) AS n FROM envios WHERE conta_id = ? AND status = 'erro' AND enviar_em > ?").get(conta, t(c) - 86_400_000) as any).n;
  if (erros) lista.push({ nivel: 'atencao', texto: `${erros} envio(s) com erro nas últimas 24 horas.`, link: '#agendamentos' });
  if (Number(cfg.pausado)) lista.unshift({ nivel: 'erro', texto: 'Os envios estão pausados. Nada sai até você retomar.', link: '#visao' });
  for (const i of inst.filter((i) => i.status === 'conectado')) {
    const hoje = (db.prepare("SELECT COUNT(*) AS n FROM envios WHERE instancia_id = ? AND status = 'enviado' AND enviado_em >= ?").get(i.id, inicioDoDia(t(c))) as any).n;
    const aq = limiteDoNumero(db, conta, i.id, t(c));
    if (hoje >= aq.limite * 0.8) lista.push({ nivel: 'atencao', texto: `"${i.nome}" já usou ${hoje} de ${aq.limite} envios de hoje.`, link: '#whatsapp' });
    if (aq.aquecendo) lista.push({ nivel: 'info', texto: `"${i.nome}" está em aquecimento (dia ${aq.dia}): até ${aq.limite} envios por dia, subindo a cada semana.`, link: '#whatsapp' });
  }
  const barrados = (db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE conta_id = ? AND status = 'cancelado' AND (obs LIKE 'Preço subiu%' OR obs LIKE 'Produto indisponível%') AND quando > ?").get(conta, t(c) - 86_400_000) as any).n;
  if (barrados) lista.push({ nivel: 'info', texto: `${barrados} oferta(s) não foram enviadas porque o preço subiu ou o produto acabou.`, link: '#agendamentos' });
  if (lerHorarios(cfg.horarios_auto).length && !(db.prepare('SELECT 1 FROM ofertas WHERE conta_id = ? AND vitrine = 1 AND esgotada = 0 LIMIT 1').get(conta)))
    lista.push({ nivel: 'atencao', texto: 'A vitrine está vazia: os horários automáticos não têm o que publicar.', link: '#ofertas' });
  lista.push(...avisosEntradas(c, conta));
  if ((!cfg.shopee_app_id || !cfg.shopee_segredo) && db.prepare("SELECT 1 FROM ofertas WHERE conta_id = ? AND plataforma = 'shopee' LIMIT 1").get(conta))
    lista.push({ nivel: 'info', texto: 'Cadastre a Open API da Shopee para gerar seus links de afiliado e ver comissões.', link: '#config' });
  return lista;
}

export function textoResumo(c: Ctx, conta: number): string {
  const db = c.db, { de, ate } = periodo('hoje', t(c));
  const n = (sql: string, ...a: any[]) => Number((db.prepare(sql).get(...a) as any).n ?? 0);
  const enviados = n("SELECT COUNT(*) AS n FROM envios WHERE conta_id = ? AND status = 'enviado' AND enviado_em >= ? AND enviado_em < ?", conta, de, ate);
  const cliques = n('SELECT COUNT(*) AS n FROM cliques WHERE conta_id = ? AND em >= ? AND em < ?', conta, de, ate);
  const capt = n("SELECT COUNT(*) AS n FROM ofertas WHERE conta_id = ? AND origem = 'captura' AND criado_em >= ? AND criado_em < ?", conta, de, ate);
  const com = n("SELECT COALESCE(SUM(comissao_centavos),0) AS n FROM comissoes WHERE conta_id = ? AND status <> 'cancelado' AND em >= ? AND em < ?", conta, de, ate);
  const entrou = n("SELECT COALESCE(SUM(qtd),0) AS n FROM membros_eventos WHERE conta_id = ? AND tipo = 'entrou' AND em >= ? AND em < ?", conta, de, ate);
  const saiu = n("SELECT COALESCE(SUM(qtd),0) AS n FROM membros_eventos WHERE conta_id = ? AND tipo = 'saiu' AND em >= ? AND em < ?", conta, de, ate);
  const pend = n("SELECT COUNT(*) AS n FROM agendamentos WHERE conta_id = ? AND status = 'pendente'", conta);
  const vitrine = n('SELECT COUNT(*) AS n FROM ofertas WHERE conta_id = ? AND vitrine = 1 AND esgotada = 0', conta);
  const top = db.prepare(`SELECT o.titulo, COUNT(k.id) AS n FROM cliques k JOIN links l ON l.codigo = k.codigo JOIN ofertas o ON o.id = l.oferta_id
    WHERE k.conta_id = ? AND k.em >= ? AND k.em < ? GROUP BY o.id ORDER BY n DESC LIMIT 1`).get(conta, de, ate) as any;
  const linhas = [
    '📊 *Resumo do Ofertix: hoje*', '',
    `📤 ${enviados} mensagens enviadas`,
    `👆 ${cliques} cliques${enviados ? ` (${(cliques / enviados).toFixed(1).replace('.', ',')} por mensagem)` : ''}`,
    `🧲 ${capt} ofertas capturadas`,
    `💰 ${reais(com) || 'R$ 0,00'} em comissões registradas`,
    `👥 +${entrou} / −${saiu} membros`,
  ];
  if (top) linhas.push('', `🏆 Mais clicada: ${top.titulo} (${top.n})`);
  linhas.push('', `🗓️ ${pend} agendamento(s) pendente(s) · 🛍️ ${vitrine} na vitrine`);
  const av = avisos(c, conta).filter((a) => a.nivel !== 'info');
  if (av.length) linhas.push('', ...av.map((a) => `⚠️ ${a.texto}`));
  return linhas.join('\n');
}

/** Uma vez por dia, no horário escolhido, manda o resumo para o WhatsApp do dono da conta. */
export async function rodarResumos(c: Ctx): Promise<number> {
  const contas = c.db.prepare("SELECT conta_id, resumo_numero, resumo_hora, ultimo_resumo FROM config_conta WHERE resumo_numero <> ''").all() as any[];
  const hoje = diaLocal(t(c)), hora = new Date(t(c)).getHours();
  let enviados = 0;
  for (const cfg of contas) {
    if (cfg.ultimo_resumo === hoje || hora < Number(cfg.resumo_hora)) continue;
    const inst = c.db.prepare("SELECT chave FROM instancias WHERE conta_id = ? AND status = 'conectado' ORDER BY id LIMIT 1").get(cfg.conta_id) as any;
    if (!inst) continue;
    c.db.prepare('UPDATE config_conta SET ultimo_resumo = ? WHERE conta_id = ?').run(hoje, cfg.conta_id);
    const numero = String(cfg.resumo_numero).replace(/\D/g, '');
    try { await c.wpp.enviar(inst.chave, `${numero}@s.whatsapp.net`, textoResumo(c, cfg.conta_id)); enviados++; }
    catch (e) { console.error('resumo', cfg.conta_id, (e as Error).message); }
  }
  return enviados;
}

// ---------------- Exportar (CSV para Excel) ----------------

const celula = (v: unknown) => {
  const s = v == null ? '' : String(v);
  const seguro = typeof v === 'string' && /^[=+\-@]/.test(s) ? `'${s}` : s; // evita fórmula ao abrir no Excel
  return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};
export const csv = (linhas: unknown[][]) => '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
const dataHora = (ms: number | null) => (ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const valor = (cent: number) => (cent / 100).toFixed(2).replace('.', ',');

export function csvEnvios(c: Ctx, conta: number, nomePeriodo: string): string {
  const { de, ate } = periodo(nomePeriodo, t(c));
  const linhas = c.db.prepare(`SELECT e.enviar_em, e.enviado_em, e.status, e.erro, g.nome AS grupo, o.titulo, o.plataforma, a.origem,
      (SELECT COUNT(*) FROM links l JOIN cliques k ON k.codigo = l.codigo WHERE l.agendamento_id = e.agendamento_id AND l.grupo_id = e.grupo_id) AS cliques
    FROM envios e JOIN grupos g ON g.id = e.grupo_id JOIN agendamentos a ON a.id = e.agendamento_id LEFT JOIN ofertas o ON o.id = a.oferta_id
    WHERE e.conta_id = ? AND e.enviar_em >= ? AND e.enviar_em < ? ORDER BY e.enviar_em`).all(conta, de, ate) as any[];
  return csv([['Data', 'Grupo', 'Oferta', 'Loja', 'Origem', 'Situação', 'Cliques', 'Erro'],
    ...linhas.map((l) => [dataHora(l.enviado_em ?? l.enviar_em), l.grupo, l.titulo ?? '', NOME_PLATAFORMA[l.plataforma as Plataforma] ?? '', l.origem, l.status, l.cliques, l.erro])]);
}

export function csvComissoes(c: Ctx, conta: number, nomePeriodo: string): string {
  const { de, ate } = periodo(nomePeriodo, t(c));
  const linhas = c.db.prepare('SELECT * FROM comissoes WHERE conta_id = ? AND em >= ? AND em < ? ORDER BY em').all(conta, de, ate) as any[];
  return csv([['Data', 'Loja', 'Pedido', 'Produto', 'Valor (R$)', 'Comissão (R$)', 'Situação'],
    ...linhas.map((l) => [dataHora(l.em), NOME_PLATAFORMA[l.plataforma as Plataforma] ?? l.plataforma, l.pedido, l.produto, valor(l.valor_centavos), valor(l.comissao_centavos), l.status])]);
}
