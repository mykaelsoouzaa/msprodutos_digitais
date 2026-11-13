// Melhorias da v5: primeiros passos, aquecimento do número, pausa geral, recorrentes, boas-vindas,
// campeãs, ofertas parecidas, histórico de preço, arquivamento, melhores horários, meta, funil,
// grupos cansados, resumo semanal e vitrine pública.
import { type DB } from './db.ts';
import { type Ctx, ErroUso, agendar, config, planoDa, periodo, novoCodigo, lerHorarios } from './servico.ts';
import { reais } from './mensagem.ts';
import { lerNicho } from './nicho.ts';
import { comAvisoAmazon } from './regras.ts';

const DIA = 86_400_000;
const t = (c: Ctx) => (c.agora ?? Date.now)();
const diaLocal = (ms: number) => { const d = new Date(ms); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const n = (db: DB, sql: string, ...a: any[]) => Number((db.prepare(sql).get(...a) as any)?.n ?? 0);

// ---------------- 1. Primeiros passos ----------------

export function primeirosPassos(db: DB, conta: number) {
  const cfg = config(db, conta);
  const passos = [
    { id: 'numero', texto: 'Conectar um número de WhatsApp', link: '#whatsapp', feito: n(db, "SELECT COUNT(*) AS n FROM instancias WHERE conta_id = ? AND status = 'conectado'", conta) > 0 },
    { id: 'grupos', texto: 'Ligar o envio em pelo menos um grupo', link: '#grupos', feito: n(db, 'SELECT COUNT(*) AS n FROM grupos WHERE conta_id = ? AND enviar = 1', conta) > 0 },
    { id: 'afiliado', texto: 'Cadastrar seu link de afiliado (Shopee, Amazon ou Mercado Livre)', link: '#plataformas', feito: !!(cfg.shopee_app_id || cfg.amazon_tag || cfg.ml_modelo) },
    { id: 'nicho', texto: 'Escolher o nicho e a curadoria', link: '#nicho', feito: !!String(cfg.nicho ?? '').trim() },
    { id: 'entrada', texto: 'Criar o link de entrada para a bio', link: '#entradas', feito: n(db, 'SELECT COUNT(*) AS n FROM entradas WHERE conta_id = ?', conta) > 0 },
    { id: 'envio', texto: 'Publicar a primeira oferta', link: '#ofertas', feito: n(db, "SELECT COUNT(*) AS n FROM envios WHERE conta_id = ? AND status = 'enviado'", conta) > 0 },
  ];
  return { passos, feitos: passos.filter((p) => p.feito).length, total: passos.length };
}

// ---------------- 2. Aquecimento do número ----------------

/** Limite diário de um número novo: começa baixo e sobe por semana, até o limite do plano. */
export const ETAPAS_AQUECIMENTO: [number, number][] = [[7, 40], [14, 100], [21, 200]];
export function limiteDoNumero(db: DB, conta: number, instanciaId: number, agoraMs: number): { limite: number; aquecendo: boolean; dia: number } {
  const lim = planoDa(db, conta).enviosDia;
  const cfg = config(db, conta);
  const i = db.prepare('SELECT criado_em FROM instancias WHERE id = ?').get(instanciaId) as any;
  const dia = i ? Math.floor((agoraMs - Number(i.criado_em)) / DIA) + 1 : 99;
  if (!Number(cfg.aquecimento ?? 1)) return { limite: lim, aquecendo: false, dia };
  for (const [ate, max] of ETAPAS_AQUECIMENTO) if (dia <= ate) return { limite: Math.min(lim, max), aquecendo: max < lim, dia };
  return { limite: lim, aquecendo: false, dia };
}

export function numerosComLimite(c: Ctx, conta: number) {
  const inicio = new Date(t(c)); inicio.setHours(0, 0, 0, 0);
  return (c.db.prepare('SELECT id, nome, status, numero, criado_em FROM instancias WHERE conta_id = ? ORDER BY id').all(conta) as any[]).map((i) => ({
    ...i, ...limiteDoNumero(c.db, conta, i.id, t(c)),
    hoje: n(c.db, "SELECT COUNT(*) AS n FROM envios WHERE instancia_id = ? AND status = 'enviado' AND enviado_em >= ?", i.id, inicio.getTime()),
  }));
}

// ---------------- 3. Pausa geral ----------------

export const pausada = (db: DB, conta: number) => !!Number(config(db, conta)?.pausado ?? 0);
export function pausar(db: DB, conta: number, ligada: boolean) {
  db.prepare('UPDATE config_conta SET pausado = ? WHERE conta_id = ?').run(ligada ? 1 : 0, conta);
}

// ---------------- 4. Envio de teste ----------------

export async function enviarTeste(c: Ctx, conta: number, texto: string, imagem = '') {
  const cfg = config(c.db, conta);
  const numero = String(cfg.resumo_numero ?? '').replace(/\D/g, '');
  if (!numero) throw new ErroUso('Cadastre o seu número em Configurações › Resumo diário para receber o teste');
  const inst = c.db.prepare("SELECT chave FROM instancias WHERE conta_id = ? AND status = 'conectado' ORDER BY id LIMIT 1").get(conta) as any;
  if (!inst) throw new ErroUso('Conecte um número de WhatsApp para enviar o teste');
  if (!String(texto ?? '').trim()) throw new ErroUso('Escreva a mensagem');
  await c.wpp.enviar(inst.chave, `${numero}@s.whatsapp.net`, `🧪 Teste do Ofertix\n\n${texto}`, /^https?:\/\//.test(imagem) ? imagem : undefined);
}

// ---------------- 5. Mensagens recorrentes ----------------

export function listarRecorrentes(db: DB, conta: number) {
  return (db.prepare('SELECT * FROM recorrentes WHERE conta_id = ? ORDER BY hora, id').all(conta) as any[]).map((r) => ({ ...r, dias: String(r.dias).split(',').filter(Boolean).map(Number) }));
}
export function salvarRecorrente(db: DB, conta: number, d: any, id?: number) {
  const texto = String(d.texto ?? '').trim().slice(0, 1500);
  if (!texto) throw new ErroUso('Escreva a mensagem');
  const hora = lerHorarios(String(d.hora ?? ''))[0];
  if (!hora) throw new ErroUso('Escolha o horário');
  const dias = [...new Set((Array.isArray(d.dias) ? d.dias : []).map(Number).filter((x: number) => Number.isInteger(x) && x >= 0 && x <= 6))].sort();
  if (!dias.length) throw new ErroUso('Escolha pelo menos um dia');
  if (n(db, 'SELECT COUNT(*) AS n FROM recorrentes WHERE conta_id = ?', conta) >= 10 && !id) throw new ErroUso('Use no máximo 10 mensagens recorrentes');
  const nome = String(d.nome ?? '').trim().slice(0, 60) || 'Mensagem recorrente';
  if (id) {
    const r = db.prepare('UPDATE recorrentes SET nome = ?, texto = ?, hora = ?, dias = ? WHERE id = ? AND conta_id = ?').run(nome, texto, hora, dias.join(','), id, conta);
    if (!Number(r.changes)) throw new ErroUso('Mensagem não encontrada', 404);
    return id;
  }
  return Number(db.prepare('INSERT INTO recorrentes (conta_id, nome, texto, hora, dias, ativo, ultimo, criado_em) VALUES (?, ?, ?, ?, ?, 1, \'\', ?)').run(conta, nome, texto, hora, dias.join(','), Date.now()).lastInsertRowid);
}

/** No dia e horário marcados, a mensagem vira um agendamento para todos os grupos de envio. */
export function rodarRecorrentes(c: Ctx): number {
  const agora = t(c), hoje = diaLocal(agora), dow = new Date(agora).getDay(), agoraHm = hm(agora);
  let feitos = 0;
  for (const r of c.db.prepare('SELECT * FROM recorrentes WHERE ativo = 1').all() as any[]) {
    if (pausada(c.db, r.conta_id)) continue;
    if (!String(r.dias).split(',').map(Number).includes(dow) || r.hora > agoraHm || r.ultimo === hoje) continue;
    c.db.prepare('UPDATE recorrentes SET ultimo = ? WHERE id = ?').run(hoje, r.id);
    const [h, m] = String(r.hora).split(':').map(Number);
    const marcado = new Date(agora); marcado.setHours(h!, m!, 0, 0);
    if (agora - marcado.getTime() > 15 * 60_000) continue; // servidor estava desligado no horário
    try { agendar(c, r.conta_id, { texto: r.texto, origem: 'recorrente' }); feitos++; } catch { /* sem grupos de envio */ }
  }
  return feitos;
}

// ---------------- 6. Boas-vindas ----------------

/** Junta quem entrou e manda uma boas-vindas por grupo, no máximo uma a cada N minutos. */
export function anotarEntrada(db: DB, grupoId: number, qtd: number) {
  db.prepare('UPDATE grupos SET bv_pendente = bv_pendente + ? WHERE id = ?').run(qtd, grupoId);
}
export function rodarBoasVindas(c: Ctx): number {
  let feitos = 0;
  const lista = c.db.prepare(`SELECT g.id, g.conta_id, g.nome, g.bv_ultimo, g.bv_pendente, k.boas_vindas, k.boas_vindas_min FROM grupos g JOIN config_conta k ON k.conta_id = g.conta_id
    WHERE g.bv_pendente > 0 AND g.enviar = 1 AND k.boas_vindas <> ''`).all() as any[];
  for (const g of lista) {
    if (pausada(c.db, g.conta_id)) continue;
    if (t(c) - Number(g.bv_ultimo) < Math.max(10, Number(g.boas_vindas_min) || 60) * 60_000) continue;
    c.db.prepare('UPDATE grupos SET bv_pendente = 0, bv_ultimo = ? WHERE id = ?').run(t(c), g.id);
    const texto = String(g.boas_vindas).replace(/\{grupo\}/g, g.nome).replace(/\{novas\}/g, String(g.bv_pendente));
    try { agendar(c, g.conta_id, { texto, grupos: [g.id], origem: 'boas-vindas' }); feitos++; } catch { /* grupo saiu do envio */ }
  }
  return feitos;
}

// ---------------- 9. Campeãs ----------------

export function reenviarCampeas(c: Ctx, conta: number, nomePeriodo: string, quantas = 5): number {
  const { de, ate } = periodo(nomePeriodo, t(c));
  const top = c.db.prepare(`SELECT o.id FROM cliques k JOIN links l ON l.codigo = k.codigo JOIN ofertas o ON o.id = l.oferta_id
    WHERE k.conta_id = ? AND k.em >= ? AND k.em < ? AND o.esgotada = 0 AND o.vitrine = 0 GROUP BY o.id ORDER BY COUNT(*) DESC LIMIT ?`).all(conta, de, ate, quantas) as any[];
  top.forEach((o, i) => c.db.prepare('UPDATE ofertas SET vitrine = 1, vitrine_em = ?, arquivada = 0 WHERE id = ?').run(t(c) + i, o.id));
  return top.length;
}

// ---------------- 10. Ofertas parecidas ----------------

const palavras = (s: string) => new Set(String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((p) => p.length > 2));
export function semelhanca(a: string, b: string) {
  const x = palavras(a), y = palavras(b);
  if (!x.size || !y.size) return 0;
  let comum = 0; for (const p of x) if (y.has(p)) comum++;
  return comum / (x.size + y.size - comum);
}
export function parecidas(db: DB, conta: number, id: number) {
  const o = db.prepare('SELECT id, titulo FROM ofertas WHERE id = ? AND conta_id = ?').get(id, conta) as any;
  if (!o?.titulo) return [];
  return (db.prepare('SELECT id, titulo, preco_por, plataforma, criado_em FROM ofertas WHERE conta_id = ? AND id <> ? ORDER BY criado_em DESC LIMIT 500').all(conta, id) as any[])
    .map((x) => ({ ...x, s: semelhanca(o.titulo, x.titulo) })).filter((x) => x.s >= 0.6).sort((a, b) => b.s - a.s).slice(0, 3)
    .map(({ s, ...x }) => x);
}

// ---------------- 11. Histórico de preço ----------------

export function anotarPreco(db: DB, ofertaId: number, preco: number | null | undefined, em: number) {
  if (!preco) return;
  const u = db.prepare('SELECT preco_por FROM precos WHERE oferta_id = ? ORDER BY em DESC, id DESC LIMIT 1').get(ofertaId) as any;
  if (u && Number(u.preco_por) === preco) return;
  db.prepare('INSERT INTO precos (oferta_id, preco_por, em) VALUES (?, ?, ?)').run(ofertaId, preco, em);
}
export function historicoPreco(db: DB, conta: number, id: number) {
  const o = db.prepare('SELECT id FROM ofertas WHERE id = ? AND conta_id = ?').get(id, conta);
  if (!o) throw new ErroUso('Oferta não encontrada', 404);
  const lista = db.prepare('SELECT preco_por, em FROM precos WHERE oferta_id = ? ORDER BY em').all(id) as any[];
  const v = lista.map((p) => Number(p.preco_por));
  return { lista, menor: v.length ? Math.min(...v) : null, maior: v.length ? Math.max(...v) : null };
}

// ---------------- 13. Arquivamento ----------------

/** Ofertas fora da vitrine, sem envio nem agendamento pendente há N dias, saem da lista (continuam no banco). */
export function rodarArquivamento(c: Ctx): number {
  let total = 0;
  for (const k of c.db.prepare('SELECT conta_id, arquivar_dias FROM config_conta WHERE arquivar_dias > 0').all() as any[]) {
    const limite = t(c) - Number(k.arquivar_dias) * DIA;
    const r = c.db.prepare(`UPDATE ofertas SET arquivada = 1 WHERE conta_id = ? AND arquivada = 0 AND vitrine = 0 AND criado_em < ?
      AND NOT EXISTS (SELECT 1 FROM agendamentos a WHERE a.oferta_id = ofertas.id AND (a.status IN ('pendente','enviando') OR a.quando >= ?))`).run(k.conta_id, limite, limite);
    total += Number(r.changes);
  }
  return total;
}

// ---------------- 14. Melhores horários ----------------

/** Cliques por envio em cada dia da semana e hora, pela hora em que a mensagem saiu (últimos 30 dias). */
export function melhoresHorarios(c: Ctx, conta: number) {
  const de = t(c) - 30 * DIA;
  const envios = c.db.prepare('SELECT l.codigo, l.criado_em, (SELECT COUNT(*) FROM cliques k WHERE k.codigo = l.codigo) AS cliques FROM links l WHERE l.conta_id = ? AND l.criado_em >= ? AND l.grupo_id IS NOT NULL').all(conta, de) as any[];
  const grade = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ envios: 0, cliques: 0 })));
  const hora = Array.from({ length: 24 }, () => ({ envios: 0, cliques: 0 }));
  for (const e of envios) {
    const d = new Date(Number(e.criado_em));
    grade[d.getDay()]![d.getHours()]!.envios++; grade[d.getDay()]![d.getHours()]!.cliques += Number(e.cliques);
    hora[d.getHours()]!.envios++; hora[d.getHours()]!.cliques += Number(e.cliques);
  }
  const taxa = (x: { envios: number; cliques: number }) => (x.envios ? Math.round((x.cliques / x.envios) * 100) / 100 : 0);
  const minimo = Math.max(3, Math.round(envios.length / 100));
  const sugestao = hora.map((x, h) => ({ h, taxa: taxa(x), envios: x.envios })).filter((x) => x.envios >= minimo)
    .sort((a, b) => b.taxa - a.taxa).slice(0, 5).map((x) => `${String(x.h).padStart(2, '0')}:00`).sort();
  return { grade: grade.map((linha) => linha.map(taxa)), envios: envios.length, sugestao };
}

// ---------------- 15 e 16. Meta e funil ----------------

export function metaEFunil(c: Ctx, conta: number, nomePeriodo: string) {
  const db = c.db, cfg = config(db, conta);
  const ini = new Date(t(c)); ini.setDate(1); ini.setHours(0, 0, 0, 0);
  const doMes = n(db, "SELECT COALESCE(SUM(comissao_centavos),0) AS n FROM comissoes WHERE conta_id = ? AND status <> 'cancelado' AND em >= ?", conta, ini.getTime());
  const { de, ate } = periodo(nomePeriodo, t(c));
  return {
    meta: { valor: Number(cfg.meta_comissao) || 0, atingido: doMes, pct: Number(cfg.meta_comissao) ? Math.round((doMes / Number(cfg.meta_comissao)) * 100) : null },
    funil: {
      envios: n(db, "SELECT COUNT(*) AS n FROM envios WHERE conta_id = ? AND status = 'enviado' AND enviado_em >= ? AND enviado_em < ?", conta, de, ate),
      cliques: n(db, 'SELECT COUNT(*) AS n FROM cliques WHERE conta_id = ? AND em >= ? AND em < ?', conta, de, ate),
      pedidos: n(db, "SELECT COUNT(DISTINCT pedido) AS n FROM comissoes WHERE conta_id = ? AND status <> 'cancelado' AND em >= ? AND em < ?", conta, de, ate),
      comissao: n(db, "SELECT COALESCE(SUM(comissao_centavos),0) AS n FROM comissoes WHERE conta_id = ? AND status <> 'cancelado' AND em >= ? AND em < ?", conta, de, ate),
    },
  };
}

// ---------------- 17. Grupos cansados ----------------

/** Saídas a cada 100 mensagens enviadas, por grupo: acima de 2 é sinal de excesso. */
export function gruposCansados(c: Ctx, conta: number, nomePeriodo: string) {
  const { de, ate } = periodo(nomePeriodo, t(c));
  return (c.db.prepare(`SELECT g.id, g.nome, g.participantes,
      (SELECT COUNT(*) FROM envios e WHERE e.grupo_id = g.id AND e.status = 'enviado' AND e.enviado_em >= ? AND e.enviado_em < ?) AS envios,
      (SELECT COALESCE(SUM(qtd),0) FROM membros_eventos m WHERE m.grupo_id = g.id AND m.tipo = 'saiu' AND m.em >= ? AND m.em < ?) AS saidas
    FROM grupos g WHERE g.conta_id = ? AND g.enviar = 1`).all(de, ate, de, ate, conta) as any[])
    .map((g) => ({ ...g, porCem: g.envios ? Math.round((g.saidas / g.envios) * 1000) / 10 : 0 }))
    .map((g) => ({ ...g, nivel: g.envios < 10 ? 'pouco' : g.porCem > 4 ? 'alto' : g.porCem > 2 ? 'medio' : 'ok' }))
    .sort((a, b) => b.porCem - a.porCem);
}

// ---------------- 18. Resumo semanal ----------------

export function textoResumoSemana(c: Ctx, conta: number): string {
  const db = c.db, { de, ate } = periodo('7d', t(c));
  const env = n(db, "SELECT COUNT(*) AS n FROM envios WHERE conta_id = ? AND status = 'enviado' AND enviado_em >= ? AND enviado_em < ?", conta, de, ate);
  const cli = n(db, 'SELECT COUNT(*) AS n FROM cliques WHERE conta_id = ? AND em >= ? AND em < ?', conta, de, ate);
  const com = n(db, "SELECT COALESCE(SUM(comissao_centavos),0) AS n FROM comissoes WHERE conta_id = ? AND status <> 'cancelado' AND em >= ? AND em < ?", conta, de, ate);
  const ent = n(db, "SELECT COALESCE(SUM(qtd),0) AS n FROM membros_eventos WHERE conta_id = ? AND tipo = 'entrou' AND em >= ? AND em < ?", conta, de, ate);
  const sai = n(db, "SELECT COALESCE(SUM(qtd),0) AS n FROM membros_eventos WHERE conta_id = ? AND tipo = 'saiu' AND em >= ? AND em < ?", conta, de, ate);
  const top = db.prepare(`SELECT o.titulo, COUNT(k.id) AS n FROM cliques k JOIN links l ON l.codigo = k.codigo JOIN ofertas o ON o.id = l.oferta_id
    WHERE k.conta_id = ? AND k.em >= ? AND k.em < ? GROUP BY o.id ORDER BY n DESC LIMIT 3`).all(conta, de, ate) as any[];
  const h = melhoresHorarios(c, conta).sugestao;
  const cans = gruposCansados(c, conta, '7d').filter((g) => g.nivel === 'alto');
  const linhas = ['📅 *Resumo da semana no Ofertix*', '', `📤 ${env} mensagens · 👆 ${cli} cliques${env ? ` (${(cli / env).toFixed(1).replace('.', ',')} por mensagem)` : ''}`,
    `💰 ${reais(com) || 'R$ 0,00'} em comissões`, `👥 +${ent} / −${sai} membros (saldo ${ent - sai >= 0 ? '+' : ''}${ent - sai})`];
  if (top.length) linhas.push('', '🏆 Mais clicadas:', ...top.map((x, i) => `${i + 1}. ${x.titulo} (${x.n})`));
  if (h.length) linhas.push('', `⏰ Horários que mais renderam: ${h.join(', ')}`);
  if (cans.length) linhas.push('', `⚠️ Grupos com muitas saídas: ${cans.map((g) => g.nome).join(', ')}. Vale mandar menos ofertas neles.`);
  return linhas.join('\n');
}

/** Domingo, no horário do resumo diário, para quem ligou o semanal. */
export async function rodarResumoSemanal(c: Ctx): Promise<number> {
  const agora = new Date(t(c));
  if (agora.getDay() !== 0) return 0;
  const semana = diaLocal(t(c));
  let enviados = 0;
  for (const k of c.db.prepare("SELECT conta_id, resumo_numero, resumo_hora, ultimo_semanal FROM config_conta WHERE resumo_semanal = 1 AND resumo_numero <> ''").all() as any[]) {
    if (k.ultimo_semanal === semana || agora.getHours() < Number(k.resumo_hora)) continue;
    const inst = c.db.prepare("SELECT chave FROM instancias WHERE conta_id = ? AND status = 'conectado' ORDER BY id LIMIT 1").get(k.conta_id) as any;
    if (!inst) continue;
    c.db.prepare('UPDATE config_conta SET ultimo_semanal = ? WHERE conta_id = ?').run(semana, k.conta_id);
    try { await c.wpp.enviar(inst.chave, `${String(k.resumo_numero).replace(/\D/g, '')}@s.whatsapp.net`, textoResumoSemana(c, k.conta_id)); enviados++; }
    catch (e) { console.error('resumo semanal', k.conta_id, (e as Error).message); }
  }
  return enviados;
}

// ---------------- 19. Vitrine pública ----------------

/** Ofertas enviadas nos últimos 7 dias pela conta do link de entrada, sem repetir, com link que conta clique. */
export function vitrinePublica(c: Ctx, slug: string) {
  const e = c.db.prepare('SELECT * FROM entradas WHERE slug = ? AND ativo = 1').get(slug) as any;
  if (!e) return null;
  const nicho = lerNicho(config(c.db, e.conta_id)?.nicho ?? '');
  const ofertas = c.db.prepare(`SELECT o.*, MAX(a.quando) AS ultima FROM ofertas o JOIN agendamentos a ON a.oferta_id = o.id
    WHERE o.conta_id = ? AND a.status IN ('enviado','enviando') AND a.quando >= ? AND o.esgotada = 0 GROUP BY o.id ORDER BY ultima DESC LIMIT 24`).all(e.conta_id, t(c) - 7 * DIA) as any[];
  const lista = ofertas.map((o) => {
    // Amazon: link direto, sem preço e sem foto (regras do Programa de Associados, src/regras.ts).
    if (o.plataforma === 'amazon') return { titulo: o.titulo, imagem: 'emoji:🛒', preco_de: null, preco_por: null, categoria: o.categoria, link: o.url_afiliado };
    let l = c.db.prepare("SELECT codigo FROM links WHERE conta_id = ? AND oferta_id = ? AND grupo_id IS NULL AND agendamento_id IS NULL AND destino = ?").get(e.conta_id, o.id, o.url_afiliado) as any;
    if (!l) {
      l = { codigo: novoCodigo() };
      c.db.prepare('INSERT INTO links (codigo, conta_id, oferta_id, grupo_id, agendamento_id, destino, criado_em) VALUES (?, ?, ?, NULL, NULL, ?, ?)').run(l.codigo, e.conta_id, o.id, o.url_afiliado, t(c));
    }
    return { titulo: o.titulo, imagem: o.imagem, preco_de: o.preco_de, preco_por: o.preco_por, categoria: o.categoria, link: `/r/${l.codigo}` };
  });
  const temAmazon = ofertas.some((o) => o.plataforma === 'amazon');
  return { entrada: e, ofertas: lista, rodape: temAmazon ? comAvisoAmazon(nicho.rodape).trim() : nicho.rodape };
}
