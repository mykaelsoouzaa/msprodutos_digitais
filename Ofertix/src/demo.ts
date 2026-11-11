// Dados fictícios para o painel de demonstração (teste grátis do portal e npm run demo).
import { randomInt } from 'node:crypto';
import { type DB, contaPorEmail } from './db.ts';
import { novoCodigo } from './servico.ts';
import { PACOTE_ACHADINHOS, classificar } from './nicho.ts';

export const EMAIL_DEMO = 'demo@ofertix.app';

const PRODUTOS = [
  ['shopee', 'Air Fryer Digital 4L Antiaderente', 39990, 21990, 8, 'emoji:🍟'],
  ['mercadolivre', 'Tênis de Corrida Leve Masculino', 15990, 12600, 12, 'emoji:👟'],
  ['amazon', 'Garrafa Térmica Inox 1L', 8990, 5490, 6, 'emoji:🧊'],
  ['mercadolivre', 'Smartwatch Esportivo com GPS', 29990, 18990, 10, 'emoji:⌚'],
  ['shopee', 'Fone Bluetooth com Estojo', 19990, 7990, 15, 'emoji:🎧'],
  ['shopee', 'Jogo de Panelas 5 Peças Cerâmica', 49990, 27990, 9, 'emoji:🍳'],
  ['amazon', 'Kindle 16GB Tela sem Reflexo', 59900, 44900, 4, 'emoji:📖'],
  ['magalu', 'Liquidificador 1200W 3L', 22990, 14990, 7, 'emoji:🥤'],
] as const;

const GRUPOS = [
  ['#20 Achados da Carla', 812, 1, 0], ['#16 Casa & Cozinha VIP', 980, 1, 0], ['#15 Mãe e Bebê Ofertas', 1000, 1, 0],
  ['#12 Tech Barato', 846, 1, 0], ['#11 Moda em Oferta', 760, 1, 0], ['#09 Promo Relâmpago', 1007, 1, 0],
  ['Ofertas do Zé (monitorado)', 1024, 0, 1], ['Caçadores de Cupom (monitorado)', 1019, 0, 1], ['Família', 14, 0, 0],
] as const;

export function semearDemo(db: DB, agora = Date.now()) {
  const c = contaPorEmail(db, EMAIL_DEMO, 'Carla (demonstração)');
  if ((db.prepare('SELECT COUNT(*) AS n FROM grupos WHERE conta_id = ?').get(c.id) as any).n) return c.id;
  db.prepare("UPDATE contas SET plano = 'pro' WHERE id = ?").run(c.id);
  db.prepare(`UPDATE config_conta SET amazon_tag = 'carla-20', auto_publicar = 1, desconto_minimo = 20, horarios_auto = '09:00, 12:00, 18:00, 21:00',
    resumo_numero = '5511988887777', resumo_hora = 21, repeticao_horas = 24 WHERE conta_id = ?`).run(c.id);
  const dia = 86_400_000;
  const meiaNoite = new Date(agora).setHours(0, 0, 0, 0);

  const inst = [1, 2].map((n) => Number(db.prepare("INSERT INTO instancias (conta_id, nome, chave, token_webhook, status, numero, criado_em) VALUES (?, ?, ?, 'demo', 'conectado', ?, ?)")
    .run(c.id, n === 1 ? 'Principal' : 'Reserva', `demo-${n}`, n === 1 ? '5511988887777' : '5511977776666', agora - 40 * dia).lastInsertRowid));

  const grupos = GRUPOS.map(([nome, part, enviar, mon], i) => Number(db.prepare('INSERT INTO grupos (conta_id, instancia_id, jid, nome, participantes, enviar, monitorar, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(c.id, inst[i % 2], `12036300${i}@g.us`, nome, part, enviar, mon, agora).lastInsertRowid));
  const envio = grupos.slice(0, 6);

  const ofertas = PRODUTOS.map(([pl, titulo, de, por, com, img], i) => Number(db.prepare(`INSERT INTO ofertas (conta_id, plataforma, url_original, url_afiliado, titulo, imagem, preco_de, preco_por, comissao_pct, origem, origem_grupo, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(c.id, pl, `https://exemplo.com/p/${i}`, pl === 'shopee' ? `https://s.shopee.com.br/demo${i}` : `https://exemplo.com/p/${i}?tag=carla-20`,
    titulo, img, de, por, com, i % 3 === 0 ? 'captura' : 'manual', i % 3 === 0 ? 'Ofertas do Zé (monitorado)' : '', agora - (i + 1) * 3600_000).lastInsertRowid));

  // Histórico de 30 dias: agendamentos enviados para os grupos.
  const insAg = db.prepare("INSERT INTO agendamentos (conta_id, oferta_id, texto, imagem, quando, grupos, status, criado_em) VALUES (?, ?, ?, '', ?, '\"todos\"', 'enviado', ?)");
  const insEnv = db.prepare("INSERT INTO envios (conta_id, agendamento_id, grupo_id, instancia_id, enviar_em, status, enviado_em) VALUES (?, ?, ?, ?, ?, 'enviado', ?)");
  const insLink = db.prepare('INSERT INTO links (codigo, conta_id, oferta_id, grupo_id, agendamento_id, destino, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insClique = db.prepare('INSERT INTO cliques (codigo, conta_id, em) VALUES (?, ?, ?)');
  // Algumas ofertas e alguns grupos rendem mais cliques que outros, como na vida real.
  const forcaOferta = ofertas.map((_, i) => [1.6, 1.1, 0.7, 1.3, 2.1, 0.9, 0.5, 0.8][i] ?? 1);
  const forcaGrupo = envio.map((_, i) => [1.2, 0.8, 1.5, 1.9, 0.6, 1.4][i] ?? 1);
  for (let d = 30; d >= 1; d--) {
    const posts = randomInt(3, 9);
    for (let p = 0; p < posts; p++) {
      const quando = meiaNoite - d * dia + (9 + p * 1.5) * 3600_000; // entre 9h e 21h, dentro da janela
      const io = randomInt(0, ofertas.length);
      const ag = Number(insAg.run(c.id, ofertas[io], 'Oferta enviada', quando, quando).lastInsertRowid);
      envio.forEach((g, k) => {
        const em = quando + k * 40_000;
        insEnv.run(c.id, ag, g, inst[k % 2], em, em);
        const codigo = novoCodigo();
        insLink.run(codigo, c.id, ofertas[io], g, ag, 'https://exemplo.com/p/' + io, em);
        const n = Math.round(randomInt(0, 4) * forcaOferta[io] * forcaGrupo[k]);
        for (let x = 0; x < n; x++) insClique.run(codigo, c.id, em + randomInt(1, 180) * 60_000);
      });
    }
  }

  // Vitrine: ofertas esperando os horários automáticos.
  const vitrine = [['shopee', 'Mop Giratório com Balde', 12990, 6990, 11, 'emoji:🧹'], ['shopee', 'Kit Skincare Sérum Vitamina C e Hidratante', 8990, 4490, 12, 'emoji:🧴'],
    ['shopee', 'Organizador de Maquiagem Acrílico Giratório', 7990, 3990, 10, 'emoji:💄'], ['amazon', 'Potes Herméticos de Vidro 10 Peças', 15990, 8990, 8, 'emoji:🫙'],
    ['shopee', 'Cabide Veludo Antideslizante 30 Unidades', 6990, 3490, 11, 'emoji:🧥'], ['mercadolivre', 'Vestido Midi Canelado Feminino', 11990, 5990, 13, 'emoji:👗']] as const;
  vitrine.forEach(([pl, titulo, de, por, com, img], i) => db.prepare(`INSERT INTO ofertas (conta_id, plataforma, url_original, url_afiliado, titulo, imagem, preco_de, preco_por, comissao_pct, origem, criado_em, vitrine, vitrine_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, 1, ?)`).run(c.id, pl, `https://exemplo.com/v/${i}`, `https://exemplo.com/v/${i}?aff=carla`, titulo, img, de, por, com, agora - 20 * 60_000, agora - (6 - i) * 60_000));

  // Uma oferta barrada pela conferência de preço, para mostrar como aparece.
  db.prepare("INSERT INTO agendamentos (conta_id, oferta_id, texto, imagem, quando, grupos, status, obs, origem, criado_em) VALUES (?, ?, ?, ?, ?, '\"todos\"', 'cancelado', ?, 'vitrine', ?)")
    .run(c.id, ofertas[5], '🔥 *Jogo de Panelas 5 Peças Cerâmica*', 'emoji:🍳', agora - 3 * 3600_000, 'Preço subiu de R$ 279,90 para R$ 319,90', agora - 3 * 3600_000);

  // Próximos envios (pendentes).
  ofertas.slice(0, 5).forEach((o, k) => {
    const of = db.prepare('SELECT titulo, imagem FROM ofertas WHERE id = ?').get(o) as any;
    db.prepare("INSERT INTO agendamentos (conta_id, oferta_id, texto, imagem, quando, grupos, status, criado_em) VALUES (?, ?, ?, ?, ?, '\"todos\"', 'pendente', ?)")
      .run(c.id, o, `🔥 *${of.titulo}*`, of.imagem, agora + (k + 1) * 25 * 60_000, agora);
  });

  // Entradas e saídas de membros.
  const insM = db.prepare('INSERT INTO membros_eventos (conta_id, grupo_id, tipo, qtd, em) VALUES (?, ?, ?, ?, ?)');
  for (let d = 30; d >= 0; d--) for (const g of envio) {
    insM.run(c.id, g, 'entrou', randomInt(4, 22), agora - d * dia + 10 * 3600_000);
    insM.run(c.id, g, 'saiu', randomInt(1, 9), agora - d * dia + 15 * 3600_000);
  }

  // Comissões da Shopee e de outras lojas.
  const insC = db.prepare("INSERT INTO comissoes (conta_id, plataforma, pedido, produto, valor_centavos, comissao_centavos, status, em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (let k = 0; k < 70; k++) {
    const p = PRODUTOS[randomInt(0, PRODUTOS.length)];
    const st = k % 11 === 0 ? 'cancelado' : k < 18 ? 'pendente' : 'concluido';
    insC.run(c.id, p[0], `PED${100000 + k}`, p[1], p[3], Math.round((p[3] * p[4]) / 100), st, agora - randomInt(0, 30) * dia - randomInt(0, 20) * 3600_000);
  }

  // Link de entrada de exemplo: página da bio com 3 temas, grupos com convite e acessos vindos do Instagram.
  const ent = Number(db.prepare(`INSERT INTO entradas (conta_id, slug, titulo, descricao, cor, criado_em) VALUES (?, 'exemplo-achadinhos', 'Achadinhos da Carla',
    'Ofertas garimpadas todo dia na Shopee, Amazon e Mercado Livre. Escolha o seu grupo:', '#e8457c', ?)`).run(c.id, agora - 20 * dia).lastInsertRowid);
  const temas = [['Beleza e skincare', '💄', [2, 0]], ['Casa e cozinha', '🏠', [1]], ['Tech e utilidades', '🎧', [3, 5]]] as const;
  db.prepare("UPDATE grupos SET convite = 'https://chat.whatsapp.com/DEMOgrupo' || id WHERE conta_id = ?").run(c.id);
  db.prepare('UPDATE grupos SET participantes = 1000 WHERE id = ?').run(grupos[2]); // primeiro grupo de Beleza já lotou
  temas.forEach(([nome, emoji, gs], i) => {
    const tid = Number(db.prepare('INSERT INTO entradas_temas (entrada_id, nome, emoji, ordem) VALUES (?, ?, ?, ?)').run(ent, nome, emoji, i).lastInsertRowid);
    gs.forEach((g, k) => db.prepare('INSERT INTO entradas_grupos (tema_id, grupo_id, ordem) VALUES (?, ?, ?)').run(tid, grupos[g], k));
  });
  const temaIds = (db.prepare('SELECT id FROM entradas_temas WHERE entrada_id = ? ORDER BY ordem').all(ent) as any[]).map((x) => Number(x.id));
  const insA = db.prepare('INSERT INTO entradas_acessos (entrada_id, tema_id, grupo_id, tipo, origem, em) VALUES (?, ?, ?, ?, ?, ?)');
  const origens = [['bio', 30], ['stories', 55], ['reels', 15]] as const;
  for (let d = 20; d >= 0; d--) for (const [o, peso] of origens) {
    const visitas = Math.round(randomInt(2, 7) * peso / 10);
    for (let v = 0; v < visitas; v++) {
      const em = agora - d * dia - randomInt(0, 12 * 3600) * 1000;
      insA.run(ent, null, null, 'visita', o, em);
      if (randomInt(0, 100) < 62) insA.run(ent, temaIds[randomInt(0, 3)], null, 'clique', o, em + 4000);
    }
  }

  for (const [cod, pl, desc] of [['MODALIVRE', 'mercadolivre', '15% até R$ 30'], ['PIPOCA10', 'shopee', '10% até R$ 30'], ['CARLA10', 'amazon', '10% até R$ 50'], ['ACHADO15', 'magalu', '15% até R$ 40']])
    db.prepare('INSERT INTO cupons (conta_id, codigo, plataforma, descricao, validade) VALUES (?, ?, ?, ?, ?)').run(c.id, cod, pl, desc, '');
  // Categorias e o pacote de achadinhos, para a tela Nicho e o desempenho por categoria.
  for (const o of db.prepare('SELECT id, titulo FROM ofertas WHERE conta_id = ?').all(c.id) as any[]) db.prepare('UPDATE ofertas SET categoria = ?, nota = ?, vendas = ? WHERE id = ?').run(classificar(o.titulo), Math.round((4.6 + randomInt(0, 4) / 10) * 10) / 10, randomInt(80, 5000), o.id);
  db.prepare('UPDATE config_conta SET nicho = ?, modelo_mensagem = ?, horarios_auto = ? WHERE conta_id = ?').run(JSON.stringify(PACOTE_ACHADINHOS.nicho), PACOTE_ACHADINHOS.modelo, PACOTE_ACHADINHOS.horarios, c.id);
  // v5: meta, mensagens automáticas e histórico de preço.
  db.prepare("UPDATE config_conta SET meta_comissao = 60000, resumo_semanal = 1, boas_vindas = ? WHERE conta_id = ?").run('💖 Boas-vindas a quem chegou no {grupo}! Aqui sai achadinho todo dia, com preço conferido. Fique à vontade e chame as amigas.', c.id);
  db.prepare("INSERT INTO recorrentes (conta_id, nome, texto, hora, dias, ativo, ultimo, criado_em) VALUES (?, 'Regras do grupo', ?, '10:00', '1', 1, '', ?)").run(c.id, '📌 *Regras do grupo*\nSó a administração posta. Pode sair quando quiser. Os links são de afiliado.', agora);
  db.prepare("INSERT INTO recorrentes (conta_id, nome, texto, hora, dias, ativo, ultimo, criado_em) VALUES (?, 'Chame uma amiga', ?, '19:30', '5', 1, '', ?)").run(c.id, '💌 Sabe aquela amiga que ama um achadinho? Manda o link do grupo para ela!', agora);
  for (const o of db.prepare('SELECT id, preco_por FROM ofertas WHERE conta_id = ? AND preco_por IS NOT NULL').all(c.id) as any[]) {
    const base = Number(o.preco_por);
    [1.25, 1.12, 1.18, 1.05, 1].forEach((f, k) => db.prepare('INSERT INTO precos (oferta_id, preco_por, em) VALUES (?, ?, ?)').run(o.id, Math.round(base * f), agora - (5 - k) * 6 * dia));
  }
  // v6: respostas no privado, lista do dia, vitrine abastecida e uma enquete já enviada.
  for (const [pal, txt, usos] of [['grupo, grupos, link, entrar', 'Oi, {nome}! 💖 Escolha o seu grupo de achadinhos aqui: {link_grupos}', 37], ['cupom, cupons, desconto', 'Os cupons que estão valendo agora:\n{cupons}', 12]] as const)
    db.prepare('INSERT INTO respostas (conta_id, palavras, texto, usos, criado_em) VALUES (?, ?, ?, ?, ?)').run(c.id, pal, txt, usos, agora - 9 * dia);
  db.prepare('UPDATE config_conta SET lista_dia = ?, abastecer = ? WHERE conta_id = ?').run(
    JSON.stringify({ ativo: true, hora: '21:30', quantas: 5, titulo: '🛍️ *Os achadinhos de hoje*' }),
    JSON.stringify({ ativo: true, palavras: ['organizador', 'kit skincare'], quantidade: 5, hora: '07:30', ordem: 'vendidos', colecao: true }), c.id);
  const enq = Number(db.prepare("INSERT INTO agendamentos (conta_id, texto, imagem, quando, grupos, status, origem, criado_em, enquete) VALUES (?, ?, '', ?, '\"todos\"', 'enviado', 'enquete', ?, ?)")
    .run(c.id, '📊 Qual achadinho vocês querem amanhã?', agora - 5 * 3600_000, agora - 5 * 3600_000, JSON.stringify({ opcoes: ['🍳 Cozinha', '💄 Beleza', '🗂️ Organização'], multipla: false })).lastInsertRowid);
  for (const g of grupos.slice(0, 3)) db.prepare("INSERT INTO envios (conta_id, agendamento_id, grupo_id, instancia_id, enviar_em, enviado_em, status) SELECT ?, ?, id, instancia_id, ?, ?, 'enviado' FROM grupos WHERE id = ?").run(c.id, enq, agora - 5 * 3600_000, agora - 5 * 3600_000, g);
  return c.id;
}
