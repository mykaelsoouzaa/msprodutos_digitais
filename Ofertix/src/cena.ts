// Animação do topo da página de vendas (e da página do anúncio): uma oferta saindo para 19 grupos,
// um de cada vez, com o horário de cada envio e os cliques subindo. Sem dependências.
// Sem JavaScript ou com "reduzir movimento", aparece parada, com todos os grupos já enviados.

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const GRUPOS_CENA: [string, number][] = [
  ['#01 Achadinhos do Dia', 1002], ['#02 Casa & Cozinha', 987], ['#03 Beleza em Conta', 1011], ['#04 Achados até R$ 50', 948],
  ['#05 Mães e Bebês', 876], ['#06 Moda e Acessórios', 1004], ['#07 Organização Fácil', 912], ['#08 Ofertas Relâmpago', 1019],
  ['#09 Achadinhos do Dia 2', 1008], ['#10 Skincare Barato', 834], ['#11 Cozinha Prática', 790], ['#12 Achados da Semana', 961],
  ['#13 Casa Organizada', 703], ['#14 Beleza VIP', 655], ['#15 Relâmpago 2', 998], ['#16 Achadinhos Kids', 612],
  ['#17 Look do Dia', 744], ['#18 Utilidades', 581], ['#19 Achados Premium', 437],
];

export const OFERTAS_CENA = [
  { e: '🫙', t: 'Kit 6 Potes Herméticos de Vidro', de: 'R$ 89,90', por: 'R$ 44,90', d: '50% OFF', l: 'ofertix.cloud/r/k7Pq2xA' },
  { e: '✨', t: 'Sérum Facial Vitamina C 30ml', de: 'R$ 59,90', por: 'R$ 27,90', d: '53% OFF', l: 'ofertix.cloud/r/Vt3mQe9' },
  { e: '🗂️', t: 'Organizador de Gaveta Colmeia 24 Nichos', de: 'R$ 39,90', por: 'R$ 18,90', d: '53% OFF', l: 'ofertix.cloud/r/Gm8Lw2c' },
];

export const CENA_CSS = `
.cena{position:relative;min-height:560px}
.cena .tel{position:absolute;left:0;top:14px;width:280px;border-radius:38px;background:#0b0e1c;padding:12px;box-shadow:0 30px 80px rgba(20,24,43,.28),0 0 0 1px rgba(255,255,255,.06) inset;transform:rotate(-3deg)}
.cena .tela{height:500px}
.cena .bolha{transition:opacity .35s,transform .35s}
.cena.troca .bolha.of{opacity:0;transform:translateY(8px)}
.envio{position:absolute;right:0;top:92px;width:300px;background:var(--surface);border:1px solid var(--borda);border-radius:18px;box-shadow:var(--sombra);padding:16px 16px 12px;z-index:2}
.envio .pe-cab{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13.5px}
.envio .pe-cab b{font:700 15px var(--fonte-t)}
.envio .pe-cab span{font:700 15px var(--fonte-t);font-variant-numeric:tabular-nums;color:var(--rosa)}
.envio .barra-env{height:6px;border-radius:4px;background:var(--bg-2);margin:10px 0 8px;overflow:hidden}
.envio .barra-env i{display:block;height:100%;width:0;background:var(--grad);transition:width .45s ease}
.pe-lista{height:204px;overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(180deg,#000 82%,transparent);mask-image:linear-gradient(180deg,#000 82%,transparent)}
.pe-trilho{transition:transform .45s ease}
.pe-l{height:34px;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--texto-2);border-bottom:1px solid var(--borda)}
.pe-l .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pe-l .hr{font-size:11.5px;color:var(--mudo);font-variant-numeric:tabular-nums}
.pe-l .st{width:18px;height:18px;border-radius:50%;border:2px solid var(--borda);flex:none;display:grid;place-items:center;color:#fff;font-size:11px;line-height:1}
.pe-l.vez{color:var(--texto);font-weight:600}
.pe-l.vez .st{border-color:var(--rosa);border-right-color:transparent;animation:gira .8s linear infinite}
.pe-l.vez .hr::after{content:'enviando…';color:var(--rosa)}
.pe-l.ok{color:var(--texto)}
.pe-l.ok .st{background:var(--verde-zap);border-color:var(--verde-zap)}
.pe-l.ok .st::after{content:'✓'}
@keyframes gira{to{transform:rotate(360deg)}}
.pe-rod{display:flex;justify-content:space-between;gap:8px;margin-top:10px;font-size:12px;color:var(--mudo)}
.pe-rod b{color:var(--texto);font-variant-numeric:tabular-nums}
.flut.cliq{left:206px;top:0;z-index:3}
.flut.cliq b{font-variant-numeric:tabular-nums;transition:transform .2s}
.flut.cliq b.pula{transform:scale(1.12)}
.flut.com{right:24px;bottom:0;z-index:3}
.cena .ilus{bottom:-30px;right:0}
@media (max-width:980px){.cena{max-width:560px;margin:0 auto;width:100%}}
@media (max-width:640px){
  .cena{min-height:0;display:flex;flex-direction:column;align-items:center;padding-bottom:34px}
  .cena .tel{position:relative;left:auto;top:auto;width:250px;transform:rotate(-2deg)}
  .cena .tela{height:360px}
  .cena .bolha.enq{display:none}
  .envio{position:relative;right:auto;top:auto;width:min(310px,100%);margin-top:-120px}
  .cena .ilus{bottom:0;left:0;right:0;text-align:center}
}
@media (prefers-reduced-motion:reduce){.pe-l.vez .st{animation:none}.pe-trilho,.envio .barra-env i,.cena .bolha{transition:none}}
`;

/** HTML da animação. Fica parado no primeiro quadro até o script começar. */
export function cenaHtml(): string {
  const o = OFERTAS_CENA[0]!;
  const linhas = GRUPOS_CENA.map(([nome], i) => `<div class="pe-l${i === 0 ? ' vez' : ''}"><span class="st"></span><span class="nm">${esc(nome)}</span><small class="hr"></small></div>`).join('');
  return `<div class="cena" id="cena" role="img" aria-label="Animação: uma oferta saindo para ${GRUPOS_CENA.length} grupos de WhatsApp, um de cada vez, com o horário de cada envio">
    <div class="tel" aria-hidden="true"><div class="tela">
      <div class="cab"><div class="av">%</div><div><b>Achadinhos #01</b><small>1.002 participantes</small></div></div>
      <div class="msgs">
        <div class="bolha of"><div class="foto" id="of-e">${o.e}</div>✨ <b id="of-t">${esc(o.t)}</b><br>Olha que achadinho!<br>De <s id="of-de">${esc(o.de)}</s><br>Por <b id="of-por">${esc(o.por)}</b> (<span id="of-d">${esc(o.d)}</span>)<br>👉 <span class="lk" id="of-l">${esc(o.l)}</span><span class="h">12:00</span></div>
        <div class="bolha enq"><b>📊 Qual achadinho vocês querem amanhã?</b><div class="op">Cozinha<i><u class="v1"></u></i></div><div class="op">Beleza<i><u class="v2"></u></i></div><div class="op">Organização<i><u class="v3"></u></i></div><span class="h">15:00</span></div>
      </div>
    </div></div>
    <div class="envio" aria-hidden="true">
      <div class="pe-cab"><b>Enviando para ${GRUPOS_CENA.length} grupos</b><span id="pe-cont">0/${GRUPOS_CENA.length}</span></div>
      <div class="barra-env"><i id="pe-barra"></i></div>
      <div class="pe-lista"><div class="pe-trilho" id="pe-trilho">${linhas}</div></div>
      <div class="pe-rod"><span>Um grupo de cada vez, de 25 a 70 s</span><span>👆 <b id="pe-cliques2">0</b></span></div>
    </div>
    <div class="flut cliq" aria-hidden="true"><small>Cliques nesta oferta</small><b id="pe-cliques">0</b></div>
    <div class="flut com" aria-hidden="true"><small>Comissão no mês</small><b class="grad-txt">R$ 2.317</b></div>
    <span class="ilus">Animação acelerada, com números de exemplo</span>
  </div>`;
}

export const CENA_JS = `
(function () {
  var c = document.getElementById('cena'); if (!c) return;
  var OF = ${JSON.stringify(OFERTAS_CENA)}, N = ${GRUPOS_CENA.length}, ALT = 34, JANELA = 3;
  var linhas = c.querySelectorAll('.pe-l'), trilho = document.getElementById('pe-trilho');
  var cont = document.getElementById('pe-cont'), barra = document.getElementById('pe-barra');
  var cl = document.getElementById('pe-cliques'), cl2 = document.getElementById('pe-cliques2');
  var reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var k = 0, i = 0, seg = 0, cliques = 0, visivel = true, espera = 0;
  var sorteio = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var dois = function (n) { return (n < 10 ? '0' : '') + n; };
  var horario = function (s) { return '12:' + dois(Math.floor(s / 60) % 60) + ':' + dois(s % 60); };
  var num = function (n) { return n.toLocaleString('pt-BR'); };
  function mostrarCliques() { cl.textContent = num(cliques); cl2.textContent = num(cliques); cl.classList.add('pula'); setTimeout(function () { cl.classList.remove('pula'); }, 200); }
  function desenhar() {
    cont.textContent = i + '/' + N; barra.style.width = (100 * i / N) + '%';
    trilho.style.transform = 'translateY(' + (-Math.max(0, Math.min(i, N - 1) - JANELA) * ALT) + 'px)';
  }
  function zerar() {
    for (var j = 0; j < N; j++) { linhas[j].className = 'pe-l'; linhas[j].querySelector('.hr').textContent = ''; }
    linhas[0].className = 'pe-l vez'; i = 0; seg = 0; cliques = 0; mostrarCliques(); desenhar();
  }
  function trocarOferta() {
    k = (k + 1) % OF.length; var o = OF[k];
    c.classList.add('troca');
    setTimeout(function () {
      document.getElementById('of-e').textContent = o.e; document.getElementById('of-t').textContent = o.t;
      document.getElementById('of-de').textContent = o.de; document.getElementById('of-por').textContent = o.por;
      document.getElementById('of-d').textContent = o.d; document.getElementById('of-l').textContent = o.l;
      c.classList.remove('troca');
    }, 360);
  }
  function enviarUm() {
    var l = linhas[i]; l.className = 'pe-l ok'; l.querySelector('.hr').textContent = horario(seg);
    seg += sorteio(25, 70); i++;
    if (i < N) linhas[i].className = 'pe-l vez';
    desenhar();
  }
  if (reduz) { for (var r = 0; r < N; r++) enviarUm(); cliques = 214; mostrarCliques(); return; }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visivel = e[0].isIntersecting; }).observe(c);
  setInterval(function () {
    if (!visivel || document.hidden) return;
    if (i >= N) { if (++espera === 4) trocarOferta(); if (espera >= 5) { espera = 0; zerar(); } return; }
    enviarUm();
  }, 650);
  setInterval(function () {
    if (!visivel || document.hidden || i === 0) return;
    var mais = sorteio(0, Math.min(4, 1 + Math.floor(i / 5)));
    if (mais) { cliques += mais; mostrarCliques(); }
  }, 420);
})();
`;
