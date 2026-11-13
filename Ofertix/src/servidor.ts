// Servidor HTTP do Ofertix (sem dependências): painel, API, entrada pelo portal e webhook do WhatsApp.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import type { Config } from './config.ts';
import { type DB, contaPorEmail } from './db.ts';
import { conferirAcessoPortal, usarAcesso, assinarSessao, lerSessao, type Sessao } from './portal.ts';
import { PLANOS } from './planos.ts';
import * as x from './extras.ts';
import { CATEGORIAS, ID_CATEGORIAS, MODELOS, PACOTE_ACHADINHOS, RODAPE_PADRAO, classificar, limparNicho, motivoRecusa } from './nicho.ts';
import { EMAIL_DEMO } from './demo.ts';
import { montarMensagem, expandirVariacoes, temVariacoes } from './mensagem.ts';
import * as s from './servico.ts';
import * as ent from './entradas.ts';
import * as v6 from './v6.ts';
import * as v10 from './v10.ts';
import { extrairAfiliado } from './regras.ts';
import { resolverLink } from './links.ts';
import { paginaVendas, paginaAnuncio, TEXTO_ZAP } from './vendas.ts';

const PUBLICO = join(import.meta.dirname, '..', 'public');
const TIPOS: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const COOKIE = 'ofx';
const HORAS_SESSAO = 12;

export interface App { cfg: Config; real: s.Ctx; demo: s.Ctx }

const cookies = (req: IncomingMessage) => Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));

function cabecalhos(res: ServerResponse, app: App) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('content-security-policy', `default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self' ${app.cfg.portalUrl}`);
}

const json = (res: ServerResponse, status: number, dados: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(dados));
};

const pagina = (res: ServerResponse, status: number, msg: string, portal: string) => {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ofertix</title>
<body style="font:16px system-ui,sans-serif;background:#0b0f0d;color:#e6efe9;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<div style="max-width:420px;text-align:center"><h1 style="color:#2ee68f;margin:0 0 8px">Ofertix</h1><p>${msg}</p>
<p><a style="color:#2ee68f" href="${portal}">Ir para a área do cliente da MS Soluções</a></p></div>`);
};

function redirecionar(res: ServerResponse, para: string, cookie?: string) {
  const h: Record<string, string> = { location: para, 'cache-control': 'no-store' };
  if (cookie !== undefined) h['set-cookie'] = cookie;
  res.writeHead(303, h);
  res.end();
}

async function corpo(req: IncomingMessage, max = 256_000): Promise<string> {
  let tam = 0;
  const partes: Buffer[] = [];
  for await (const p of req) {
    tam += (p as Buffer).length;
    if (tam > max) throw new s.ErroUso('Envio grande demais', 413);
    partes.push(p as Buffer);
  }
  return Buffer.concat(partes).toString();
}

const lerJson = async (req: IncomingMessage) => { const t = await corpo(req); try { return t ? JSON.parse(t) : {}; } catch { throw new s.ErroUso('JSON inválido'); } };

function novaSessaoCookie(app: App, sess: Omit<Sessao, 'exp'>) {
  const valor = assinarSessao({ ...sess, exp: Date.now() + HORAS_SESSAO * 3600_000 }, app.cfg.segredoSessao);
  const seguro = app.cfg.urlPublica.startsWith('https') ? '; Secure' : '';
  return `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${HORAS_SESSAO * 3600}${seguro}`;
}

function sessaoDemo(app: App, leitura = false) {
  const c = contaPorEmail(app.demo.db, EMAIL_DEMO);
  return novaSessaoCookie(app, { conta: c.id, email: EMAIL_DEMO, nome: 'Demonstração', demo: true, admin: false, leitura });
}

export function criarServidor(app: App) {
  return createServer(async (req, res) => {
    cabecalhos(res, app);
    const url = new URL(req.url ?? '/', 'http://x');
    const caminho = url.pathname;
    try {
      // ---------- Entradas ----------
      if (caminho === '/sso' && req.method === 'POST') {
        const form = new URLSearchParams(await corpo(req, 16_000));
        const acesso = conferirAcessoPortal(form.get('token') ?? '', { chave: app.cfg.portalChavePublica, emissor: app.cfg.portalUrl });
        if (!acesso) return pagina(res, 403, 'Acesso inválido ou vencido. Volte à área do cliente e abra o Ofertix de novo.', app.cfg.portalUrl);
        if (!usarAcesso(app.real.db, acesso.jti, acesso.exp)) return pagina(res, 403, 'Este acesso já foi usado. Abra o Ofertix de novo pela área do cliente.', app.cfg.portalUrl);
        // Teste grátis com código "demo": painel de demonstração.
        if (acesso.codigo === 'demo') return redirecionar(res, '/painel', sessaoDemo(app));
        const c = contaPorEmail(app.real.db, acesso.email, acesso.nome);
        const admin = acesso.admin && app.cfg.adminEmails.includes(acesso.email);
        return redirecionar(res, admin && acesso.codigo === 'admin' ? '/painel#admin' : '/painel',
          novaSessaoCookie(app, { conta: c.id, email: c.email, nome: c.nome, demo: false, admin, leitura: acesso.codigo === 'leitura' }));
      }
      if (caminho === '/demo' && req.method === 'GET') return redirecionar(res, '/painel', sessaoDemo(app));
      if (caminho === '/dev-login' && app.cfg.dev) {
        const email = (url.searchParams.get('email') || 'voce@exemplo.com').toLowerCase();
        const c = contaPorEmail(app.real.db, email, 'Dev');
        return redirecionar(res, '/painel', novaSessaoCookie(app, { conta: c.id, email, nome: c.nome, demo: false, admin: app.cfg.adminEmails.includes(email), leitura: false }));
      }
      if (caminho === '/sair') return redirecionar(res, app.cfg.portalUrl, `${COOKIE}=; Path=/; Max-Age=0`);
      if (caminho === '/saude') return json(res, 200, { ok: true });
      if (caminho === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); return res.end(`User-agent: *\nAllow: /$\nDisallow: /painel\nDisallow: /api/\nDisallow: /r/\nDisallow: /m/\nDisallow: /sso\nSitemap: ${app.cfg.urlPublica}/sitemap.xml\n`); }
      if (caminho === '/sitemap.xml') { res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' }); return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${app.cfg.urlPublica}/</loc></url></urlset>`); }

      // ---------- Página de vendas: botões contam o clique por origem e seguem adiante ----------
      if ((caminho === '/quero' || caminho === '/ver-demo') && req.method === 'GET') {
        const ua = String(req.headers['user-agent'] ?? '');
        const plano = url.searchParams.get('p') ?? '';
        v6.registrarSite(app.real.db, caminho === '/quero' ? 'teste' : 'demo', url.searchParams.get('o') ?? '', PLANOS[plano] ? plano : '', ua);
        return redirecionar(res, caminho === '/quero' ? `${app.cfg.portalUrl}/teste?sis=ofertix` : '/demo');
      }

      // Botão de WhatsApp da página de vendas: conta o clique pela origem e abre a conversa.
      if (caminho === '/zap' && req.method === 'GET') {
        v6.registrarSite(app.real.db, 'zap', url.searchParams.get('o') ?? '', '', String(req.headers['user-agent'] ?? ''));
        res.writeHead(302, { location: `https://wa.me/${app.cfg.whatsappContato || '5531999041748'}?text=${encodeURIComponent(TEXTO_ZAP)}`, 'cache-control': 'no-store' });
        return res.end();
      }
      // Página curta para quem vem do anúncio. Sem ?o=, a origem fica "anuncio".
      if (caminho === '/quero-testar' && req.method === 'GET') {
        const origem = v6.limparOrigemSite(url.searchParams.get('o') || 'anuncio');
        v6.registrarSite(app.real.db, 'visita', origem, '', String(req.headers['user-agent'] ?? ''));
        res.writeHead(200, { 'content-type': TIPOS['.html'], 'cache-control': 'no-store' });
        return res.end(paginaAnuncio({ urlPublica: app.cfg.urlPublica, portalUrl: app.cfg.portalUrl, origem }));
      }

      // ---------- Webhook da Evolution API ----------
      const wh = caminho.match(/^\/webhook\/whatsapp\/([\w-]{1,60})$/);
      if (wh && req.method === 'POST') {
        const ev = await lerJson(req);
        const n = await s.eventoWhatsApp(app.real, wh[1], url.searchParams.get('t') ?? '', ev);
        return json(res, 200, { ok: true, capturadas: n });
      }

      // ---------- Link curto (conta o clique e manda para a loja) ----------
      const rl = caminho.match(/^\/r\/([A-Za-z0-9]{5,12})$/);
      if (rl) {
        const ua = String(req.headers['user-agent'] ?? '');
        const destino = s.registrarClique(app.real, rl[1], ua) ?? s.registrarClique(app.demo, rl[1], ua);
        if (!destino) return pagina(res, 404, 'Esta oferta não existe mais.', app.cfg.portalUrl);
        res.writeHead(302, { location: destino, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
        return res.end();
      }

      // ---------- Imagem copiada pelo espelhamento (a Evolution API baixa daqui para mandar no grupo) ----------
      const rm = caminho.match(/^\/m\/([A-Za-z0-9_-]{16})$/);
      if (rm && req.method === 'GET') {
        const m = v10.lerMidia(app.real.db, rm[1]) ?? v10.lerMidia(app.demo.db, rm[1]);
        if (!m) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m.tipo, 'cache-control': 'private, max-age=86400', 'x-robots-tag': 'noindex' });
        return res.end(Buffer.from(m.dados));
      }

      // ---------- Vitrine pública: achadinhos da semana ----------
      const rv = caminho.match(/^\/v\/([a-z0-9-]{3,40})\/?$/);
      if (rv && req.method === 'GET') {
        for (const c of [app.real, app.demo]) {
          const d = x.vitrinePublica(c, rv[1]);
          if (d) { res.writeHead(200, { 'content-type': TIPOS['.html'], 'cache-control': 'no-store' }); return res.end(ent.paginaVitrine(d)); }
        }
        return pagina(res, 404, 'Esta vitrine não existe ou foi desativada.', app.cfg.portalUrl);
      }
      // ---------- Instalar como app ----------
      if (caminho === '/manifest.webmanifest') {
        res.writeHead(200, { 'content-type': TIPOS['.webmanifest'], 'cache-control': 'public, max-age=3600' });
        return res.end(JSON.stringify({ name: 'Ofertix', short_name: 'Ofertix', start_url: '/painel', scope: '/', display: 'standalone', background_color: '#f4f7f5', theme_color: '#E8355A',
          icons: [{ src: '/assets/logo-256.png', sizes: '256x256', type: 'image/png' }, { src: '/assets/logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }));
      }
      if (caminho === '/sw.js') {
        res.writeHead(200, { 'content-type': TIPOS['.js'], 'cache-control': 'no-cache' });
        return res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',()=>{});");
      }

      // ---------- Link de entrada (página da bio → grupo com vaga) ----------
      const rg = caminho.match(/^\/g\/([a-z0-9-]{3,40})(?:\/(\d+))?\/?$/);
      if (rg && req.method === 'GET') {
        const origem = url.searchParams.get('o') ?? '';
        const ctxs = [app.real, app.demo];
        const base = `/g/${rg[1]}`;
        const html = (status: number, corpoHtml: string) => { res.writeHead(status, { 'content-type': TIPOS['.html'], 'cache-control': 'no-store' }); res.end(corpoHtml); };
        if (rg[2]) {
          for (const c of ctxs) {
            const r2 = ent.irParaGrupo(c, rg[1], Number(rg[2]), origem);
            if (!r2) continue;
            if (r2.url) { res.writeHead(302, { location: r2.url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }); return res.end(); }
            const d = ent.abrirEntrada(c, rg[1], origem)!;
            return html(200, ent.paginaEntrada(d, base, ent.limparOrigem(origem), 'Os grupos desse tema lotaram agora há pouco. Escolha outro tema ou volte mais tarde.'));
          }
        } else {
          for (const c of ctxs) {
            const d = ent.abrirEntrada(c, rg[1], origem);
            if (d) return html(200, ent.paginaEntrada(d, base, ent.limparOrigem(origem)));
          }
        }
        return pagina(res, 404, 'Este link de grupos não existe ou foi desativado.', app.cfg.portalUrl);
      }

      const sess = lerSessao(cookies(req)[COOKIE], app.cfg.segredoSessao);

      // ---------- Páginas ----------
      if (caminho === '/') {
        // Quem já está logado vai direto ao painel, a não ser que peça a página (?site).
        if (sess && !url.searchParams.has('site')) return redirecionar(res, '/painel');
        const origem = v6.limparOrigemSite(url.searchParams.get('o') ?? '');
        v6.registrarSite(app.real.db, 'visita', origem, '', String(req.headers['user-agent'] ?? ''));
        res.writeHead(200, { 'content-type': TIPOS['.html'], 'cache-control': 'no-store' });
        return res.end(paginaVendas({ urlPublica: app.cfg.urlPublica, portalUrl: app.cfg.portalUrl, origem }));
      }
      if (caminho === '/painel') {
        if (!sess) return redirecionar(res, '/');
        res.writeHead(200, { 'content-type': TIPOS['.html'], 'cache-control': 'no-store' });
        return res.end(readFileSync(join(PUBLICO, 'index.html')));
      }
      if (caminho.startsWith('/assets/')) {
        const arq = normalize(join(PUBLICO, caminho));
        if (!arq.startsWith(PUBLICO) || !existsSync(arq)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': TIPOS[extname(arq)] ?? 'application/octet-stream', 'cache-control': 'public, max-age=3600' });
        return res.end(readFileSync(arq));
      }

      // ---------- API ----------
      if (!caminho.startsWith('/api/')) { res.writeHead(404); return res.end('Não encontrado'); }
      if (!sess) return json(res, 401, { erro: 'Sessão expirada. Abra o Ofertix pela área do cliente.' });
      const muda = req.method !== 'GET';
      if (muda && req.headers['x-ofertix'] !== '1') return json(res, 403, { erro: 'Requisição recusada' });
      if (muda && sess.leitura) return json(res, 403, { erro: 'Seu acesso é só de leitura' });
      const ctx = sess.demo ? app.demo : app.real;
      const conta = sess.conta;
      const db = ctx.db;
      const per = url.searchParams.get('periodo') ?? '7d';
      const id = Number(caminho.match(/\/(\d+)(?=\/|$)/)?.[1] ?? NaN);
      const r = (dados: unknown, status = 200) => json(res, status, dados);
      const rota = `${req.method} ${caminho.replace(/\/\d+(?=\/|$)/g, '/:id')}`;

      switch (rota) {
        case 'GET /api/eu': {
          const c = db.prepare('SELECT nome, email, plano FROM contas WHERE id = ?').get(conta) as any;
          return r({ ...c, plano: s.planoDa(db, conta), pausado: x.pausada(db, conta), demo: sess.demo, admin: sess.admin, leitura: sess.leitura, portal: app.cfg.portalUrl });
        }
        case 'GET /api/visao': return r(s.visaoGeral(ctx, conta, per));
        case 'GET /api/avisos': return r(s.avisos(ctx, conta));
        case 'GET /api/exportar/envios.csv':
        case 'GET /api/exportar/comissoes.csv': {
          const qual = caminho.includes('envios') ? 'envios' : 'comissoes';
          const corpoCsv = qual === 'envios' ? s.csvEnvios(ctx, conta, per) : s.csvComissoes(ctx, conta, per);
          res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': `attachment; filename="ofertix-${qual}-${per}.csv"` });
          return res.end(corpoCsv);
        }
        case 'POST /api/resumo/teste': {
          const c2 = s.config(db, conta);
          if (!c2.resumo_numero) throw new s.ErroUso('Informe o seu número de WhatsApp para o resumo');
          const inst = db.prepare("SELECT chave FROM instancias WHERE conta_id = ? AND status = 'conectado' ORDER BY id LIMIT 1").get(conta) as any;
          if (!inst) throw new s.ErroUso('Conecte um número de WhatsApp para enviar o resumo');
          await ctx.wpp.enviar(inst.chave, `${String(c2.resumo_numero).replace(/\D/g, '')}@s.whatsapp.net`, s.textoResumo(ctx, conta));
          return r({ ok: true });
        }

        case 'GET /api/ofertas': {
          const origem = url.searchParams.get('origem') ?? '';
          const q = `%${(url.searchParams.get('q') ?? '').trim()}%`;
          const cat = url.searchParams.get('categoria') ?? '';
          const arq = origem === 'arquivadas';
          const filtro = (arq ? ' AND o.arquivada = 1' : ' AND o.arquivada = 0') + (origem === 'vitrine' ? ' AND o.vitrine = 1' : origem && !arq ? ' AND o.origem = ?' : '') + (ID_CATEGORIAS.has(cat) ? ` AND COALESCE(NULLIF(o.categoria, ''), 'outros') = '${cat}'` : '');
          const lista = db.prepare(`SELECT o.*, (SELECT COUNT(*) FROM links l JOIN cliques k ON k.codigo = l.codigo WHERE l.oferta_id = o.id) AS cliques,
              (SELECT COUNT(*) FROM envios e JOIN agendamentos a ON a.id = e.agendamento_id WHERE a.oferta_id = o.id AND e.status = 'enviado') AS envios
            FROM ofertas o WHERE o.conta_id = ? AND o.titulo LIKE ?${filtro} ORDER BY ${origem === 'vitrine' ? 'o.vitrine_em, o.id' : 'o.criado_em DESC'} LIMIT 200`)
            .all(...(origem && origem !== 'vitrine' && origem !== 'arquivadas' ? [conta, q, origem] : [conta, q]));
          return r(lista);
        }
        case 'POST /api/ofertas': {
          const b = await lerJson(req);
          const nova = await s.converterLink(ctx, conta, String(b.url ?? ''));
          const oid = s.salvarOferta(ctx, conta, nova);
          const o = s.oferta(db, conta, oid);
          if (b.vitrine) s.alternarVitrine(db, conta, oid, true);
          return r({ oferta: s.oferta(db, conta, oid), texto: s.textoOferta(db, conta, o), parecidas: x.parecidas(db, conta, oid) }, 201);
        }
        case 'PUT /api/ofertas/:id': {
          const b = await lerJson(req);
          s.oferta(db, conta, id);
          const cent = (v: unknown) => (v === '' || v == null ? null : Math.round(Number(String(v).replace(',', '.')) * 100) || null);
          db.prepare('UPDATE ofertas SET titulo = ?, preco_de = ?, preco_por = ?, imagem = ? WHERE id = ? AND conta_id = ?')
            .run(String(b.titulo ?? '').slice(0, 200), cent(b.precoDe), cent(b.precoPor), String(b.imagem ?? '').slice(0, 500), id, conta);
          if (ID_CATEGORIAS.has(String(b.categoria ?? ''))) db.prepare('UPDATE ofertas SET categoria = ? WHERE id = ? AND conta_id = ?').run(String(b.categoria), id, conta);
          const o = s.oferta(db, conta, id);
          return r({ oferta: o, texto: s.textoOferta(db, conta, o) });
        }
        case 'POST /api/ofertas/lote': {
          const b = await lerJson(req);
          const urls = Array.isArray(b.urls) ? b.urls : String(b.urls ?? '').split(/\s+/);
          const r2 = await s.ofertasEmLote(ctx, conta, urls, { espacoMin: b.espacoMin, inicio: b.inicio, grupos: Array.isArray(b.grupos) ? b.grupos : 'todos' });
          return r(r2, 201);
        }
        case 'POST /api/ofertas/:id/vitrine': { const b = await lerJson(req); s.alternarVitrine(db, conta, id, !!b.ligada); return r({ ok: true }); }
        case 'GET /api/ofertas/:id/texto': { const o = s.oferta(db, conta, id); return r({ oferta: o, texto: s.textoOferta(db, conta, o) }); }
        case 'DELETE /api/ofertas/:id': db.prepare('DELETE FROM ofertas WHERE id = ? AND conta_id = ?').run(id, conta); return r({ ok: true });

        case 'GET /api/agendamentos': {
          const st = url.searchParams.get('status') ?? '';
          const lista = db.prepare(`SELECT a.*, o.titulo, o.plataforma, o.imagem AS foto,
              (SELECT COUNT(*) FROM envios e WHERE e.agendamento_id = a.id AND e.status = 'enviado') AS enviados,
              (SELECT COUNT(*) FROM envios e WHERE e.agendamento_id = a.id AND e.status = 'erro') AS erros,
              (SELECT COUNT(*) FROM envios e WHERE e.agendamento_id = a.id AND e.status = 'pulado') AS pulados,
              (SELECT COUNT(*) FROM envios e WHERE e.agendamento_id = a.id AND e.status <> 'pulado') AS total,
              (SELECT COUNT(*) FROM links l JOIN cliques k ON k.codigo = l.codigo WHERE l.agendamento_id = a.id) AS cliques
            FROM agendamentos a LEFT JOIN ofertas o ON o.id = a.oferta_id
            WHERE a.conta_id = ?${st ? ' AND a.status = ?' : " AND (a.status IN ('pendente','enviando') OR a.quando > ?)"} ORDER BY a.quando DESC LIMIT 100`)
            .all(...(st ? [conta, st] : [conta, Date.now() - 2 * 86_400_000]));
          return r(lista);
        }
        case 'POST /api/agendamentos': {
          const b = await lerJson(req);
          const aid = s.agendar(ctx, conta, { ofertaId: b.ofertaId ? Number(b.ofertaId) : undefined, texto: b.texto, imagem: b.imagem, quando: b.quando, grupos: Array.isArray(b.grupos) ? b.grupos : 'todos' });
          return r({ id: aid }, 201);
        }
        case 'POST /api/agendamentos/:id/cancelar': s.cancelarAgendamento(db, conta, id); return r({ ok: true });
        case 'POST /api/agendamentos/:id/repetir': { const b = await lerJson(req); return r({ id: v6.enviarDeNovo(ctx, conta, id, b.quando ? Number(b.quando) : undefined) }, 201); }

        // ---------- v6 ----------
        case 'GET /api/shopee/busca': return r(await v6.buscarShopee(ctx, conta, url.searchParams.get('q') ?? '', url.searchParams.get('ordem') ?? 'vendidos', Number(url.searchParams.get('pagina')) || 1, {
          categoria: url.searchParams.get('cat') ?? '', precoMax: Number(url.searchParams.get('max')) || 0, grupo: Number(url.searchParams.get('grupo')) || 0 }));
        case 'POST /api/shopee/adicionar': {
          const b = await lerJson(req);
          const oid = await v6.adicionarDaBusca(ctx, conta, b.item, !!b.vitrine);
          const o = s.oferta(db, conta, oid);
          return r({ oferta: o, texto: s.textoOferta(db, conta, o) }, 201);
        }
        case 'GET /api/abastecer': { const a = v6.lerAbastecer(db, conta); return r({ ...a, termosHoje: v6.termosDoDia(db, conta, a, Date.now()), temShopee: !!(s.config(db, conta).shopee_app_id) || !!ctx.demo }); }
        case 'POST /api/abastecer': return r(v6.salvarAbastecer(db, conta, await lerJson(req)));
        case 'POST /api/abastecer/agora': return r(await v6.abastecerAgora(ctx, conta));
        case 'POST /api/enquetes': return r({ id: v6.criarEnquete(ctx, conta, await lerJson(req)) }, 201);
        case 'GET /api/lista-dia': return r({ ...v6.lerListaDia(db, conta), previa: v6.textoListaDia(ctx, conta) });
        case 'POST /api/lista-dia': return r(v6.salvarListaDia(db, conta, await lerJson(req)));
        case 'POST /api/lista-dia/agora': {
          const texto = v6.textoListaDia(ctx, conta);
          if (!texto) throw new s.ErroUso('Hoje saíram menos de 2 ofertas: ainda não há lista para mandar');
          return r({ id: s.agendar(ctx, conta, { texto, origem: 'lista' }) }, 201);
        }
        case 'GET /api/respostas': return r({ lista: v6.listarRespostas(db, conta), sugestoes: v6.RESPOSTAS_SUGERIDAS });
        case 'POST /api/respostas': return r({ id: v6.salvarResposta(db, conta, await lerJson(req)) }, 201);
        case 'PUT /api/respostas/:id': return r({ id: v6.salvarResposta(db, conta, await lerJson(req), id) });
        case 'POST /api/respostas/:id/ativo': { const b = await lerJson(req); db.prepare('UPDATE respostas SET ativo = ? WHERE id = ? AND conta_id = ?').run(b.ativo ? 1 : 0, id, conta); return r({ ok: true }); }
        case 'DELETE /api/respostas/:id': db.prepare('DELETE FROM respostas WHERE id = ? AND conta_id = ?').run(id, conta); return r({ ok: true });
        case 'POST /api/respostas/testar': {
          const b = await lerJson(req);
          const resp = v6.respostaPara(db, conta, String(b.mensagem ?? ''));
          return r({ resposta: resp ? v6.montarResposta(ctx, conta, resp.texto, 'Maria') : null });
        }
        case 'GET /api/datas': return r(v6.proximasDatas(Date.now()));
        case 'GET /api/admin/site': {
          if (!sess.admin) return r({ erro: 'Somente administradores' }, 403);
          return r(v6.relatorioSite(app.real.db, Math.min(90, Math.max(1, Number(url.searchParams.get('dias')) || 30))));
        }

        case 'GET /api/grupos': {
          const p = s.planoDa(db, conta);
          const lista = db.prepare(`SELECT g.*, i.nome AS numero_nome, EXISTS (SELECT 1 FROM espelhos e WHERE e.origem_grupo_id = g.id) AS espelho
            FROM grupos g JOIN instancias i ON i.id = g.instancia_id WHERE g.conta_id = ? ORDER BY g.enviar DESC, (g.monitorar OR EXISTS (SELECT 1 FROM espelhos e WHERE e.origem_grupo_id = g.id)), g.nome`).all(conta);
          return r({ lista, limites: { envio: p.gruposEnvio, monitorados: p.gruposMonitorados, captura: p.captura } });
        }
        case 'POST /api/grupos/:id': {
          const b = await lerJson(req);
          if ('enviar' in b) s.alternarGrupo(db, conta, id, 'enviar', !!b.enviar);
          if ('monitorar' in b) s.alternarGrupo(db, conta, id, 'monitorar', !!b.monitorar);
          if ('categorias' in b || 'precoMax' in b) v10.salvarTemaGrupo(db, conta, id, b);
          return r({ ok: true });
        }

        // ---------- Automação: espelhamento de grupos ----------
        case 'GET /api/automacao': return r(v10.painelEspelhos(db, conta, Date.now()));
        case 'POST /api/espelhos': return r({ id: v10.salvarEspelho(db, conta, await lerJson(req)) }, 201);
        case 'PUT /api/espelhos/:id': return r({ id: v10.salvarEspelho(db, conta, await lerJson(req), id) });
        case 'POST /api/espelhos/:id/ativo': {
          const b = await lerJson(req);
          const e = v10.listarEspelhos(db, conta).find((x) => x.id === id);
          if (!e) throw new s.ErroUso('Espelhamento não encontrado', 404);
          v10.salvarEspelho(db, conta, { ...e, origem: e.origem_grupo_id, remover: e.remover.join('\n'), ativo: !!b.ativo }, id);
          return r({ ok: true });
        }
        case 'DELETE /api/espelhos/:id': v10.apagarEspelho(db, conta, id); return r({ ok: true });
        case 'POST /api/espelhos/previa': {
          const b = await lerJson(req);
          return r(await v10.previaEspelho(ctx, conta, String(b.texto ?? ''), String(b.remover ?? '').split('\n').map((x) => x.trim()).filter(Boolean)));
        }

        case 'GET /api/entradas': return r({ lista: ent.painelEntradas(ctx, conta, per), base: `${app.cfg.urlPublica}/g/`, maximo: ent.MAX_ENTRADAS });
        case 'POST /api/entradas': { const b = await lerJson(req); return r({ id: ent.criarEntrada(ctx, conta, b) }, 201); }
        case 'POST /api/entradas/:id': { const b = await lerJson(req); ent.atualizarEntrada(ctx, conta, id, b); return r({ ok: true }); }
        case 'DELETE /api/entradas/:id': ent.apagarEntrada(ctx, conta, id); return r({ ok: true });
        case 'POST /api/entradas/:id/temas': { const b = await lerJson(req); return r({ id: ent.adicionarTema(ctx, conta, id, b) }, 201); }
        case 'POST /api/temas/:id': { const b = await lerJson(req); ent.atualizarTema(ctx, conta, id, b); return r({ ok: true }); }
        case 'DELETE /api/temas/:id': ent.apagarTema(ctx, conta, id); return r({ ok: true });
        case 'POST /api/temas/:id/grupos': { const b = await lerJson(req); ent.definirGruposTema(ctx, conta, id, Array.isArray(b.grupos) ? b.grupos : []); return r({ ok: true }); }
        case 'POST /api/grupos/:id/convite': return r({ convite: await ent.buscarConvite(ctx, conta, id) });
        case 'POST /api/grupos/:id/ajustes': { const b = await lerJson(req); ent.ajustarGrupo(ctx, conta, id, b); return r({ ok: true }); }
        case 'GET /api/numeros': return r({ lista: x.numerosComLimite(ctx, conta), limite: s.planoDa(db, conta).numeros });
        case 'POST /api/numeros': { const b = await lerJson(req); return r({ id: await s.novaInstancia(ctx, conta, String(b.nome ?? '')) }, 201); }
        case 'GET /api/numeros/:id/qr': { const i = s.instancia(db, conta, id); return r({ qr: await ctx.wpp.qrCode(i.chave), estado: await s.atualizarEstado(ctx, conta, id) }); }
        case 'POST /api/numeros/:id/atualizar': return r({ estado: await s.atualizarEstado(ctx, conta, id) });
        case 'POST /api/numeros/:id/sincronizar': return r({ grupos: await s.sincronizarGrupos(ctx, conta, id) });
        case 'DELETE /api/numeros/:id': {
          const i = s.instancia(db, conta, id);
          await ctx.wpp.desconectar(i.chave);
          db.prepare('DELETE FROM instancias WHERE id = ?').run(id);
          return r({ ok: true });
        }

        case 'GET /api/cupons': return r(db.prepare('SELECT * FROM cupons WHERE conta_id = ? ORDER BY ativo DESC, id DESC').all(conta));
        case 'POST /api/cupons': {
          const b = await lerJson(req);
          const codigo = String(b.codigo ?? '').trim().toUpperCase().slice(0, 40);
          if (!codigo) throw new s.ErroUso('Informe o código do cupom');
          db.prepare('INSERT INTO cupons (conta_id, codigo, plataforma, descricao, validade) VALUES (?, ?, ?, ?, ?)')
            .run(conta, codigo, String(b.plataforma ?? 'shopee'), String(b.descricao ?? '').slice(0, 120), String(b.validade ?? '').slice(0, 10));
          return r({ ok: true }, 201);
        }
        case 'POST /api/cupons/:id': { const b = await lerJson(req); db.prepare('UPDATE cupons SET ativo = ? WHERE id = ? AND conta_id = ?').run(b.ativo ? 1 : 0, id, conta); return r({ ok: true }); }
        case 'DELETE /api/cupons/:id': db.prepare('DELETE FROM cupons WHERE id = ? AND conta_id = ?').run(id, conta); return r({ ok: true });

        case 'GET /api/membros': return r(s.membros(ctx, conta, per, Number(url.searchParams.get('grupo')) || undefined));
        case 'GET /api/comissoes': return r(s.resumoComissoes(ctx, conta, per, url.searchParams.get('status') ?? ''));
        case 'POST /api/comissoes/sincronizar': return r({ itens: await s.sincronizarComissoes(ctx, conta) });

        case 'GET /api/config': {
          const c = s.config(db, conta);
          return r({ ...c, shopee_segredo: c.shopee_segredo ? '••••••••' : '', modelo_mensagem: c.modelo_mensagem });
        }
        case 'POST /api/lojas/extrair': {
          const b = await lerJson(req);
          if (sess.demo) return r({ valor: b.loja === 'amazon' ? 'carla-20' : 'matt_tool=12345678&matt_word=carla' });
          try { return r({ valor: await extrairAfiliado(String(b.loja ?? ''), String(b.url ?? ''), (u) => resolverLink(u, ctx.f)) }); }
          catch (e) { throw new s.ErroUso((e as Error).message); }
        }
        case 'POST /api/plataformas': {
          const b = await lerJson(req);
          const atual = s.config(db, conta);
          db.prepare('UPDATE config_conta SET shopee_app_id = ?, shopee_segredo = ?, amazon_tag = ?, ml_modelo = ? WHERE conta_id = ?').run(
            String(b.shopee_app_id ?? '').trim().slice(0, 40),
            b.shopee_segredo && !String(b.shopee_segredo).startsWith('•') ? String(b.shopee_segredo).trim().slice(0, 100) : atual.shopee_segredo,
            String(b.amazon_tag ?? '').trim().slice(0, 40), String(b.ml_modelo ?? '').trim().slice(0, 300), conta);
          return r({ ok: true });
        }
        case 'POST /api/config': {
          const b = await lerJson(req);
          const atual = s.config(db, conta);
          const n = (v: unknown, min: number, max: number, padrao: number) => Math.min(max, Math.max(min, Number(v) || padrao));
          const min = n(b.intervalo_min, 10, 600, 25);
          const hora = (v: unknown, padrao: number) => { const x = Number(v); return Number.isInteger(x) && x >= 0 && x <= 24 ? x % 24 : padrao; };
          const fone = String(b.resumo_numero ?? '').replace(/\D/g, '');
          if (fone && (fone.length < 12 || fone.length > 13)) throw new s.ErroUso('Número do resumo: use DDI + DDD + número, ex.: 5511988887777');
          const horarios = s.lerHorarios(String(b.horarios_auto ?? ''));
          if (horarios.length > 24) throw new s.ErroUso('Use no máximo 24 horários automáticos');
          db.prepare(`UPDATE config_conta SET shopee_app_id = ?, shopee_segredo = ?, amazon_tag = ?, ml_modelo = ?, modelo_mensagem = ?,
              intervalo_min = ?, intervalo_max = ?, auto_publicar = ?, desconto_minimo = ?,
              janela_inicio = ?, janela_fim = ?, repeticao_horas = ?, contar_cliques = ?, conferir_preco = ?,
              horarios_auto = ?, resumo_numero = ?, resumo_hora = ? WHERE conta_id = ?`).run(
            // As lojas ficam em Conectar plataformas (6.6); sem os campos, mantém o que está salvo.
            'shopee_app_id' in b ? String(b.shopee_app_id ?? '').trim().slice(0, 40) : atual.shopee_app_id,
            b.shopee_segredo && !String(b.shopee_segredo).startsWith('•') ? String(b.shopee_segredo).trim().slice(0, 100) : atual.shopee_segredo,
            'amazon_tag' in b ? String(b.amazon_tag ?? '').trim().slice(0, 40) : atual.amazon_tag,
            'ml_modelo' in b ? String(b.ml_modelo ?? '').trim().slice(0, 300) : atual.ml_modelo,
            String(b.modelo_mensagem ?? '').slice(0, 1500), min, Math.max(min + 5, n(b.intervalo_max, 15, 900, 70)),
            b.auto_publicar ? 1 : 0, n(b.desconto_minimo, 0, 90, 0),
            hora(b.janela_inicio, 8), hora(b.janela_fim, 22), Math.min(720, Math.max(0, Math.round(Number(b.repeticao_horas) || 0))),
            b.contar_cliques ? 1 : 0, b.conferir_preco ? 1 : 0, horarios.join(', '), fone, hora(b.resumo_hora, 21), conta);
          return r({ ok: true });
        }
        // ---------- v5 ----------
        case 'GET /api/primeiros-passos': return r(x.primeirosPassos(db, conta));
        case 'POST /api/pausa': { const b = await lerJson(req); x.pausar(db, conta, !!b.pausado); return r({ pausado: !!b.pausado }); }
        case 'POST /api/teste-envio': { const b = await lerJson(req); await x.enviarTeste(ctx, conta, String(b.texto ?? ''), String(b.imagem ?? '')); return r({ ok: true }); }
        case 'GET /api/recorrentes': return r(x.listarRecorrentes(db, conta));
        case 'POST /api/recorrentes': return r({ id: x.salvarRecorrente(db, conta, await lerJson(req)) }, 201);
        case 'PUT /api/recorrentes/:id': return r({ id: x.salvarRecorrente(db, conta, await lerJson(req), id) });
        case 'POST /api/recorrentes/:id/ativo': { const b = await lerJson(req); db.prepare('UPDATE recorrentes SET ativo = ? WHERE id = ? AND conta_id = ?').run(b.ativo ? 1 : 0, id, conta); return r({ ok: true }); }
        case 'DELETE /api/recorrentes/:id': db.prepare('DELETE FROM recorrentes WHERE id = ? AND conta_id = ?').run(id, conta); return r({ ok: true });
        case 'POST /api/ofertas/campeas': { const b = await lerJson(req); return r({ quantas: x.reenviarCampeas(ctx, conta, String(b.periodo ?? '7d')) }); }
        case 'GET /api/ofertas/:id/parecidas': return r(x.parecidas(db, conta, id));
        case 'GET /api/ofertas/:id/precos': return r(x.historicoPreco(db, conta, id));
        case 'POST /api/ofertas/:id/arquivar': { const b = await lerJson(req); s.oferta(db, conta, id); db.prepare('UPDATE ofertas SET arquivada = ?, vitrine = CASE WHEN ? THEN 0 ELSE vitrine END WHERE id = ?').run(b.arquivada ? 1 : 0, b.arquivada ? 1 : 0, id); return r({ ok: true }); }
        case 'GET /api/horarios': return r(x.melhoresHorarios(ctx, conta));
        case 'POST /api/horarios/usar': {
          const b = await lerJson(req);
          const h = s.lerHorarios(Array.isArray(b.horarios) ? b.horarios.join(',') : String(b.horarios ?? ''));
          if (!h.length) throw new s.ErroUso('Nenhum horário para usar');
          db.prepare('UPDATE config_conta SET horarios_auto = ? WHERE conta_id = ?').run(h.join(', '), conta);
          return r({ horarios: h });
        }
        case 'GET /api/resultados': return r(x.metaEFunil(ctx, conta, per));
        case 'GET /api/cansados': return r(x.gruposCansados(ctx, conta, per));
        case 'GET /api/extras': {
          const c = s.config(db, conta);
          return r({ aquecimento: !!c.aquecimento, pausado: !!c.pausado, boas_vindas: c.boas_vindas, boas_vindas_min: c.boas_vindas_min, arquivar_dias: c.arquivar_dias, meta_comissao: c.meta_comissao, resumo_semanal: !!c.resumo_semanal, resumo_numero: c.resumo_numero });
        }
        case 'POST /api/extras': {
          const b = await lerJson(req);
          const int = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));
          db.prepare('UPDATE config_conta SET aquecimento = ?, boas_vindas = ?, boas_vindas_min = ?, arquivar_dias = ?, meta_comissao = ?, resumo_semanal = ? WHERE conta_id = ?').run(
            b.aquecimento ? 1 : 0, String(b.boas_vindas ?? '').trim().slice(0, 1000), int(b.boas_vindas_min, 10, 1440) || 60,
            [0, 15, 30, 60, 90].includes(Number(b.arquivar_dias)) ? Number(b.arquivar_dias) : 0, int(b.meta_comissao, 0, 100_000_000), b.resumo_semanal ? 1 : 0, conta);
          return r({ ok: true });
        }
        case 'POST /api/ofertas/:id/categoria': {
          const b = await lerJson(req);
          if (!ID_CATEGORIAS.has(String(b.categoria ?? ''))) throw new s.ErroUso('Categoria inválida');
          s.oferta(db, conta, id);
          db.prepare('UPDATE ofertas SET categoria = ? WHERE id = ? AND conta_id = ?').run(String(b.categoria), id, conta);
          return r({ ok: true });
        }
        case 'GET /api/nicho': {
          const c = s.config(db, conta);
          const n = s.nichoDa(db, conta);
          // Quantas ofertas da vitrine há para cada coleção da semana.
          const vit = db.prepare("SELECT COALESCE(NULLIF(categoria, ''), 'outros') AS cat, COUNT(*) AS n FROM ofertas WHERE conta_id = ? AND vitrine = 1 AND esgotada = 0 GROUP BY cat").all(conta) as any[];
          return r({ nicho: n, categorias: CATEGORIAS.map(({ id: i, nome, emoji }) => ({ id: i, nome, emoji, naVitrine: Number(vit.find((v) => v.cat === i)?.n ?? 0) })),
            modelos: MODELOS, rodapePadrao: RODAPE_PADRAO, horarios: c.horarios_auto, temModelo: !!String(c.modelo_mensagem).trim() });
        }
        case 'POST /api/nicho': {
          const n = limparNicho(await lerJson(req));
          db.prepare('UPDATE config_conta SET nicho = ? WHERE conta_id = ?').run(JSON.stringify(n), conta);
          return r({ nicho: n });
        }
        case 'POST /api/nicho/modelo': {
          const b = await lerJson(req);
          const m = MODELOS.find((x) => x.id === String(b.id ?? ''));
          if (!m) throw new s.ErroUso('Modelo não encontrado');
          db.prepare('UPDATE config_conta SET modelo_mensagem = ? WHERE conta_id = ?').run(m.texto, conta);
          return r({ ok: true });
        }
        case 'POST /api/nicho/achadinhos': {
          // Pacote pronto: regras, coleções, rodapé, modelo de mensagem e horários de um grupo de achadinhos.
          db.prepare('UPDATE config_conta SET nicho = ?, modelo_mensagem = ?, horarios_auto = ? WHERE conta_id = ?')
            .run(JSON.stringify(PACOTE_ACHADINHOS.nicho), PACOTE_ACHADINHOS.modelo, PACOTE_ACHADINHOS.horarios, conta);
          // Ofertas antigas sem categoria ganham uma agora.
          for (const o of db.prepare("SELECT id, titulo FROM ofertas WHERE conta_id = ? AND categoria = ''").all(conta) as any[])
            db.prepare('UPDATE ofertas SET categoria = ? WHERE id = ?').run(classificar(o.titulo), o.id);
          return r({ nicho: PACOTE_ACHADINHOS.nicho });
        }
        case 'POST /api/nicho/testar': {
          // Diz se uma oferta passaria nas regras, sem salvar nada.
          const b = await lerJson(req);
          const o = s.oferta(db, conta, Number(b.oferta));
          const motivo = motivoRecusa(limparNicho(b.nicho ?? s.nichoDa(db, conta)).regras, { titulo: o.titulo, categoria: o.categoria, precoPor: o.preco_por, nota: o.nota, vendas: o.vendas });
          return r({ passa: !motivo, motivo });
        }
        case 'POST /api/previa': {
          const b = await lerJson(req);
          const modelo = montarMensagem({ titulo: 'Air Fryer Digital 4L', precoDe: 39990, precoPor: 21990, link: 'https://s.shopee.com.br/exemplo', plataforma: 'Shopee', cupom: 'PIPOCA10' }, String(b.modelo ?? ''));
          return r({ texto: expandirVariacoes(modelo, true), variacoes: temVariacoes(modelo), exemplos: [1, 2, 3].map(() => expandirVariacoes(modelo)) });
        }

        case 'GET /api/admin/contas': {
          if (!sess.admin) return r({ erro: 'Somente administradores' }, 403);
          const lista = app.real.db.prepare(`SELECT c.id, c.email, c.nome, c.plano, c.criado_em,
              (SELECT COUNT(*) FROM instancias i WHERE i.conta_id = c.id AND i.status = 'conectado') AS conectados,
              (SELECT COUNT(*) FROM grupos g WHERE g.conta_id = c.id AND g.enviar = 1) AS grupos,
              (SELECT COUNT(*) FROM envios e WHERE e.conta_id = c.id AND e.status = 'enviado' AND e.enviado_em > ?) AS envios30
            FROM contas c ORDER BY c.criado_em DESC`).all(Date.now() - 30 * 86_400_000);
          return r({ lista, planos: Object.values(PLANOS) });
        }
        case 'POST /api/admin/contas/:id': {
          if (!sess.admin) return r({ erro: 'Somente administradores' }, 403);
          const b = await lerJson(req);
          if (!PLANOS[b.plano]) throw new s.ErroUso('Plano inválido');
          app.real.db.prepare('UPDATE contas SET plano = ? WHERE id = ?').run(b.plano, id);
          return r({ ok: true });
        }
      }
      return r({ erro: 'Não encontrado' }, 404);
    } catch (e) {
      if (e instanceof s.ErroUso) return json(res, e.status, { erro: e.message });
      console.error(e);
      return json(res, 500, { erro: (e as Error).message?.startsWith('Shopee') || (e as Error).message?.startsWith('Evolution') ? (e as Error).message : 'Erro interno' });
    }
  });
}

/** Rodadas de fundo: agendamentos que venceram viram envios; a fila manda o que está na hora. */
export function iniciarRotinas(app: App, intervaloMs = 5000) {
  let rodando = false;
  const rodada = async () => {
    if (rodando) return;
    rodando = true;
    try {
      for (const c of [app.real, app.demo]) { s.rodarHorarios(c); x.rodarRecorrentes(c); x.rodarBoasVindas(c); v6.rodarListaDia(c); await s.despachar(c); await s.processarFila(c); }
    } catch (e) { console.error('fila', e); } finally { rodando = false; }
  };
  const fila = setInterval(rodada, intervaloMs);
  // Comissões da Shopee: a cada 6 horas, para quem tem credenciais.
  const comissoes = setInterval(async () => {
    const contas = app.real.db.prepare("SELECT conta_id FROM config_conta WHERE shopee_app_id <> '' AND shopee_segredo <> ''").all() as any[];
    for (const c of contas) await s.sincronizarComissoes(app.real, Number(c.conta_id)).catch((e) => console.error('comissões', c.conta_id, e.message));
  }, 6 * 3600_000);
  // Resumo diário no WhatsApp: confere a cada minuto se chegou o horário de alguém.
  const resumos = setInterval(() => {
    s.rodarResumos(app.real).catch((e) => console.error('resumos', e));
    x.rodarResumoSemanal(app.real).catch((e) => console.error('resumo semanal', e));
  }, 60_000);
  // Vitrine abastecida sozinha: confere a cada 5 minutos se chegou o horário de alguém.
  const abastecer = setInterval(() => { v6.rodarAbastecer(app.real).catch((e) => console.error('abastecer', e)); }, 5 * 60_000);
  // Arquivamento das ofertas paradas: uma vez por hora.
  const arquivo = setInterval(() => {
    try { x.rodarArquivamento(app.real); v10.limparMidias(app.real.db, Date.now()); } catch (e) { console.error('arquivo', e); }
  }, 3600_000);
  // Estado dos números a cada 5 minutos (além do aviso que a Evolution API manda quando cai).
  const estados = setInterval(async () => {
    const lista = app.real.db.prepare('SELECT id, conta_id FROM instancias').all() as any[];
    for (const i of lista) await s.atualizarEstado(app.real, Number(i.conta_id), Number(i.id)).catch(() => {});
  }, 5 * 60_000);
  // Participantes atualizados a cada 30 minutos (o link de entrada depende disso para saber quem lotou).
  const participantes = setInterval(async () => {
    const lista = app.real.db.prepare("SELECT id, conta_id FROM instancias WHERE status = 'conectado'").all() as any[];
    for (const i of lista) await s.sincronizarGrupos(app.real, Number(i.conta_id), Number(i.id)).catch(() => {});
  }, 30 * 60_000);
  return () => { clearInterval(fila); clearInterval(comissoes); clearInterval(resumos); clearInterval(estados); clearInterval(participantes); clearInterval(arquivo); clearInterval(abastecer); };
}
