// API simulada no navegador, usada só no protótipo publicado (sem servidor).
// Os dados vêm de uma foto do painel de demonstração (window.OFERTIX_FOTO) e as datas são trazidas para hoje.
(function () {
  const F = window.OFERTIX_FOTO;
  const DIA = 86400000;
  const desloc = Math.round((Date.now() - F.tirada) / DIA) * DIA;
  const CAMPOS = new Set(['quando', 'criado_em', 'enviado_em', 'em', 'atualizado_em', 'enviar_em']);
  const moverDia = (d) => new Date(new Date(d + 'T12:00:00').getTime() + desloc).toISOString().slice(0, 10);
  (function mover(o) {
    if (Array.isArray(o)) return o.forEach(mover);
    if (o && typeof o === 'object') for (const k of Object.keys(o)) {
      if (CAMPOS.has(k) && typeof o[k] === 'number') o[k] += desloc;
      else if (k === 'dia' && typeof o[k] === 'string') o[k] = moverDia(o[k]);
      else mover(o[k]);
    }
  })(F.dados);
  const D = F.dados;
  const copia = (x) => JSON.parse(JSON.stringify(x));
  let proxId = 9000;
  const espera = () => new Promise((r) => setTimeout(r, 160));
  const reais = (c) => 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mensagem = (o, modelo) => {
    const pct = o.preco_de && o.preco_por && o.preco_de > o.preco_por ? Math.round((1 - o.preco_por / o.preco_de) * 100) : 0;
    const cup = D.cupons.find((c) => c.ativo && c.plataforma === o.plataforma);
    const campos = { titulo: o.titulo || 'Oferta', de: pct ? `De ~${reais(o.preco_de)}~\n` : '', por: o.preco_por ? reais(o.preco_por) : 'preço no link', desconto: pct ? `(${pct}% OFF)` : '', cupom: cup ? `🎟️ Cupom: *${cup.codigo}*\n` : '', link: o.url_afiliado, loja: '' };
    const m = (modelo || D.config.modelo_mensagem || '').trim() || '{🔥|⚡|🚨|😱} *{titulo}*\n\n{de}Por *{por}* {desconto}\n{cupom}\n🛒 {Compre aqui|Link da oferta|Garanta o seu}: {link}';
    return m.replace(/\{(\w+)\}/g, (x, k) => (k in campos ? campos[k] : x)).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };
  const VAR = /\{([^{}\n]*\|[^{}\n]*)\}/g;
  const expandir = (t, primeira) => t.replace(VAR, (_m, op) => { const l = op.split('|'); return l[primeira ? 0 : Math.floor(Math.random() * l.length)]; });
  const plataformaDe = (u) => /shopee|shp\.ee/.test(u) ? 'shopee' : /mercadoli|meli\.la/.test(u) ? 'mercadolivre' : /amazon|amzn/.test(u) ? 'amazon' : /magalu|magazineluiza/.test(u) ? 'magalu' : null;
  const erro = (m) => { throw new Error(m); };
  const todasOfertas = () => D['ofertas'];
  const refazerListas = () => {
    D['ofertas?origem=manual'] = todasOfertas().filter((o) => o.origem === 'manual');
    D['ofertas?origem=captura'] = todasOfertas().filter((o) => o.origem === 'captura');
    D['ofertas?origem=vitrine'] = todasOfertas().filter((o) => o.vitrine).sort((a, b) => a.vitrine_em - b.vitrine_em);
  };

  window.OFERTIX_MOCK = async function (metodo, caminho, corpo) {
    await espera();
    const [rota, qs] = caminho.split('?');
    const id = Number((rota.match(/\/(\d+)/) || [])[1]);
    if (metodo === 'GET') {
      if (/^ofertas\/\d+\/texto$/.test(rota)) { const o = todasOfertas().find((x) => x.id === id); return { oferta: copia(o), texto: mensagem(o) }; }
      if (D[caminho] !== undefined) return copia(D[caminho]);
      if (rota === 'membros') return copia(D['membros?' + qs.replace(/&grupo=\d+/, '')] || D['membros?periodo=7d']);
      if (rota === 'numeros' && /qr$/.test(caminho)) return { qr: '', estado: 'conectado' };
      if (D[rota] !== undefined) return copia(D[rota]);
      return erro('Não disponível no protótipo');
    }
    if (rota === 'ofertas') {
      const url = String(corpo.url || '').trim();
      const pl = plataformaDe(url);
      if (!/^https?:\/\//.test(url) || !pl) erro('Por enquanto o Ofertix aceita links da Shopee, Mercado Livre, Amazon e Magalu');
      const ex = [['Cafeteira Elétrica 30 Xícaras', 18990, 11990, '☕'], ['Mochila Impermeável Notebook', 15990, 8990, '🎒'], ['Kit 10 Potes Herméticos', 9990, 4990, '🫙']][proxId % 3];
      const o = { id: ++proxId, cliques: 0, envios: 0, vitrine: 0, vitrine_em: 0, esgotada: 0, plataforma: pl, url_original: url, url_afiliado: pl === 'shopee' ? 'https://s.shopee.com.br/seuLink' + proxId : url + (url.includes('?') ? '&' : '?') + (pl === 'amazon' ? 'tag=carla-20' : 'matt_tool=123'),
        titulo: ex[0], imagem: 'emoji:' + ex[3], preco_de: ex[1], preco_por: ex[2], comissao_pct: pl === 'shopee' ? 9 : null, origem: 'manual', origem_grupo: '', criado_em: Date.now() };
      todasOfertas().unshift(o); refazerListas();
      return { oferta: copia(o), texto: mensagem(o) };
    }
    if (rota === 'ofertas/lote') {
      const urls = corpo.urls.filter((u) => /^https?:\/\//.test(u));
      const criadas = [], erros = corpo.urls.filter((u) => !plataformaDe(u)).map((url) => ({ url, erro: 'Por enquanto o Ofertix aceita links da Shopee, Mercado Livre, Amazon e Magalu' }));
      for (const url of urls.filter(plataformaDe).slice(0, 20)) {
        const r = await window.OFERTIX_MOCK('POST', 'ofertas', { url });
        const quando = corpo.inicio + criadas.length * corpo.espacoMin * 60000;
        const a = { id: ++proxId, oferta_id: r.oferta.id, texto: r.texto, imagem: r.oferta.imagem, foto: r.oferta.imagem, titulo: r.oferta.titulo, plataforma: r.oferta.plataforma, quando, grupos: '"todos"', status: 'pendente', enviados: 0, erros: 0, pulados: 0, cliques: 0, total: 0, obs: '', origem: 'lote', criado_em: Date.now() };
        D['agendamentos'].unshift(a); D['agendamentos?status=pendente'].unshift(a);
        criadas.push({ id: r.oferta.id, titulo: r.oferta.titulo, quando });
      }
      return { criadas, erros };
    }
    if (/^ofertas\/\d+\/vitrine$/.test(rota)) {
      const o = todasOfertas().find((x) => x.id === id); o.vitrine = corpo.ligada ? 1 : 0; o.vitrine_em = Date.now(); refazerListas();
      return { ok: true };
    }
    if (rota === 'resumo/teste') return { ok: true };
    // Links de entrada (todas as cópias do período apontam para os mesmos objetos)
    const todasEntradas = () => Object.keys(D).filter((k) => k.startsWith('entradas?')).map((k) => D[k]);
    if (rota === 'entradas') {
      const slug = String(corpo.slug || '');
      if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) erro('Endereço inválido: use de 3 a 40 letras minúsculas, números ou hífen');
      if (!String(corpo.titulo || '').trim()) erro('Dê um nome para a página');
      const e = { id: ++proxId, slug, titulo: corpo.titulo, descricao: corpo.descricao || '', cor: corpo.cor || '#e8457c', foto: '', aviso_afiliado: 1, ativo: 1, temas: [], visitas: 0, cliques: 0, lotados: 0, entraram: 0, origens: [] };
      todasEntradas().forEach((d) => d.lista.push(e));
      return { id: e.id };
    }
    // Cada período tem a sua cópia: as mudanças valem para todas.
    const entradasCom = (id) => todasEntradas().map((d) => d.lista.find((e) => e.id === id)).filter(Boolean);
    const temasCom = (id) => todasEntradas().flatMap((d) => d.lista.flatMap((e) => e.temas)).filter((t) => t.id === id);
    if (/^entradas\/\d+$/.test(rota)) {
      if (metodo === 'DELETE') { todasEntradas().forEach((d) => (d.lista = d.lista.filter((e) => e.id !== id))); return { ok: true }; }
      entradasCom(id).forEach((e) => Object.assign(e, corpo, { ativo: corpo.ativo ? 1 : 0, aviso_afiliado: corpo.aviso_afiliado ? 1 : 0 })); return { ok: true };
    }
    if (/^entradas\/\d+\/temas$/.test(rota)) {
      if (!String(corpo.nome || '').trim()) erro('Dê um nome para o tema');
      const tid = ++proxId; entradasCom(id).forEach((e) => e.temas.push({ id: tid, nome: corpo.nome, emoji: corpo.emoji || '', grupos: [], ativo: null, cliques: 0 })); return { ok: true };
    }
    if (/^temas\/\d+$/.test(rota) && metodo === 'DELETE') { todasEntradas().forEach((d) => d.lista.forEach((e) => (e.temas = e.temas.filter((t) => t.id !== id)))); return { ok: true }; }
    if (/^temas\/\d+\/grupos$/.test(rota)) {
      for (const t of temasCom(id)) {
        t.grupos = corpo.grupos.map((g) => { const x = D.grupos.lista.find((y) => y.id === g); return { id: g, nome: x.nome, participantes: x.participantes, limite: 1000, tem_convite: 1, convite: 'https://chat.whatsapp.com/DEMO' }; });
        t.ativo = (t.grupos.find((g) => g.participantes < g.limite) || {}).id || null;
      }
      return { ok: true };
    }
    if (/^grupos\/\d+\/(convite|ajustes)$/.test(rota)) {
      todasEntradas().flatMap((d) => d.lista.flatMap((e) => e.temas)).flatMap((t) => t.grupos).filter((g) => g.id === id).forEach((g) => (g.tem_convite = 1));
      return { convite: 'https://chat.whatsapp.com/DEMO' };
    }
    if (/^ofertas\/\d+$/.test(rota) && metodo === 'DELETE') { D['ofertas'] = todasOfertas().filter((o) => o.id !== id); refazerListas(); return { ok: true }; }
    if (rota === 'agendamentos') {
      const o = todasOfertas().find((x) => x.id === corpo.ofertaId) || {};
      const agora = corpo.quando <= Date.now() + 5000;
      const n = corpo.grupos.length;
      const a = { id: ++proxId, pulados: 0, cliques: 0, obs: '', origem: 'manual', oferta_id: o.id, texto: corpo.texto, imagem: o.imagem, foto: o.imagem, titulo: o.titulo, plataforma: o.plataforma, quando: corpo.quando, grupos: JSON.stringify(corpo.grupos),
        status: agora ? 'enviando' : 'pendente', enviados: 0, erros: 0, total: agora ? n : 0, criado_em: Date.now() };
      D['agendamentos'].unshift(a);
      if (agora) {
        // Simula a fila: um grupo a cada ~3 s no protótipo (no sistema real, 25 a 70 s).
        const tique = setInterval(() => { a.enviados++; if (a.enviados >= n) { a.status = 'enviado'; clearInterval(tique); } }, 3000);
      } else D['agendamentos?status=pendente'].unshift(a);
      return { id: a.id };
    }
    if (/^agendamentos\/\d+\/cancelar$/.test(rota)) {
      for (const k of ['agendamentos', 'agendamentos?status=pendente']) { const a = D[k].find((x) => x.id === id); if (a) a.status = 'cancelado'; }
      D['agendamentos?status=pendente'] = D['agendamentos?status=pendente'].filter((x) => x.id !== id);
      return { ok: true };
    }
    if (/^grupos\/\d+$/.test(rota)) {
      const g = D.grupos.lista.find((x) => x.id === id);
      const campo = 'enviar' in corpo ? 'enviar' : 'monitorar';
      const lim = campo === 'enviar' ? D.grupos.limites.envio : D.grupos.limites.monitorados;
      if (corpo[campo] && D.grupos.lista.filter((x) => x[campo] && x.id !== id).length >= lim) erro(`Seu plano permite ${lim} grupo(s)`);
      g[campo] = corpo[campo] ? 1 : 0;
      return { ok: true };
    }
    if (rota === 'cupons') {
      const codigo = String(corpo.codigo || '').trim().toUpperCase();
      if (!codigo) erro('Informe o código do cupom');
      D.cupons.unshift({ id: ++proxId, codigo, plataforma: corpo.plataforma, descricao: corpo.descricao, ativo: 1 });
      return { ok: true };
    }
    if (/^cupons\/\d+$/.test(rota)) {
      if (metodo === 'DELETE') D.cupons = D.cupons.filter((c) => c.id !== id); else D.cupons.find((c) => c.id === id).ativo = corpo.ativo ? 1 : 0;
      return { ok: true };
    }
    if (rota === 'config') {
      const horarios = String(corpo.horarios_auto || '').split(/[,;\s]+/).map((h) => { const m = h.match(/^(\d{1,2})(?:[:h](\d{2})?)?h?$/i); return m && +m[1] < 24 ? `${m[1].padStart(2, '0')}:${(m[2] || '00')}` : ''; }).filter(Boolean);
      Object.assign(D.config, corpo, { shopee_segredo: corpo.shopee_segredo ? '••••••••' : '', horarios_auto: [...new Set(horarios)].sort().join(', '), resumo_numero: String(corpo.resumo_numero || '').replace(/\D/g, '') });
      return { ok: true };
    }
    if (rota === 'previa') {
      const m = mensagem({ titulo: 'Air Fryer Digital 4L', preco_de: 39990, preco_por: 21990, url_afiliado: 'https://s.shopee.com.br/exemplo', plataforma: 'shopee' }, corpo.modelo);
      return { texto: expandir(m, true), variacoes: new RegExp(VAR.source).test(m), exemplos: [1, 2, 3].map(() => expandir(m)) };
    }
    if (/sincronizar$/.test(rota)) return rota.startsWith('comissoes') ? { itens: 0 } : { grupos: D.grupos.lista.length };
    if (rota === 'numeros' || /^numeros\/\d+$/.test(rota)) erro('No protótipo os números já vêm conectados. No sistema real, aqui aparece o QR Code.');
    return erro('Não disponível no protótipo');
  };
})();
