// Instagram (6.7): quem comenta a palavra-chave num post recebe o link no direct.
//
// Usa a API do Instagram com login do Instagram (graph.instagram.com), com um app da Meta da MS Soluções:
//  - a conta conecta pelo botão "Conectar Instagram" (OAuth) → token de longa duração (60 dias, renovado sozinho);
//  - o webhook /webhook/instagram recebe "comments" e "messages" (assinatura X-Hub-Signature-256 com o segredo do app);
//  - comentário com a palavra → resposta privada (POST /<ig>/messages com recipient.comment_id) e, se quiser,
//    resposta pública no comentário ("Te mandei no direct!"). Mensagem no direct com a palavra → a mesma mensagem.
// Regras da Meta: uma resposta privada por comentário, até 7 dias depois do comentário.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DB } from './db.ts';
import { ErroUso, type Ctx } from './servico.ts';

export const GRAPH = 'https://graph.instagram.com/v22.0';
export const ESCOPOS = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
export interface CfgInsta { appId: string; appSecret: string; verifyToken: string; urlPublica: string; segredo: string }
const agoraDe = (c: Ctx) => (c.agora ? c.agora() : Date.now());

// ------------------------------------------------------------------ texto
/** minúsculas, sem acento e sem pontuação: "Eu QUERO!!" → "eu quero" */
export const normalizar = (t: string) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const palavrasDe = (t: string) => String(t ?? '').split(/[\n,;]/).map((x) => normalizar(x)).filter(Boolean);
export function bate(texto: string, palavras: string[]): boolean {
  const t = ` ${normalizar(texto)} `;
  return palavras.some((p) => t.includes(` ${p} `));
}
const montar = (modelo: string, usuario: string) => String(modelo ?? '').replace(/\{nome\}/g, usuario ? `@${usuario}` : '').replace(/[ \t]+([,!.?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
const sortear = (linhas: string) => { const l = String(linhas ?? '').split('\n').map((x) => x.trim()).filter(Boolean); return l.length ? l[Math.floor(Math.random() * l.length)]! : ''; };

// ------------------------------------------------------------------ conexão (OAuth)
const assinar = (dados: string, segredo: string) => createHmac('sha256', segredo).update(dados).digest('base64url');
export function estadoConexao(conta: number, segredo: string, agora = Date.now()): string {
  const d = `${conta}.${agora}`;
  return `${d}.${assinar('ig:' + d, segredo)}`;
}
export function lerEstado(estado: string, segredo: string, agora = Date.now()): number | null {
  const m = String(estado ?? '').match(/^(\d+)\.(\d+)\.([\w-]+)$/);
  if (!m) return null;
  const esperado = Buffer.from(assinar(`ig:${m[1]}.${m[2]}`, segredo)), veio = Buffer.from(m[3]!);
  if (esperado.length !== veio.length || !timingSafeEqual(esperado, veio)) return null;
  if (agora - Number(m[2]) > 30 * 60_000) return null;
  return Number(m[1]);
}
export const retornoUrl = (cfg: CfgInsta) => `${cfg.urlPublica}/instagram/retorno`;
export function linkConectar(cfg: CfgInsta, conta: number): string {
  if (!cfg.appId || !cfg.appSecret) throw new ErroUso('O app do Instagram ainda não foi configurado no servidor (INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET)');
  const q = new URLSearchParams({ enable_fb_login: '0', force_authentication: '1', client_id: cfg.appId, redirect_uri: retornoUrl(cfg), response_type: 'code', scope: ESCOPOS, state: estadoConexao(conta, cfg.segredo) });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

async function jsonDe(r: Response, oQue: string) {
  const t = await r.text();
  let j: any = {};
  try { j = t ? JSON.parse(t) : {}; } catch { /* resposta sem JSON */ }
  if (!r.ok || j.error || j.error_message) {
    const msg = j.error?.message || j.error_message || t.slice(0, 200) || `HTTP ${r.status}`;
    throw new ErroUso(`Instagram (${oQue}): ${msg}`);
  }
  return j;
}

/** Volta do Instagram com o código: troca por token de longa duração, lê a conta e assina o webhook. */
export async function concluirConexao(c: Ctx, cfg: CfgInsta, codigo: string, estado: string): Promise<{ conta: number; usuario: string }> {
  const conta = lerEstado(estado, cfg.segredo, agoraDe(c));
  if (!conta) throw new ErroUso('O pedido de conexão expirou. Volte ao Ofertix e clique em Conectar Instagram de novo.');
  const form = new URLSearchParams({ client_id: cfg.appId, client_secret: cfg.appSecret, grant_type: 'authorization_code', redirect_uri: retornoUrl(cfg), code: String(codigo ?? '').replace(/#_$/, '') });
  const curto = await jsonDe(await c.f('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form, headers: { 'content-type': 'application/x-www-form-urlencoded' } }), 'código');
  const tokCurto = curto.access_token ?? curto.data?.[0]?.access_token;
  if (!tokCurto) throw new ErroUso('O Instagram não devolveu o acesso');
  const longo = await jsonDe(await c.f(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: cfg.appSecret, access_token: tokCurto })}`), 'token');
  const token = String(longo.access_token);
  const eu = await jsonDe(await c.f(`${GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`), 'conta');
  await jsonDe(await c.f(`${GRAPH}/me/subscribed_apps?subscribed_fields=comments,messages&access_token=${encodeURIComponent(token)}`, { method: 'POST' }), 'webhook');
  const agora = agoraDe(c);
  c.db.prepare(`INSERT INTO insta_contas (conta_id, ig_id, usuario, token, token_em, conectado_em) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (conta_id) DO UPDATE SET ig_id = excluded.ig_id, usuario = excluded.usuario, token = excluded.token, token_em = excluded.token_em, conectado_em = excluded.conectado_em`)
    .run(conta, String(eu.user_id ?? eu.id), String(eu.username ?? ''), token, agora, agora);
  return { conta, usuario: String(eu.username ?? '') };
}

export function desconectar(db: DB, conta: number) { db.prepare('DELETE FROM insta_contas WHERE conta_id = ?').run(conta); }

/** Registro guardado por 90 dias (política de privacidade). */
export const limparLog = (db: DB, agora = Date.now()) => db.prepare('DELETE FROM insta_log WHERE em < ?').run(agora - 90 * 86400_000).changes;

/** Token de longa duração vale 60 dias: renova os que têm mais de 20 dias. */
export async function renovarTokens(c: Ctx): Promise<number> {
  const velhos = c.db.prepare('SELECT conta_id, token FROM insta_contas WHERE token_em < ?').all(agoraDe(c) - 20 * 86400_000) as any[];
  let n = 0;
  for (const v of velhos) {
    try {
      const j = await jsonDe(await c.f(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(v.token)}`), 'renovar');
      c.db.prepare('UPDATE insta_contas SET token = ?, token_em = ?, erro = ? WHERE conta_id = ?').run(String(j.access_token), agoraDe(c), '', v.conta_id);
      n++;
    } catch (e) { c.db.prepare('UPDATE insta_contas SET erro = ? WHERE conta_id = ?').run((e as Error).message.slice(0, 300), v.conta_id); }
  }
  return n;
}

// ------------------------------------------------------------------ regras
export interface Regra { id: number; nome: string; palavras: string; mensagem: string; publica: string; ativo: boolean; respondidas: number }
const lerRegra = (r: any): Regra => ({ id: Number(r.id), nome: r.nome, palavras: r.palavras, mensagem: r.mensagem, publica: r.publica, ativo: !!r.ativo, respondidas: Number(r.respondidas) || 0 });
export const listarRegras = (db: DB, conta: number) => (db.prepare('SELECT * FROM insta_regras WHERE conta_id = ? ORDER BY id').all(conta) as any[]).map(lerRegra);

export function salvarRegra(db: DB, conta: number, b: any, id?: number, agora = Date.now()): number {
  const nome = String(b?.nome ?? '').trim().slice(0, 60) || 'Palavra-chave';
  const palavras = String(b?.palavras ?? '').split(/[\n,;]/).map((x) => x.trim()).filter(Boolean).slice(0, 10).join(', ');
  if (!palavrasDe(palavras).length) throw new ErroUso('Escreva ao menos uma palavra-chave (ex.: EU QUERO)');
  const mensagem = String(b?.mensagem ?? '').trim().slice(0, 900);
  if (!mensagem) throw new ErroUso('Escreva a mensagem que vai no direct');
  const publica = String(b?.publica ?? '').split('\n').map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 8).join('\n');
  const ativo = b?.ativo === false ? 0 : 1;
  if (id) {
    const r = db.prepare('UPDATE insta_regras SET nome = ?, palavras = ?, mensagem = ?, publica = ?, ativo = ? WHERE id = ? AND conta_id = ?').run(nome, palavras, mensagem, publica, ativo, id, conta);
    if (!r.changes) throw new ErroUso('Palavra-chave não encontrada', 404);
    return id;
  }
  if ((db.prepare('SELECT COUNT(*) AS n FROM insta_regras WHERE conta_id = ?').get(conta) as any).n >= 20) throw new ErroUso('Limite de 20 palavras-chave');
  return Number(db.prepare('INSERT INTO insta_regras (conta_id, nome, palavras, mensagem, publica, ativo, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)').run(conta, nome, palavras, mensagem, publica, ativo, agora).lastInsertRowid);
}
export function apagarRegra(db: DB, conta: number, id: number) {
  if (!db.prepare('DELETE FROM insta_regras WHERE id = ? AND conta_id = ?').run(id, conta).changes) throw new ErroUso('Palavra-chave não encontrada', 404);
}
export const regraPara = (db: DB, conta: number, texto: string) => listarRegras(db, conta).find((r) => r.ativo && bate(texto, palavrasDe(r.palavras))) ?? null;

/** Prévia: a regra que pega o texto e como a mensagem sai. */
export function simular(db: DB, conta: number, texto: string, usuario = 'cliente') {
  const r = regraPara(db, conta, texto);
  return r ? { regra: r.nome, mensagem: montar(r.mensagem, usuario), publica: r.publica.split('\n').filter(Boolean) } : { regra: '', mensagem: '', publica: [] };
}

// ------------------------------------------------------------------ painel
export function painel(db: DB, conta: number, cfg: Pick<CfgInsta, 'appId' | 'urlPublica'>, agora = Date.now()) {
  const ic = db.prepare('SELECT usuario, conectado_em, token_em, erro FROM insta_contas WHERE conta_id = ?').get(conta) as any;
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  const cont = (st: string) => (db.prepare('SELECT COUNT(*) AS n FROM insta_log WHERE conta_id = ? AND status = ? AND em >= ?').get(conta, st, hoje.getTime()) as any).n;
  return {
    disponivel: !!cfg.appId,
    conectado: ic ? { usuario: ic.usuario, desde: ic.conectado_em, erro: ic.erro || '' } : null,
    regras: listarRegras(db, conta),
    hoje: { enviadas: cont('enviada'), ignoradas: cont('ignorada'), erros: cont('erro') },
    registro: db.prepare('SELECT l.*, r.nome AS regra_nome FROM insta_log l LEFT JOIN insta_regras r ON r.id = l.regra_id WHERE l.conta_id = ? ORDER BY l.em DESC, l.id DESC LIMIT 40').all(conta),
    webhook: `${cfg.urlPublica}/webhook/instagram`,
  };
}

// ------------------------------------------------------------------ webhook
export function assinaturaValida(corpo: string, cabecalho: string, segredo: string): boolean {
  if (!segredo) return false;
  const esperado = Buffer.from('sha256=' + createHmac('sha256', segredo).update(corpo).digest('hex'));
  const veio = Buffer.from(String(cabecalho ?? ''));
  return esperado.length === veio.length && timingSafeEqual(esperado, veio);
}

function registrar(db: DB, conta: number, d: { regra?: number | null; tipo: string; ref: string; de: string; usuario: string; texto: string; midia?: string; status: string; motivo: string }, em: number) {
  db.prepare('INSERT OR IGNORE INTO insta_log (conta_id, regra_id, tipo, ref, de_id, de_usuario, texto, midia, status, motivo, em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(conta, d.regra ?? null, d.tipo, d.ref, d.de, d.usuario, String(d.texto).slice(0, 300), d.midia ?? '', d.status, d.motivo.slice(0, 300), em);
}

async function chamar(c: Ctx, url: string, token: string, corpo: any) {
  return jsonDe(await c.f(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }), 'envio');
}

/** Processa o corpo do webhook (já com a assinatura conferida). Devolve quantas mensagens foram enviadas. */
export async function eventoInstagram(c: Ctx, ev: any): Promise<number> {
  if (ev?.object !== 'instagram' || !Array.isArray(ev.entry)) return 0;
  let enviadas = 0;
  for (const en of ev.entry) {
    const ic = c.db.prepare('SELECT * FROM insta_contas WHERE ig_id = ?').get(String(en?.id ?? '')) as any;
    if (!ic) continue;
    for (const ch of Array.isArray(en.changes) ? en.changes : []) {
      if (ch?.field === 'comments' && ch.value) enviadas += await comentario(c, ic, ch.value);
    }
    for (const m of Array.isArray(en.messaging) ? en.messaging : []) enviadas += await direct(c, ic, m);
  }
  return enviadas;
}

async function comentario(c: Ctx, ic: any, v: any): Promise<number> {
  const conta = Number(ic.conta_id), agora = agoraDe(c);
  const id = String(v.id ?? ''), de = String(v.from?.id ?? ''), usuario = String(v.from?.username ?? ''), texto = String(v.text ?? ''), midia = String(v.media?.id ?? '');
  if (!id || !de || de === String(ic.ig_id) || usuario === ic.usuario) return 0; // o próprio perfil respondendo
  if (c.db.prepare("SELECT 1 FROM insta_log WHERE conta_id = ? AND tipo = 'comentario' AND ref = ?").get(conta, id)) return 0; // webhook repetido
  const r = regraPara(c.db, conta, texto);
  if (!r) return 0; // comentário comum: não registra
  const base = { regra: r.id, tipo: 'comentario', ref: id, de, usuario, texto, midia };
  // A mesma pessoa no mesmo post só recebe uma vez por dia (comentou "eu quero" três vezes → um direct).
  if (c.db.prepare("SELECT 1 FROM insta_log WHERE conta_id = ? AND de_id = ? AND status = 'enviada' AND midia = ? AND em > ?").get(conta, de, midia, agora - 86400_000)) {
    registrar(c.db, conta, { ...base, status: 'ignorada', motivo: 'Já recebeu o link nas últimas 24 horas' }, agora);
    return 0;
  }
  try {
    await chamar(c, `${GRAPH}/${ic.ig_id}/messages`, ic.token, { recipient: { comment_id: id }, message: { text: montar(r.mensagem, usuario) } });
    const pub = sortear(r.publica);
    let extra = '';
    if (pub) {
      try { await chamar(c, `${GRAPH}/${id}/replies`, ic.token, { message: montar(pub, usuario) }); extra = ' e respondido no post'; }
      catch (e) { extra = ` (resposta no post falhou: ${(e as Error).message})`; }
    }
    c.db.prepare('UPDATE insta_regras SET respondidas = respondidas + 1 WHERE id = ?').run(r.id);
    registrar(c.db, conta, { ...base, status: 'enviada', motivo: `Link enviado no direct${extra}` }, agora);
    return 1;
  } catch (e) {
    registrar(c.db, conta, { ...base, status: 'erro', motivo: (e as Error).message }, agora);
    return 0;
  }
}

async function direct(c: Ctx, ic: any, m: any): Promise<number> {
  const conta = Number(ic.conta_id), agora = agoraDe(c);
  const de = String(m?.sender?.id ?? ''), texto = String(m?.message?.text ?? ''), mid = String(m?.message?.mid ?? '');
  if (!de || !texto || m?.message?.is_echo || de === String(ic.ig_id) || !mid) return 0;
  if (c.db.prepare("SELECT 1 FROM insta_log WHERE conta_id = ? AND tipo = 'direct' AND ref = ?").get(conta, mid)) return 0;
  const r = regraPara(c.db, conta, texto);
  if (!r) return 0;
  const base = { regra: r.id, tipo: 'direct', ref: mid, de, usuario: '', texto };
  if (c.db.prepare("SELECT 1 FROM insta_log WHERE conta_id = ? AND de_id = ? AND regra_id = ? AND status = 'enviada' AND tipo = 'direct' AND em > ?").get(conta, de, r.id, agora - 86400_000)) {
    registrar(c.db, conta, { ...base, status: 'ignorada', motivo: 'Já recebeu o link nas últimas 24 horas' }, agora);
    return 0;
  }
  try {
    await chamar(c, `${GRAPH}/${ic.ig_id}/messages`, ic.token, { recipient: { id: de }, message: { text: montar(r.mensagem, '') } });
    c.db.prepare('UPDATE insta_regras SET respondidas = respondidas + 1 WHERE id = ?').run(r.id);
    registrar(c.db, conta, { ...base, status: 'enviada', motivo: 'Link enviado no direct (pediu por mensagem)' }, agora);
    return 1;
  } catch (e) {
    registrar(c.db, conta, { ...base, status: 'erro', motivo: (e as Error).message }, agora);
    return 0;
  }
}
