// Link de entrada inteligente: uma página pública (ex.: link da bio do Instagram) que manda cada pessoa
// para o grupo do tema escolhido que ainda tem vaga, e conta visitas e cliques por origem (bio, stories, reels...).
import { type DB } from './db.ts';
import { ErroUso, periodo, type Ctx, type Aviso } from './servico.ts';

export const MAX_ENTRADAS = 5;
export const MAX_TEMAS = 8;
const RESERVADOS = new Set(['admin', 'api', 'demo', 'exemplo-achadinhos', 'painel', 'sair', 'sso', 'r', 'g', 'webhook', 'ofertix']);
const t = (c: Ctx) => (c.agora ?? Date.now)();

export function slugValido(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(slug) && !slug.includes('--') && !RESERVADOS.has(slug);
}
export const limparOrigem = (o: unknown) => String(o ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
const cor = (v: unknown, padrao = '#e8457c') => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : padrao);
const foto = (v: unknown) => { const s = String(v ?? '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(s) ? s.slice(0, 500) : ''; };
const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const linkConvite = (v: unknown) => /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/.test(String(v ?? '').trim());

export function entrada(db: DB, conta: number, id: number) {
  const e = db.prepare('SELECT * FROM entradas WHERE id = ? AND conta_id = ?').get(id, conta) as any;
  if (!e) throw new ErroUso('Link de entrada não encontrado', 404);
  return e;
}
function tema(db: DB, conta: number, id: number) {
  const x = db.prepare('SELECT t.* FROM entradas_temas t JOIN entradas e ON e.id = t.entrada_id WHERE t.id = ? AND e.conta_id = ?').get(id, conta) as any;
  if (!x) throw new ErroUso('Tema não encontrado', 404);
  return x;
}

export function criarEntrada(c: Ctx, conta: number, d: any): number {
  const slug = String(d.slug ?? '').trim().toLowerCase();
  if (!slugValido(slug)) throw new ErroUso('Endereço inválido: use de 3 a 40 letras minúsculas, números ou hífen (ex.: achadinhos-da-moca)');
  if (c.db.prepare('SELECT 1 FROM entradas WHERE slug = ?').get(slug)) throw new ErroUso('Esse endereço já está em uso. Escolha outro.');
  const n = (c.db.prepare('SELECT COUNT(*) AS n FROM entradas WHERE conta_id = ?').get(conta) as any).n;
  if (n >= MAX_ENTRADAS) throw new ErroUso(`Use no máximo ${MAX_ENTRADAS} links de entrada`);
  const titulo = texto(d.titulo, 60);
  if (!titulo) throw new ErroUso('Dê um nome para a página (ex.: Achadinhos da Moça)');
  const r = c.db.prepare('INSERT INTO entradas (conta_id, slug, titulo, descricao, cor, foto, aviso_afiliado, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(conta, slug, titulo, texto(d.descricao, 240), cor(d.cor), foto(d.foto), d.aviso_afiliado === false ? 0 : 1, t(c));
  return Number(r.lastInsertRowid);
}

export function atualizarEntrada(c: Ctx, conta: number, id: number, d: any) {
  const e = entrada(c.db, conta, id);
  const titulo = texto(d.titulo ?? e.titulo, 60);
  if (!titulo) throw new ErroUso('Dê um nome para a página');
  c.db.prepare('UPDATE entradas SET titulo = ?, descricao = ?, cor = ?, foto = ?, aviso_afiliado = ?, ativo = ? WHERE id = ?').run(
    titulo, texto(d.descricao ?? e.descricao, 240), cor(d.cor ?? e.cor, e.cor), d.foto === undefined ? e.foto : foto(d.foto),
    d.aviso_afiliado === undefined ? e.aviso_afiliado : d.aviso_afiliado ? 1 : 0, d.ativo === undefined ? e.ativo : d.ativo ? 1 : 0, id);
}

export function apagarEntrada(c: Ctx, conta: number, id: number) {
  entrada(c.db, conta, id);
  c.db.prepare('DELETE FROM entradas WHERE id = ?').run(id);
}

export function adicionarTema(c: Ctx, conta: number, entradaId: number, d: any): number {
  entrada(c.db, conta, entradaId);
  const nome = texto(d.nome, 40);
  if (!nome) throw new ErroUso('Dê um nome para o tema (ex.: Beleza e skincare)');
  const n = (c.db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(ordem), 0) AS m FROM entradas_temas WHERE entrada_id = ?').get(entradaId) as any);
  if (n.n >= MAX_TEMAS) throw new ErroUso(`Use no máximo ${MAX_TEMAS} temas por página`);
  const r = c.db.prepare('INSERT INTO entradas_temas (entrada_id, nome, emoji, ordem) VALUES (?, ?, ?, ?)').run(entradaId, nome, texto(d.emoji, 8), Number(n.m) + 1);
  return Number(r.lastInsertRowid);
}

export function atualizarTema(c: Ctx, conta: number, id: number, d: any) {
  const x = tema(c.db, conta, id);
  c.db.prepare('UPDATE entradas_temas SET nome = ?, emoji = ? WHERE id = ?').run(texto(d.nome ?? x.nome, 40) || x.nome, texto(d.emoji ?? x.emoji, 8), id);
}

export function apagarTema(c: Ctx, conta: number, id: number) {
  tema(c.db, conta, id);
  c.db.prepare('DELETE FROM entradas_temas WHERE id = ?').run(id);
}

/** Define os grupos do tema, na ordem em que vão lotando (o primeiro enche, depois o segundo...). */
export function definirGruposTema(c: Ctx, conta: number, temaId: number, grupos: unknown[]) {
  tema(c.db, conta, temaId);
  const ids = [...new Set(grupos.map(Number).filter(Number.isInteger))];
  for (const g of ids) if (!c.db.prepare('SELECT 1 FROM grupos WHERE id = ? AND conta_id = ?').get(g, conta)) throw new ErroUso('Grupo não encontrado', 404);
  c.db.prepare('DELETE FROM entradas_grupos WHERE tema_id = ?').run(temaId);
  ids.forEach((g, i) => c.db.prepare('INSERT INTO entradas_grupos (tema_id, grupo_id, ordem) VALUES (?, ?, ?)').run(temaId, g, i));
}

export async function buscarConvite(c: Ctx, conta: number, grupoId: number): Promise<string> {
  const g = c.db.prepare('SELECT g.*, i.chave FROM grupos g JOIN instancias i ON i.id = g.instancia_id WHERE g.id = ? AND g.conta_id = ?').get(grupoId, conta) as any;
  if (!g) throw new ErroUso('Grupo não encontrado', 404);
  const url = await c.wpp.convite(g.chave, g.jid);
  c.db.prepare('UPDATE grupos SET convite = ? WHERE id = ?').run(url, grupoId);
  return url;
}

export function ajustarGrupo(c: Ctx, conta: number, grupoId: number, d: any) {
  const g = c.db.prepare('SELECT * FROM grupos WHERE id = ? AND conta_id = ?').get(grupoId, conta) as any;
  if (!g) throw new ErroUso('Grupo não encontrado', 404);
  if (d.convite !== undefined && d.convite !== '' && !linkConvite(d.convite)) throw new ErroUso('Cole o link de convite do grupo (https://chat.whatsapp.com/...)');
  const limite = d.limite === undefined ? g.limite : Math.min(1024, Math.max(10, Math.round(Number(d.limite) || 1000)));
  c.db.prepare('UPDATE grupos SET convite = ?, limite = ? WHERE id = ?').run(d.convite === undefined ? g.convite : String(d.convite).trim(), limite, grupoId);
}

// ---------------- Página pública ----------------

interface TemaPublico { id: number; nome: string; emoji: string; vagas: boolean }

function temasPublicos(db: DB, entradaId: number): TemaPublico[] {
  const temas = db.prepare('SELECT * FROM entradas_temas WHERE entrada_id = ? ORDER BY ordem, id').all(entradaId) as any[];
  return temas.map((x) => ({ id: Number(x.id), nome: x.nome, emoji: x.emoji, vagas: !!escolherGrupo(db, Number(x.id)) }));
}

/** Primeiro grupo do tema (na ordem definida) com link de convite e abaixo do limite. */
export function escolherGrupo(db: DB, temaId: number): { id: number; convite: string } | null {
  return (db.prepare(`SELECT g.id, g.convite FROM entradas_grupos eg JOIN grupos g ON g.id = eg.grupo_id
    WHERE eg.tema_id = ? AND g.convite <> '' AND g.participantes < g.limite ORDER BY eg.ordem LIMIT 1`).get(temaId) as any) ?? null;
}

export function abrirEntrada(c: Ctx, slug: string, origem: string) {
  const e = c.db.prepare('SELECT * FROM entradas WHERE slug = ? AND ativo = 1').get(slug) as any;
  if (!e) return null;
  c.db.prepare("INSERT INTO entradas_acessos (entrada_id, tipo, origem, em) VALUES (?, 'visita', ?, ?)").run(e.id, limparOrigem(origem), t(c));
  const total = (c.db.prepare(`SELECT COALESCE(SUM(g.participantes), 0) AS n FROM grupos g WHERE g.id IN
    (SELECT eg.grupo_id FROM entradas_grupos eg JOIN entradas_temas x ON x.id = eg.tema_id WHERE x.entrada_id = ?)`).get(e.id) as any).n;
  return { entrada: e, temas: temasPublicos(c.db, e.id), participantes: Number(total) };
}

/** Clique num tema: devolve o convite do grupo com vaga (e conta), ou null se todos lotaram. */
export function irParaGrupo(c: Ctx, slug: string, temaId: number, origem: string): { url: string | null; entrada: any } | null {
  const e = c.db.prepare('SELECT * FROM entradas WHERE slug = ? AND ativo = 1').get(slug) as any;
  if (!e) return null;
  const x = c.db.prepare('SELECT * FROM entradas_temas WHERE id = ? AND entrada_id = ?').get(temaId, e.id) as any;
  if (!x) return null;
  const g = escolherGrupo(c.db, temaId);
  c.db.prepare('INSERT INTO entradas_acessos (entrada_id, tema_id, grupo_id, tipo, origem, em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(e.id, temaId, g?.id ?? null, g ? 'clique' : 'lotado', limparOrigem(origem), t(c));
  return { url: g?.convite ?? null, entrada: e };
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const num = (n: number) => n.toLocaleString('pt-BR');

/** HTML da página pública. `base` é o caminho da página (ex.: /g/achadinhos-da-moca). */
export function paginaEntrada(d: { entrada: any; temas: TemaPublico[]; participantes: number }, base: string, origem: string, aviso = ''): string {
  const e = d.entrada;
  const o = origem ? `?o=${encodeURIComponent(origem)}` : '';
  const iniciais = esc(String(e.titulo).trim().split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase());
  const temas = d.temas.length ? d.temas.map((x) => x.vagas
    ? `<a class="tema" href="${esc(base)}/${x.id}${o}"><span class="emj">${esc(x.emoji || '🛍️')}</span><span class="nm">${esc(x.nome)}</span><span class="ir">Entrar <span aria-hidden="true">→</span></span></a>`
    : `<div class="tema lotado" aria-disabled="true"><span class="emj">${esc(x.emoji || '🛍️')}</span><span class="nm">${esc(x.nome)}</span><span class="ir">Lotado</span></div>`).join('')
    : '<p class="vazio">Os grupos abrem em breve.</p>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(e.titulo)}</title><meta name="description" content="${esc(e.descricao || 'Entre nos grupos de achadinhos e ofertas')}">
<meta property="og:title" content="${esc(e.titulo)}"><meta property="og:description" content="${esc(e.descricao || 'Entre nos grupos de achadinhos e ofertas')}">${e.foto ? `<meta property="og:image" content="${esc(e.foto)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--cor:${esc(e.cor)};--fundo:#0e0c0d;--cartao:#19161a;--borda:#2a2529;--tinta:#f6f1f3;--tinta2:#b9adb3;color-scheme:dark}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--fundo:#fbf7f8;--cartao:#ffffff;--borda:#eadfe3;--tinta:#1b1418;--tinta2:#6e5f66;color-scheme:light}}
:root[data-theme="light"]{--fundo:#fbf7f8;--cartao:#ffffff;--borda:#eadfe3;--tinta:#1b1418;--tinta2:#6e5f66;color-scheme:light}
*{box-sizing:border-box;margin:0}
body{background:var(--fundo);color:var(--tinta);font:16px/1.5 Inter,system-ui,sans-serif;min-height:100vh;padding:max(28px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));
  background-image:radial-gradient(600px 380px at 50% -80px,color-mix(in srgb,var(--cor) 28%,transparent),transparent 70%)}
main{max-width:460px;margin:0 auto;display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px}
.foto{width:116px;height:116px;border-radius:50%;padding:4px;background:conic-gradient(from 210deg,#f9ce34,#ee2a7b,#6228d7,#f9ce34)}
.foto>*{width:100%;height:100%;border-radius:50%;border:4px solid var(--fundo);object-fit:cover;display:grid;place-items:center;background:#111;color:#fff;font:600 38px 'Cormorant Garamond',Georgia,serif}
h1{font:600 42px/1.05 'Cormorant Garamond',Georgia,serif;letter-spacing:-.01em;text-wrap:balance}
h1 i{color:var(--cor)}
.desc{color:var(--tinta2);max-width:380px}
.prova{font-size:14px;font-weight:600;color:var(--tinta);background:color-mix(in srgb,var(--cor) 16%,transparent);padding:7px 14px;border-radius:99px}
.temas{width:100%;display:flex;flex-direction:column;gap:10px;margin-top:4px}
.tema{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:18px;background:var(--cartao);border:1px solid var(--borda);color:inherit;text-decoration:none;text-align:left;transition:transform .12s,border-color .12s}
.tema:hover,.tema:focus-visible{border-color:var(--cor);transform:translateY(-1px);outline:none}
.tema .emj{font-size:28px;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--cor) 14%,transparent);flex:none}
.tema .nm{flex:1;font-weight:600;font-size:17px}
.tema .ir{font-size:14px;font-weight:700;color:#fff;background:var(--cor);padding:7px 13px;border-radius:99px;white-space:nowrap}
.tema.lotado{opacity:.55}.tema.lotado .ir{background:var(--borda);color:var(--tinta2)}
.aviso{width:100%;padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--cor) 14%,transparent);font-size:14px}
.vazio{color:var(--tinta2)}
.semana{font-size:14px;font-weight:600;color:var(--cor);text-decoration:none}
.regras{font-size:13px;color:var(--tinta2);display:flex;flex-direction:column;gap:4px;margin-top:6px}
footer{font-size:12px;color:var(--tinta2);margin-top:10px;opacity:.8}
@media (prefers-reduced-motion: reduce){.tema{transition:none}}
</style></head><body><main>
<div class="foto">${e.foto ? `<img src="${esc(e.foto)}" alt="">` : `<div>${iniciais}</div>`}</div>
<h1>${esc(e.titulo)}</h1>
${e.descricao ? `<p class="desc">${esc(e.descricao)}</p>` : ''}
${d.participantes >= 50 ? `<span class="prova">✨ ${num(d.participantes)} pessoas já estão nos grupos</span>` : ''}
${aviso ? `<div class="aviso" role="status">${esc(aviso)}</div>` : ''}
<div class="temas">${temas}</div>
<a class="semana" href="/v/${esc(e.slug)}">Ver os achadinhos da semana →</a>
<div class="regras"><span>Só a administração posta: nada de spam.</span><span>Você pode sair do grupo quando quiser.</span>${e.aviso_afiliado ? '<span>Os links das ofertas são links de afiliado.</span>' : ''}</div>
<footer>Grupos organizados com Ofertix</footer>
</main></body></html>`;
}

// ---------------- Painel ----------------

export function painelEntradas(c: Ctx, conta: number, nomePeriodo: string) {
  const { de, ate } = periodo(nomePeriodo, t(c));
  const lista = c.db.prepare('SELECT * FROM entradas WHERE conta_id = ? ORDER BY id').all(conta) as any[];
  return lista.map((e) => {
    const temas = (c.db.prepare('SELECT * FROM entradas_temas WHERE entrada_id = ? ORDER BY ordem, id').all(e.id) as any[]).map((x) => {
      const grupos = c.db.prepare(`SELECT g.id, g.nome, g.participantes, g.limite, g.convite <> '' AS tem_convite, g.convite FROM entradas_grupos eg JOIN grupos g ON g.id = eg.grupo_id
        WHERE eg.tema_id = ? ORDER BY eg.ordem`).all(x.id) as any[];
      const ativo = escolherGrupo(c.db, Number(x.id));
      const cliques = (c.db.prepare("SELECT COUNT(*) AS n FROM entradas_acessos WHERE tema_id = ? AND tipo = 'clique' AND em >= ? AND em < ?").get(x.id, de, ate) as any).n;
      return { ...x, grupos, ativo: ativo?.id ?? null, cliques };
    });
    const ac = c.db.prepare('SELECT tipo, origem, COUNT(*) AS n FROM entradas_acessos WHERE entrada_id = ? AND em >= ? AND em < ? GROUP BY tipo, origem').all(e.id, de, ate) as any[];
    const soma = (tipo: string) => ac.filter((a) => a.tipo === tipo).reduce((s, a) => s + Number(a.n), 0);
    const origens = [...new Set(ac.map((a) => a.origem))].map((o) => ({
      origem: o || 'direto',
      visitas: ac.filter((a) => a.origem === o && a.tipo === 'visita').reduce((s, a) => s + Number(a.n), 0),
      cliques: ac.filter((a) => a.origem === o && a.tipo === 'clique').reduce((s, a) => s + Number(a.n), 0),
    })).sort((a, b) => b.cliques - a.cliques || b.visitas - a.visitas);
    const ids = temas.flatMap((x) => x.grupos.map((g: any) => g.id));
    const entraram = ids.length ? Number((c.db.prepare(`SELECT COALESCE(SUM(qtd), 0) AS n FROM membros_eventos WHERE tipo = 'entrou' AND em >= ? AND em < ? AND grupo_id IN (${ids.map(() => '?').join(',')})`).get(de, ate, ...ids) as any).n) : 0;
    return { ...e, temas, visitas: soma('visita'), cliques: soma('clique'), lotados: soma('lotado'), entraram, origens };
  });
}

export function avisosEntradas(c: Ctx, conta: number): Aviso[] {
  const lista: Aviso[] = [];
  const temas = c.db.prepare('SELECT x.id, x.nome, e.titulo FROM entradas_temas x JOIN entradas e ON e.id = x.entrada_id WHERE e.conta_id = ? AND e.ativo = 1').all(conta) as any[];
  for (const x of temas) {
    const grupos = c.db.prepare('SELECT g.participantes, g.limite, g.convite FROM entradas_grupos eg JOIN grupos g ON g.id = eg.grupo_id WHERE eg.tema_id = ?').all(x.id) as any[];
    const nome = `"${x.nome}" (${x.titulo})`;
    if (!grupos.length) { lista.push({ nivel: 'atencao', texto: `O tema ${nome} não tem grupos: quem clicar vai ver "lotado".`, link: '#entradas' }); continue; }
    const comVaga = grupos.filter((g) => g.convite && g.participantes < g.limite);
    if (!comVaga.length) lista.push({ nivel: 'erro', texto: `Os grupos do tema ${nome} lotaram. Crie um grupo novo e adicione ao tema.`, link: '#entradas' });
    else {
      const vagas = comVaga.reduce((s, g) => s + (g.limite - g.participantes), 0);
      if (vagas < 100) lista.push({ nivel: 'atencao', texto: `Restam ${vagas} vagas nos grupos do tema ${nome}. Já deixe o próximo grupo pronto.`, link: '#entradas' });
    }
    if (grupos.some((g) => !g.convite)) lista.push({ nivel: 'info', texto: `Há grupo sem link de convite no tema ${nome}; ele fica fora do rodízio.`, link: '#entradas' });
  }
  return lista;
}

// ---------------- Vitrine pública (v5) ----------------

const reaisPub = (c: number | null) => (c ? 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const zap = (t: string) => esc(t).replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>').replace(/\*([^*\n]+)\*/g, '<b>$1</b>');

/** Página com os achadinhos enviados na semana, para a bio e os Stories. */
export function paginaVitrine(d: { entrada: any; ofertas: { titulo: string; imagem: string; preco_de: number | null; preco_por: number | null; link: string }[]; rodape: string }): string {
  const e = d.entrada;
  const foto = (img: string) => (/^https?:\/\//.test(img) ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span>${esc(img.startsWith('emoji:') ? img.slice(6) : '🛍️')}</span>`);
  const cards = d.ofertas.length ? d.ofertas.map((o) => {
    const pct = o.preco_de && o.preco_por && o.preco_de > o.preco_por ? Math.round((1 - o.preco_por / o.preco_de) * 100) : 0;
    return `<a class="of" href="${esc(o.link)}" rel="nofollow sponsored noopener" target="_blank"><div class="ft">${foto(o.imagem)}${pct ? `<b class="off">-${pct}%</b>` : ''}</div>
      <div class="tx"><span class="ti">${esc(o.titulo)}</span><span class="pr">${pct ? `<s>${reaisPub(o.preco_de)}</s>` : ''}<b>${reaisPub(o.preco_por) || 'Ver preço'}</b></span><span class="bt">Ver oferta →</span></div></a>`;
  }).join('') : '<p class="vazio">Os achadinhos da semana aparecem aqui assim que saírem nos grupos.</p>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Achadinhos da semana · ${esc(e.titulo)}</title><meta name="description" content="Os achadinhos que saíram nos grupos de ${esc(e.titulo)} nos últimos 7 dias">
<meta property="og:title" content="Achadinhos da semana · ${esc(e.titulo)}">${e.foto ? `<meta property="og:image" content="${esc(e.foto)}">` : ''}
<style>
:root{--cor:${esc(e.cor)};--fundo:#0e0c0d;--cartao:#19161a;--borda:#2a2529;--tinta:#f6f1f3;--tinta2:#b9adb3;color-scheme:dark}
@media (prefers-color-scheme: light){:root{--fundo:#fbf7f8;--cartao:#ffffff;--borda:#eadfe3;--tinta:#1b1418;--tinta2:#6e5f66;color-scheme:light}}
*{box-sizing:border-box;margin:0}
body{background:var(--fundo);color:var(--tinta);font:15px/1.45 Inter,system-ui,sans-serif;padding:28px 16px 40px;background-image:radial-gradient(600px 380px at 50% -80px,color-mix(in srgb,var(--cor) 26%,transparent),transparent 70%)}
main{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
header{text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
h1{font:600 34px/1.1 Georgia,serif}.sub{color:var(--tinta2)}
.entrar{display:inline-block;background:var(--cor);color:#fff;font-weight:700;padding:11px 20px;border-radius:99px;text-decoration:none}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.of{background:var(--cartao);border:1px solid var(--borda);border-radius:16px;overflow:hidden;color:inherit;text-decoration:none;display:flex;flex-direction:column}
.of:hover{border-color:var(--cor)}
.ft{aspect-ratio:1;background:color-mix(in srgb,var(--cor) 10%,var(--cartao));display:grid;place-items:center;position:relative;font-size:54px}.ft img{width:100%;height:100%;object-fit:cover}
.off{position:absolute;top:8px;left:8px;background:var(--cor);color:#fff;font-size:12px;padding:3px 8px;border-radius:99px}
.tx{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;flex:1}.ti{font-size:13.5px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pr{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}.pr s{color:var(--tinta2);font-size:12px}.pr b{font-size:16px}
.bt{margin-top:auto;font-size:13px;font-weight:700;color:var(--cor)}
.vazio,.rod{color:var(--tinta2);text-align:center}.rod{font-size:12.5px}
</style></head><body><main>
<header><h1>Achadinhos da semana</h1><p class="sub">O que saiu nos grupos de <b>${esc(e.titulo)}</b> nos últimos 7 dias.</p><a class="entrar" href="/g/${esc(e.slug)}?o=vitrine">Entrar nos grupos</a></header>
<div class="grade">${cards}</div>
<p class="rod">${d.rodape ? zap(d.rodape) : e.aviso_afiliado ? 'Os links das ofertas são links de afiliado.' : ''} Preços conferidos na hora do envio; podem mudar na loja.</p>
</main></body></html>`;
}
