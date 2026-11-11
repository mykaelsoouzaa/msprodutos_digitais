// Página de vendas do Ofertix (ofertix.cloud). HTML gerado no servidor, sem dependências.
// Os botões passam por /quero e /ver-demo, que contam o clique por origem (?o=) e seguem adiante.
import { PLANOS } from './planos.ts';
import { CENA_CSS, CENA_JS, GRUPOS_CENA, cenaHtml } from './cena.ts';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const reaisInt = (c: number) => (c / 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const ICONES: Record<string, string> = {
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  ima: '<path d="M6 15V9a6 6 0 0 1 12 0v6M6 15H2v-6M18 15h4v-6"/>',
  porta: '<path d="M3 21h18M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M14 12h.01"/>',
  clique: '<path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1M5.1 8l-2.9-.8M14 4.1 12 6M6 12l-1.9 2"/>',
  dinheiro: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  filtro: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  zap: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>',
  enquete: '<path d="M3 3v18h18"/><path d="M7 16V9M12 16V5M17 16v-4"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
};
const ico = (n: string, t = 22) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n]}</svg>`;

const RECURSOS: [string, string, string][] = [
  ['link', 'Link de afiliado automático', 'Cole o link da Shopee, do Mercado Livre, da Amazon ou da Magalu. O Ofertix troca pelo seu link, busca foto, preço e comissão e monta a mensagem.'],
  ['busca', 'Busca de produtos na Shopee', 'Procure por palavra e veja preço, nota, vendas e comissão antes de escolher. Um clique e o produto vai para a vitrine.'],
  ['relogio', 'Vitrine e horários automáticos', 'Monte a fila de ofertas e defina os horários. Em cada um, a próxima oferta sai para todos os grupos, sem você precisar estar online.'],
  ['escudo', 'Envio que protege o número', 'Intervalo aleatório entre os grupos, janela de envio, aquecimento de número novo e limite por dia. Pensado para o WhatsApp não estranhar.'],
  ['filtro', 'Curadoria por nicho', 'Escolha categorias, preço máximo, nota e vendas mínimas. O que não combina com o seu público fica de fora sozinho.'],
  ['ima', 'Captura de outros grupos', 'Monitore grupos de ofertas: os links que aparecem lá viram seus, com o seu link de afiliado, e podem ser publicados na hora.'],
  ['porta', 'Link de entrada para a bio', 'Um link só para o Instagram: a pessoa escolhe o tema e cai no grupo que ainda tem vaga. Quando um lota, o próximo assume.'],
  ['clique', 'Cliques por grupo e por horário', 'Cada link conta os cliques. Você vê as ofertas campeãs, os grupos que mais compram e os horários que mais rendem.'],
  ['dinheiro', 'Comissões da Shopee no painel', 'O relatório de vendas entra sozinho: comissão, pedidos, ticket médio e uma meta do mês para acompanhar.'],
  ['enquete', 'Enquetes e lista do dia', 'Pergunte ao grupo o que ele quer ver amanhã e mande, à noite, um resumo com as ofertas mais procuradas do dia.'],
  ['zap', 'Respostas automáticas no privado', 'Quem chama no privado com "grupo" ou "cupom" recebe a resposta na hora, com o link dos grupos ou os cupons ativos.'],
  ['check', 'Resumo no seu WhatsApp', 'Todo dia, no horário que você escolher: mensagens enviadas, cliques, comissões, membros e o que precisa de atenção.'],
];

const DUVIDAS: [string, string][] = [
  ['Preciso deixar o celular ligado?', 'Não. A conexão funciona como o WhatsApp Web: você lê o QR Code uma vez e o Ofertix envia pelo servidor. O celular só precisa entrar na internet de tempos em tempos (o WhatsApp desconecta aparelhos ligados quando o celular passa 14 dias sem internet).'],
  ['Posso usar o meu número pessoal?', 'Pode, mas recomendamos um número só para os grupos, com WhatsApp Business. Assim, se algo acontecer, o seu número pessoal fica de fora.'],
  ['Corro risco de ter o número bloqueado?', 'O Ofertix se conecta por QR Code, não pela API oficial do WhatsApp. Por isso ele espaça os envios, respeita uma janela de horário, aquece números novos e limita os envios por dia. Isso reduz bastante o risco, mas nenhuma ferramenta desse tipo consegue eliminá-lo.'],
  ['Quais lojas funcionam?', 'Shopee (com busca de produtos, preço, nota, vendas e relatório de comissões pela API oficial de afiliados), Mercado Livre, Amazon e Magalu.'],
  ['Preciso ser administrador dos grupos?', 'Para enviar ofertas, basta o número participar do grupo e ter permissão para mandar mensagem. Para o link de entrada pegar o convite sozinho, o número precisa ser administrador.'],
  ['Como funciona o teste grátis?', 'Você pede o teste na área do cliente da MS Soluções e recebe o acesso por 7 dias, com um painel de demonstração completo para explorar tudo antes de conectar o seu número.'],
  ['Como é o pagamento?', 'Os planos são mensais. Ao fim do teste, a equipe da MS Soluções fala com você para ativar o plano escolhido.'],
];

const CSS = `
:root{
  --bg:#fffaf6;--bg-2:#fff1e8;--surface:#ffffff;--borda:#f1e2d8;--trilho:#efe1d6;--texto:#14182b;--texto-2:#4c5168;--mudo:#80849a;
  --laranja:#ff7a1a;--rosa:#e8355a;--grad:linear-gradient(120deg,#ff8a1f 0%,#f2554a 55%,#e8355a 100%);--marinho:#10162e;
  --verde-zap:#1fa855;--bolha:#dcf8c6;--sombra:0 1px 2px rgba(20,24,43,.05),0 12px 32px rgba(20,24,43,.08);--raio:18px;
  --fonte-t:'Space Grotesk',system-ui,sans-serif;--fonte:'Inter',system-ui,sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0d1020;--bg-2:#141831;--surface:#161a33;--borda:#262b4a;--trilho:#2c3156;--texto:#eef0fa;--texto-2:#b2b6cc;--mudo:#7e83a0;--bolha:#1f4d36;--sombra:0 12px 40px rgba(0,0,0,.4);color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0d1020;--bg-2:#141831;--surface:#161a33;--borda:#262b4a;--trilho:#2c3156;--texto:#eef0fa;--texto-2:#b2b6cc;--mudo:#7e83a0;--bolha:#1f4d36;--sombra:0 12px 40px rgba(0,0,0,.4);color-scheme:dark}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--texto);font:16px/1.6 var(--fonte);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit}
h1,h2,h3{font-family:var(--fonte-t);letter-spacing:-.02em;line-height:1.1;margin:0}
.envolve{max-width:1140px;margin:0 auto;padding:0 20px}
.grad-txt{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.botao{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 24px;border-radius:14px;font:600 16px var(--fonte);text-decoration:none;border:0;cursor:pointer;transition:transform .15s,box-shadow .15s;white-space:nowrap}
.botao.pri{background:var(--grad);color:#fff;box-shadow:0 10px 24px rgba(232,53,90,.28)}
.botao.pri:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(232,53,90,.36)}
.botao.sec{background:var(--surface);color:var(--texto);border:1px solid var(--borda)}
.botao.sec:hover{border-color:var(--rosa)}
.botao.peq{height:42px;padding:0 16px;font-size:14px;border-radius:11px}
/* topo */
.topo{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid transparent;transition:border-color .2s}
.topo.rolou{border-bottom-color:var(--borda)}
.topo .envolve{display:flex;align-items:center;gap:24px;height:68px}
.marca{display:flex;align-items:center;gap:10px;font:700 22px var(--fonte-t);text-decoration:none;letter-spacing:-.02em}
.marca img{border-radius:9px}
.nav{display:flex;gap:22px;margin-left:auto;font-size:15px;color:var(--texto-2)}
.nav a{text-decoration:none}.nav a:hover{color:var(--texto)}
.topo .acoes{display:flex;gap:10px}
/* herói */
.heroi{position:relative;padding:56px 0 72px;overflow:hidden}
.heroi::before{content:"";position:absolute;inset:-30% -10% auto auto;width:720px;height:720px;background:radial-gradient(circle,rgba(255,122,26,.18),transparent 62%);pointer-events:none}
.heroi .envolve{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:48px;align-items:center;position:relative}
.selo{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;padding:6px 12px;border-radius:99px;background:var(--surface);border:1px solid var(--borda);color:var(--texto-2)}
.selo i{width:8px;height:8px;border-radius:50%;background:var(--verde-zap);box-shadow:0 0 0 4px rgba(31,168,85,.18)}
.heroi h1{font-size:clamp(38px,5.6vw,64px);margin:18px 0 18px}
.heroi .lead{font-size:clamp(17px,1.8vw,19.5px);color:var(--texto-2);max-width:560px;margin:0 0 28px}
.heroi .ctas{display:flex;gap:12px;flex-wrap:wrap}
.heroi .miudo{font-size:13.5px;color:var(--mudo);margin-top:14px;display:flex;gap:16px;flex-wrap:wrap}
.heroi .miudo span{display:inline-flex;align-items:center;gap:6px}
.heroi .miudo svg{color:var(--verde-zap)}
/* telefone */
.cena{position:relative;display:grid;place-items:center;min-height:540px}
.tel{width:300px;border-radius:38px;background:#0b0e1c;padding:12px;box-shadow:0 30px 80px rgba(20,24,43,.28),0 0 0 1px rgba(255,255,255,.06) inset;transform:rotate(-2deg)}
.tela{border-radius:28px;overflow:hidden;background:#ece5dd;height:520px;display:flex;flex-direction:column}
:root[data-theme="dark"] .tela{background:#0b141a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .tela{background:#0b141a}}
.tela .cab{background:#075e54;color:#fff;padding:14px 14px 12px;display:flex;align-items:center;gap:10px;font-size:13px}
.tela .cab b{display:block;font-size:14px}.tela .cab small{opacity:.8}
.tela .cab .av{width:34px;height:34px;border-radius:50%;background:var(--grad);display:grid;place-items:center;font-weight:700}
.msgs{padding:12px 10px;display:flex;flex-direction:column;gap:8px;flex:1;overflow:hidden}
.bolha{background:var(--bolha);border-radius:10px 10px 10px 2px;padding:6px 8px 4px;font-size:12.5px;line-height:1.45;max-width:92%;color:var(--texto);box-shadow:0 1px 1px rgba(0,0,0,.08)}
.bolha .foto{height:120px;border-radius:7px;background:linear-gradient(135deg,#ffe3cf,#ffd0dc);display:grid;place-items:center;font-size:54px;margin-bottom:6px}
.bolha s{color:var(--mudo)}.bolha .lk{color:#027eb5;word-break:break-all}
.bolha .h{display:block;text-align:right;font-size:10px;color:var(--mudo)}
.bolha.enq b{display:block;margin-bottom:4px}.bolha.enq .op{display:flex;align-items:center;gap:6px;margin:3px 0}.bolha.enq .op i{flex:1;height:5px;border-radius:3px;background:rgba(0,0,0,.08);overflow:hidden}.bolha.enq .op i u{display:block;height:100%;background:var(--verde-zap)}
.flut{position:absolute;background:var(--surface);border:1px solid var(--borda);border-radius:16px;box-shadow:var(--sombra);padding:12px 14px;font-size:13px;min-width:180px}
.flut b{font:700 22px var(--fonte-t);display:block}
.flut small{color:var(--mudo)}
.flut.a{left:-8px;top:70px}.flut.b{right:-6px;top:250px}.flut.c{left:10px;bottom:40px}
.ilus{position:absolute;bottom:-26px;right:12px;font-size:11.5px;color:var(--mudo)}
.barra-env{height:6px;border-radius:4px;background:var(--bg-2);margin-top:8px;overflow:hidden}.barra-env i{display:block;height:100%;width:63%;background:var(--grad)}
/* faixa lojas */
.lojas{border-block:1px solid var(--borda);background:var(--surface)}
.lojas .envolve{display:flex;align-items:center;justify-content:center;gap:clamp(18px,5vw,56px);padding:18px 20px;flex-wrap:wrap;color:var(--texto-2);font:600 17px var(--fonte-t)}
.lojas span:first-child{font:500 14px var(--fonte);color:var(--mudo)}
/* seções */
.secao{padding:88px 0}
.secao.alt{background:var(--bg-2)}
.titulo-sec{text-align:center;max-width:720px;margin:0 auto 48px}
.titulo-sec .pre{font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--rosa)}
.titulo-sec h2{font-size:clamp(30px,4vw,44px);margin:10px 0 14px}
.titulo-sec p{color:var(--texto-2);margin:0;font-size:17.5px}
.passos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;counter-reset:p}
.passo{background:var(--surface);border:1px solid var(--borda);border-radius:var(--raio);padding:26px;position:relative}
.passo::before{counter-increment:p;content:counter(p);position:absolute;top:22px;right:24px;font:700 44px var(--fonte-t);color:var(--borda)}
.passo h3{font-size:21px;margin:14px 0 8px}.passo p{margin:0;color:var(--texto-2)}
.ic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:var(--grad);color:#fff}
.recursos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.recurso{background:var(--surface);border:1px solid var(--borda);border-radius:var(--raio);padding:24px}
.recurso .ic{width:42px;height:42px;background:var(--bg-2);color:var(--rosa)}
.recurso h3{font-size:18px;margin:14px 0 6px}.recurso p{margin:0;color:var(--texto-2);font-size:15px}
/* para quem */
.publicos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.publico{border-radius:var(--raio);padding:28px;background:var(--surface);border:1px solid var(--borda)}
.publico .em{font-size:34px}
.publico h3{font-size:20px;margin:10px 0 8px}.publico p{margin:0;color:var(--texto-2);font-size:15.5px}
.publico.dest{background:var(--marinho);color:#fff;border-color:transparent}
.publico.dest p{color:#c5c9df}
/* calculadora */
.calc{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:24px;align-items:stretch}
.calc form{background:var(--surface);border:1px solid var(--borda);border-radius:var(--raio);padding:26px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.campo label{display:flex;justify-content:space-between;font-size:14px;font-weight:600;margin-bottom:8px}
.campo label output{color:var(--rosa);font-variant-numeric:tabular-nums}
.campo input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;margin:0;background:transparent;cursor:pointer;--p:50%}.campo input[type=range]:focus{outline:none}.campo input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:99px;border:0;background:linear-gradient(90deg,#ff8a1f,#e8355a) 0/var(--p) 100% no-repeat,var(--trilho)}.campo input[type=range]::-moz-range-track{height:6px;border-radius:99px;border:0;background:var(--trilho)}.campo input[type=range]::-moz-range-progress{height:6px;border-radius:99px;background:linear-gradient(90deg,#ff8a1f,#e8355a)}.campo input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;margin-top:-7px;border-radius:50%;background:#fff;border:3px solid #e8355a;box-shadow:0 2px 6px rgba(0,0,0,.25)}.campo input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #e8355a;box-shadow:0 2px 6px rgba(0,0,0,.25)}.campo input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px rgba(232,53,90,.3)}.campo input[type=range]:focus-visible::-moz-range-thumb{box-shadow:0 0 0 4px rgba(232,53,90,.3)}
.res{border-radius:var(--raio);background:var(--marinho);color:#fff;padding:30px;display:flex;flex-direction:column;justify-content:center}
.res small{color:#aab0cc;font-size:14px}
.res .grande{font:700 clamp(40px,5vw,56px) var(--fonte-t);margin:6px 0 4px;letter-spacing:-.02em}
.res .linhas{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.12);font-size:14px}
.res .linhas b{display:block;font:700 20px var(--fonte-t)}
.res p.obs{font-size:12.5px;color:#8f95b3;margin:0}
/* planos */
.planos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:stretch}
.plano{background:var(--surface);border:1px solid var(--borda);border-radius:22px;padding:30px 26px;display:flex;flex-direction:column;position:relative}
.plano.dest{border:2px solid transparent;background:linear-gradient(var(--surface),var(--surface)) padding-box,var(--grad) border-box;box-shadow:0 18px 48px rgba(232,53,90,.16)}
.plano .tag{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--grad);color:#fff;font-size:12px;font-weight:700;padding:5px 12px;border-radius:99px;letter-spacing:.04em;text-transform:uppercase}
.plano h3{font-size:22px}
.plano .para{color:var(--texto-2);font-size:14.5px;margin:6px 0 18px;min-height:44px}
.plano .preco{font:700 46px var(--fonte-t);letter-spacing:-.03em}
.plano .preco small{font:500 15px var(--fonte);color:var(--mudo);letter-spacing:0}
.plano ul{list-style:none;padding:0;margin:20px 0 26px;display:grid;gap:10px;font-size:15px}
.plano li{display:flex;gap:10px;align-items:flex-start}
.plano li svg{color:var(--verde-zap);flex:none;margin-top:3px}
.plano li.nao{color:var(--mudo)}.plano li.nao svg{color:var(--mudo)}
.plano .botao{margin-top:auto;width:100%}
.nota-planos{text-align:center;color:var(--mudo);font-size:14px;margin-top:22px}
/* segurança */
.seg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:center}
.seg h2{font-size:clamp(28px,3.6vw,40px);margin-bottom:14px}
.seg p{color:var(--texto-2)}
.seg ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.seg li{background:var(--surface);border:1px solid var(--borda);border-radius:14px;padding:14px 16px;display:flex;gap:12px}
.seg li b{display:block}.seg li span{color:var(--texto-2);font-size:14.5px}
.seg li svg{color:var(--rosa);flex:none;margin-top:2px}
/* dúvidas */
.duvidas{max-width:820px;margin:0 auto;display:grid;gap:12px}
details{background:var(--surface);border:1px solid var(--borda);border-radius:14px;padding:0 20px}
summary{cursor:pointer;list-style:none;padding:18px 0;font-weight:600;font-size:16.5px;display:flex;justify-content:space-between;gap:12px}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";font:500 22px var(--fonte-t);color:var(--rosa);line-height:1}
details[open] summary::after{content:"–"}
details p{margin:0 0 18px;color:var(--texto-2)}
/* final */
.final{padding:80px 0}
.final .caixa{background:var(--marinho);color:#fff;border-radius:28px;padding:56px 32px;text-align:center;position:relative;overflow:hidden}
.final .caixa::before{content:"";position:absolute;inset:auto -120px -220px auto;width:520px;height:520px;background:radial-gradient(circle,rgba(232,53,90,.45),transparent 65%)}
.final h2{font-size:clamp(30px,4.2vw,46px);position:relative}
.final p{color:#c5c9df;max-width:560px;margin:14px auto 28px;position:relative}
.final .ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;position:relative}
.final .botao.sec{background:transparent;color:#fff;border-color:rgba(255,255,255,.25)}
footer{border-top:1px solid var(--borda);padding:28px 0 40px;color:var(--mudo);font-size:14px}
footer .envolve{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
footer a{color:var(--texto-2)}
.fixo{display:none}
@media (max-width:980px){
  .nav{display:none}.topo .acoes{margin-left:auto}
  .heroi .envolve,.calc,.seg{grid-template-columns:minmax(0,1fr)}
  .cena{min-height:auto;padding:10px 0 20px}
  .recursos,.publicos,.planos{grid-template-columns:repeat(2,minmax(0,1fr))}
  .passos{grid-template-columns:minmax(0,1fr)}
  .plano.dest{order:-1}
}
@media (max-width:640px){
  .envolve{padding:0 16px}
  .topo .acoes .botao.sec{display:none}
  .heroi{padding:32px 0 48px}
  .heroi .ctas .botao{flex:1}
  .recursos,.publicos,.planos{grid-template-columns:minmax(0,1fr)}
  .calc form{grid-template-columns:minmax(0,1fr)}
  .secao{padding:64px 0}
  .flut{display:none}.ilus{bottom:-6px;right:0;left:0;text-align:center}
  .tel{width:270px}.tela{height:470px}
  .fixo{display:flex;position:fixed;left:12px;right:12px;bottom:12px;z-index:30}
  .fixo .botao{width:100%;box-shadow:0 10px 30px rgba(232,53,90,.4)}
  footer{padding-bottom:90px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

const CSS_EXTRA = `
.bolha.enq .op i u.v1{width:72%}.bolha.enq .op i u.v2{width:55%}.bolha.enq .op i u.v3{width:30%}
.zap-flut{position:fixed;right:20px;bottom:20px;z-index:31;width:58px;height:58px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;box-shadow:0 10px 28px rgba(0,0,0,.25);text-decoration:none;transition:transform .15s}
.zap-flut:hover{transform:scale(1.06)}
.zap-flut .bal{position:absolute;right:68px;white-space:nowrap;background:var(--surface);color:var(--texto);border:1px solid var(--borda);padding:8px 12px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--sombra);opacity:0;transform:translateX(6px);transition:opacity .2s,transform .2s;pointer-events:none}
.zap-flut:hover .bal,.zap-flut:focus-visible .bal{opacity:1;transform:none}
.anu .heroi h1{font-size:clamp(34px,5vw,58px)}
.anu .topo .acoes{margin-left:auto}
.anu .beneficios{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.anu .mais{text-align:center;margin-top:28px}.anu .mais a{color:var(--rosa);font-weight:600}
@media (max-width:980px){.anu .beneficios{grid-template-columns:minmax(0,1fr)}}
@media (max-width:640px){.zap-flut{bottom:84px;right:14px;width:52px;height:52px}.zap-flut .bal{display:none}}
`;

const ICONE_ZAP = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 9.5c.4 1.8 1.7 3.3 3.5 4l1.2-1.1 1.8.8-.4 1.6c-3 .2-6.2-2.9-6.2-6l1.6-.4.8 1.8z" fill="currentColor" stroke="none"/></svg>';

/** Botão flutuante de WhatsApp: passa por /zap, que conta o clique pela origem e abre a conversa. */
const botaoZap = (origem: string) => `<a class="zap-flut" href="/zap${origem ? `?o=${encodeURIComponent(origem)}` : ''}" target="_blank" rel="noopener" aria-label="Tirar dúvidas no WhatsApp">${ICONE_ZAP}<span class="bal">Tirar dúvidas no WhatsApp</span></a>`;

export const TEXTO_ZAP = 'Olá! Vim pelo site do Ofertix e quero saber mais.';

export interface OpcoesVendas { urlPublica: string; portalUrl: string; origem: string }

export function paginaVendas(o: OpcoesVendas): string {
  const q = (extra = '') => { const p = new URLSearchParams(); if (o.origem) p.set('o', o.origem); if (extra) p.set('p', extra); const s = p.toString(); return s ? `?${s}` : ''; };
  const teste = (plano = '') => `/quero${q(plano)}`;
  const demo = `/ver-demo${q()}`;
  const planos = ['inicial', 'pro', 'escala'].map((id) => PLANOS[id]!);
  const destaque = 'pro';
  const desc = 'Publique ofertas com o seu link de afiliado em todos os seus grupos de WhatsApp, no piloto automático e sem arriscar o seu número. Teste 7 dias grátis.';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ofertix · Grupos de ofertas no piloto automático</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(o.urlPublica)}/">
<meta property="og:type" content="website"><meta property="og:url" content="${esc(o.urlPublica)}/">
<meta property="og:title" content="Ofertix · Grupos de ofertas no piloto automático"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(o.urlPublica)}/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/assets/logo-128.png"><link rel="apple-touch-icon" href="/assets/logo-256.png">
<meta name="theme-color" content="#E8355A">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}${CENA_CSS}${CSS_EXTRA}</style>
</head>
<body>
<header class="topo" id="topo"><div class="envolve">
  <a class="marca" href="/" aria-label="Ofertix, início"><img src="/assets/logo-128.png" alt="" width="34" height="34">Ofertix</a>
  <nav class="nav" aria-label="Seções"><a href="#como">Como funciona</a><a href="#recursos">Recursos</a><a href="#calculadora">Calculadora</a><a href="#planos">Planos</a><a href="#duvidas">Dúvidas</a></nav>
  <div class="acoes"><a class="botao sec peq" href="${esc(o.portalUrl)}/entrar">Entrar</a><a class="botao pri peq" href="${teste()}">Testar grátis</a></div>
</div></header>

<main>
<section class="heroi"><div class="envolve">
  <div>
    <span class="selo"><i></i>Para afiliados da Shopee, Mercado Livre, Amazon e Magalu</span>
    <h1>Seus grupos de ofertas no <span class="grad-txt">piloto automático</span>.</h1>
    <p class="lead">Cole o link do produto e o Ofertix troca pelo seu link de afiliado, monta a mensagem e publica em todos os seus grupos de WhatsApp, um de cada vez, com o intervalo certo para proteger o seu número.</p>
    <div class="ctas"><a class="botao pri" href="${teste()}">Testar 7 dias grátis</a><a class="botao sec" href="${demo}">Ver o painel por dentro</a></div>
    <div class="miudo"><span>${ico('check', 16)}Sem cartão no teste</span><span>${ico('check', 16)}Conecta por QR Code</span><span>${ico('check', 16)}Painel em português</span></div>
  </div>
  ${cenaHtml()}
</div></section>

<div class="lojas"><div class="envolve"><span>Funciona com</span><span>Shopee</span><span>Mercado Livre</span><span>Amazon</span><span>Magalu</span></div></div>

<section class="secao" id="como"><div class="envolve">
  <div class="titulo-sec"><span class="pre">Como funciona</span><h2>Do link à comissão em três passos</h2><p>Você escolhe as ofertas. O Ofertix cuida do resto: link de afiliado, mensagem, envio, cliques e relatório.</p></div>
  <div class="passos">
    <div class="passo"><div class="ic">${ico('zap')}</div><h3>Conecte o WhatsApp</h3><p>Leia o QR Code com o número dos grupos. O Ofertix encontra seus grupos e você escolhe em quais ele publica.</p></div>
    <div class="passo"><div class="ic">${ico('link')}</div><h3>Escolha as ofertas</h3><p>Cole links, busque produtos na Shopee ou deixe a curadoria encher a vitrine sozinha, dentro do seu nicho.</p></div>
    <div class="passo"><div class="ic">${ico('dinheiro')}</div><h3>Acompanhe os resultados</h3><p>Veja cliques por grupo, as ofertas campeãs e as comissões. E receba um resumo do dia no seu WhatsApp.</p></div>
  </div>
</div></section>

<section class="secao alt" id="recursos"><div class="envolve">
  <div class="titulo-sec"><span class="pre">Recursos</span><h2>Tudo o que um grupo de ofertas precisa</h2><p>Feito para quem mantém vários grupos e não quer passar o dia copiando e colando link.</p></div>
  <div class="recursos">${RECURSOS.map(([i, t, d]) => `<article class="recurso"><div class="ic">${ico(i)}</div><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('')}</div>
</div></section>

<section class="secao" id="para-quem"><div class="envolve">
  <div class="titulo-sec"><span class="pre">Para quem é</span><h2>De quem está começando a quem já tem audiência</h2></div>
  <div class="publicos">
    <div class="publico"><div class="em">🛍️</div><h3>Afiliados com grupos</h3><p>Você já tem grupos de promoção e quer publicar em todos ao mesmo tempo, com o seu link, sem gastar o dia nisso.</p></div>
    <div class="publico dest"><div class="em">💖</div><h3>Influenciadoras e perfis com público</h3><p>Transforme seguidoras em um grupo de achadinhos: link na bio que distribui as pessoas entre os grupos, curadoria por nicho e vitrine da semana.</p></div>
    <div class="publico"><div class="em">🚀</div><h3>Quem quer começar</h3><p>Pacote pronto de achadinhos: regras de curadoria, horários, modelo de mensagem e rodapé de afiliado configurados com um clique.</p></div>
  </div>
</div></section>

<section class="secao alt" id="calculadora"><div class="envolve">
  <div class="titulo-sec"><span class="pre">Calculadora</span><h2>Quanto os seus grupos podem render?</h2><p>Mexa nos números e veja uma estimativa. Use os valores que você já conhece do seu público.</p></div>
  <div class="calc">
    <form id="calc" aria-label="Dados para a estimativa">
      <div class="campo"><label for="c-membros">Pessoas nos grupos <output id="o-membros"></output></label><input id="c-membros" type="range" min="200" max="30000" step="100" value="3000"></div>
      <div class="campo"><label for="c-ofertas">Ofertas por dia <output id="o-ofertas"></output></label><input id="c-ofertas" type="range" min="1" max="30" step="1" value="8"></div>
      <div class="campo"><label for="c-ctr">Clicam em cada oferta <output id="o-ctr"></output></label><input id="c-ctr" type="range" min="0.2" max="5" step="0.1" value="1.2"></div>
      <div class="campo"><label for="c-conv">Compram depois do clique <output id="o-conv"></output></label><input id="c-conv" type="range" min="0.5" max="10" step="0.5" value="3"></div>
      <div class="campo"><label for="c-ticket">Valor médio da compra <output id="o-ticket"></output></label><input id="c-ticket" type="range" min="20" max="300" step="5" value="60"></div>
      <div class="campo"><label for="c-com">Comissão média <output id="o-com"></output></label><input id="c-com" type="range" min="2" max="20" step="0.5" value="8"></div>
    </form>
    <div class="res" aria-live="polite">
      <small>Estimativa de comissão por mês</small>
      <div class="grande" id="r-mes">R$ 0</div>
      <small id="r-plano"></small>
      <div class="linhas"><div><small>Cliques por mês</small><b id="r-cliques">0</b></div><div><small>Vendas por mês</small><b id="r-vendas">0</b></div></div>
      <p class="obs">É só uma conta com os números acima, não uma promessa de ganho. O resultado real depende do seu público, das ofertas e da loja.</p>
    </div>
  </div>
</div></section>

<section class="secao" id="planos"><div class="envolve">
  <div class="titulo-sec"><span class="pre">Planos</span><h2>Comece grátis. Cresça quando quiser.</h2><p>Todos os planos têm link de afiliado automático, vitrine, horários automáticos, cliques, comissões e o painel completo.</p></div>
  <div class="planos">${planos.map((p) => {
    const para = { inicial: 'Para quem está começando com poucos grupos.', pro: 'Para quem já tem público e quer escala com dois números.', escala: 'Para operações com muitos grupos e vários números.' }[p.id] ?? '';
    const itens: [boolean, string][] = [
      [true, `${p.numeros} número${p.numeros > 1 ? 's' : ''} de WhatsApp`],
      [true, `Até ${p.gruposEnvio} grupos de envio`],
      [true, `${p.enviosDia.toLocaleString('pt-BR')} mensagens por número por dia`],
      [p.captura, p.captura ? `Captura de ofertas em até ${p.gruposMonitorados} grupos` : 'Captura de ofertas de outros grupos'],
      [true, 'Link de entrada, vitrine e enquetes'],
      [true, 'Busca na Shopee e comissões no painel'],
    ];
    return `<article class="plano${p.id === destaque ? ' dest' : ''}">${p.id === destaque ? '<span class="tag">Recomendado</span>' : ''}
      <h3>${esc(p.nome)}</h3><p class="para">${esc(para)}</p>
      <div class="preco">R$ ${reaisInt(p.precoCentavos)}<small>/mês</small></div>
      <ul>${itens.map(([ok, t]) => `<li class="${ok ? '' : 'nao'}">${ico(ok ? 'check' : 'x', 17)}<span>${esc(t)}</span></li>`).join('')}</ul>
      <a class="botao ${p.id === destaque ? 'pri' : 'sec'}" href="${teste(p.id)}">Começar teste grátis</a></article>`;
  }).join('')}</div>
  <p class="nota-planos">7 dias grátis em qualquer plano. Preços mensais, em reais.</p>
</div></section>

<section class="secao alt" id="seguranca"><div class="envolve seg">
  <div><span class="titulo-sec" style="display:block;text-align:left;margin:0"><span class="pre">Segurança do número</span></span>
    <h2>Pensado para o WhatsApp não estranhar</h2>
    <p>O Ofertix conecta pelo QR Code, como o WhatsApp Web, e não pela API oficial. Por isso, cada envio segue regras que imitam o ritmo de uma pessoa. Isso reduz bastante o risco de bloqueio, mas nenhuma ferramenta desse tipo consegue eliminá-lo: use um número só para os grupos.</p></div>
  <ul>
    <li>${ico('relogio')}<div><b>Intervalo aleatório entre grupos</b><span>Nada de 20 mensagens no mesmo segundo.</span></div></li>
    <li>${ico('escudo')}<div><b>Aquecimento de número novo</b><span>O limite diário começa baixo e sobe a cada semana.</span></div></li>
    <li>${ico('filtro')}<div><b>Janela de envio e proteção contra repetição</b><span>Nada sai de madrugada, e a mesma oferta não volta ao mesmo grupo no mesmo dia.</span></div></li>
    <li>${ico('check')}<div><b>Pausa geral com um clique</b><span>Parou tudo? Um botão segura todos os envios até você liberar.</span></div></li>
  </ul>
</div></section>

<section class="secao" id="duvidas"><div class="envolve">
  <div class="titulo-sec"><span class="pre">Dúvidas</span><h2>Perguntas frequentes</h2></div>
  <div class="duvidas">${DUVIDAS.map(([p, r]) => `<details><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('')}</div>
</div></section>

<section class="final"><div class="envolve"><div class="caixa">
  <h2>Seus grupos trabalhando por você</h2>
  <p>Teste o Ofertix por 7 dias. Explore o painel de demonstração e conecte o seu número quando estiver pronto.</p>
  <div class="ctas"><a class="botao pri" href="${teste()}">Testar 7 dias grátis</a><a class="botao sec" href="${demo}">Ver o painel por dentro</a></div>
</div></div></section>
</main>

<footer><div class="envolve">
  <span>Ofertix é um produto da <a href="${esc(o.portalUrl)}" target="_blank" rel="noopener">MS Soluções Tecnológicas</a>.</span>
  <span><a href="${esc(o.portalUrl)}/entrar">Área do cliente</a> · <a href="#duvidas">Dúvidas</a></span>
</div></footer>
<div class="fixo"><a class="botao pri" href="${teste()}">Testar 7 dias grátis</a></div>
${botaoZap(o.origem)}
<script>${CENA_JS}</script>
<script>
(function () {
  var topo = document.getElementById('topo');
  addEventListener('scroll', function () { topo.classList.toggle('rolou', scrollY > 8); }, { passive: true });
  var $ = function (id) { return document.getElementById(id); };
  var n = function (v, d) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d || 0 }); };
  var reais = function (v) { return 'R$ ' + n(Math.round(v)); };
  var PLANOS = ${JSON.stringify(planos.map((p) => ({ nome: p.nome, preco: p.precoCentavos / 100, envio: p.gruposEnvio })))};
  function preencher() { document.querySelectorAll('#calc input[type=range]').forEach(function (i) { i.style.setProperty('--p', ((i.value - i.min) / (i.max - i.min)) * 100 + '%'); }); }
  function calcular() {
    preencher();
    var m = +$('c-membros').value, of = +$('c-ofertas').value, ctr = +$('c-ctr').value / 100, conv = +$('c-conv').value / 100, tk = +$('c-ticket').value, com = +$('c-com').value / 100;
    $('o-membros').textContent = n(m); $('o-ofertas').textContent = of; $('o-ctr').textContent = n(ctr * 100, 1) + '%';
    $('o-conv').textContent = n(conv * 100, 1) + '%'; $('o-ticket').textContent = reais(tk); $('o-com').textContent = n(com * 100, 1) + '%';
    var cliques = m * ctr * of * 30, vendas = cliques * conv, mes = vendas * tk * com;
    $('r-cliques').textContent = n(cliques); $('r-vendas').textContent = n(vendas); $('r-mes').textContent = reais(mes);
    var grupos = Math.ceil(m / 1000), p = PLANOS.find(function (x) { return x.envio >= grupos; }) || PLANOS[PLANOS.length - 1];
    $('r-plano').textContent = 'Cerca de ' + grupos + ' grupo' + (grupos > 1 ? 's' : '') + ' cheio' + (grupos > 1 ? 's' : '') + ' · plano ' + p.nome + ' (R$ ' + p.preco + '/mês)';
  }
  document.getElementById('calc').addEventListener('input', calcular);
  calcular();
})();
</script>
</body>
</html>`;
}

/**
 * Página curta para quem chega pelo anúncio ("Comenta EU QUERO"): a mesma mensagem do anúncio,
 * a animação do envio, três benefícios, três dúvidas e o botão de teste. Fica em /quero-testar.
 */
export function paginaAnuncio(o: OpcoesVendas): string {
  const q = o.origem ? `?o=${encodeURIComponent(o.origem)}` : '';
  const teste = `/quero${q}`, demo = `/ver-demo${q}`;
  const titulo = 'Ofertix · A mesma oferta em todos os seus grupos';
  const desc = 'Cole o link do produto uma vez e o Ofertix publica em todos os seus grupos de WhatsApp, com o seu link de afiliado. Teste 7 dias grátis.';
  const duvidas = [DUVIDAS[2]!, DUVIDAS[0]!, DUVIDAS[5]!];
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website"><meta property="og:url" content="${esc(o.urlPublica)}/quero-testar">
<meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(o.urlPublica)}/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<link rel="icon" type="image/png" href="/assets/logo-128.png"><link rel="apple-touch-icon" href="/assets/logo-256.png">
<meta name="theme-color" content="#E8355A">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}${CENA_CSS}${CSS_EXTRA}</style>
</head>
<body class="anu">
<header class="topo" id="topo"><div class="envolve">
  <a class="marca" href="/${q}" aria-label="Ofertix, página inicial"><img src="/assets/logo-128.png" alt="" width="34" height="34">Ofertix</a>
  <div class="acoes"><a class="botao pri peq" href="${teste}">Testar grátis</a></div>
</div></header>

<main>
<section class="heroi"><div class="envolve">
  <div>
    <span class="selo"><i></i>Você comentou "EU QUERO"? Aqui está</span>
    <h1>${GRUPOS_CENA.length} grupos recebendo a mesma oferta. <span class="grad-txt">Sem você copiar e colar.</span></h1>
    <p class="lead">Cole o link do produto uma vez. O Ofertix troca pelo seu link de afiliado e publica em todos os seus grupos de WhatsApp, um de cada vez, no ritmo certo para proteger o seu número.</p>
    <div class="ctas"><a class="botao pri" href="${teste}">Quero testar 7 dias grátis</a><a class="botao sec" href="${demo}">Ver o painel por dentro</a></div>
    <div class="miudo"><span>${ico('check', 16)}Sem cartão no teste</span><span>${ico('check', 16)}Shopee, Mercado Livre, Amazon e Magalu</span></div>
  </div>
  ${cenaHtml()}
</div></section>

<section class="secao alt"><div class="envolve">
  <div class="titulo-sec"><span class="pre">O que muda no seu dia</span><h2>Menos tempo no celular, mais oferta no grupo</h2></div>
  <div class="beneficios">
    <div class="passo"><div class="ic">${ico('link')}</div><h3>Seu link em cada oferta</h3><p>O Ofertix troca o link do produto pelo seu link de afiliado, busca foto e preço e monta a mensagem pronta.</p></div>
    <div class="passo"><div class="ic">${ico('relogio')}</div><h3>Um grupo de cada vez</h3><p>Os envios saem com intervalo aleatório, dentro do horário que você escolher. Dá para deixar a vitrine trabalhando sozinha.</p></div>
    <div class="passo"><div class="ic">${ico('dinheiro')}</div><h3>Cliques e comissões no painel</h3><p>Veja quais ofertas e grupos rendem mais e receba um resumo do dia no seu WhatsApp.</p></div>
  </div>
  <p class="mais"><a href="/${q}#recursos">Ver todos os recursos e planos</a></p>
</div></section>

<section class="secao" id="duvidas"><div class="envolve">
  <div class="titulo-sec"><span class="pre">Dúvidas</span><h2>Antes de testar</h2></div>
  <div class="duvidas">${duvidas.map(([p, r]) => `<details><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('')}</div>
</div></section>

<section class="final"><div class="envolve"><div class="caixa">
  <h2>Comece hoje, de graça</h2>
  <p>São 7 dias para explorar o painel e conectar o seu número quando estiver pronto. Ficou com dúvida? Chame a gente no WhatsApp.</p>
  <div class="ctas"><a class="botao pri" href="${teste}">Quero testar 7 dias grátis</a><a class="botao sec" href="/zap${q}" target="_blank" rel="noopener">Falar no WhatsApp</a></div>
</div></div></section>
</main>

<footer><div class="envolve">
  <span>Ofertix é um produto da <a href="${esc(o.portalUrl)}" target="_blank" rel="noopener">MS Soluções Tecnológicas</a>.</span>
  <span><a href="/${q}">Página do Ofertix</a> · <a href="${esc(o.portalUrl)}/entrar">Área do cliente</a></span>
</div></footer>
<div class="fixo"><a class="botao pri" href="${teste}">Quero testar grátis</a></div>
${botaoZap(o.origem)}
<script>(function(){var t=document.getElementById('topo');addEventListener('scroll',function(){t.classList.toggle('rolou',scrollY>8)},{passive:true})})();</script>
<script>${CENA_JS}</script>
</body>
</html>`;
}
