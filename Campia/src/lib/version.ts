// Versão exibida no rodapé, na tela de abertura e na página de Novidades.
// Ao lançar uma atualização: suba APP_VERSION (igual ao package.json) e adicione um item no topo de CHANGELOG.

export const APP_VERSION = '1.10.0';

export interface Release {
  version: string;
  date: string; // AAAA-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.10.0',
    date: '2026-10-26',
    title: 'Termos de Uso e Política de Privacidade',
    items: [
      "Novas páginas de Termos de Uso e Política de Privacidade, de acordo com a LGPD, com links no rodapé.",
      "A inscrição pede o aceite dos Termos e da Privacidade; o login também mostra os links.",
    ],
  },
  {
    version: '1.9.0',
    date: '2026-10-26',
    title: 'Editar campeonato, times e atletas',
    items: [
      "Na aba Ajustes: mude o nome e o valor da inscrição e refaça a agenda dos jogos que ainda não aconteceram.",
      "Enquanto ninguém se inscreveu, dá para trocar o formato e o número de times.",
      "Na aba Times: edite o nome do time, os dados do capitão e a lista de atletas.",
      "Inscreva um time manualmente numa vaga livre (pagamento por fora ou cortesia).",
    ],
  },
  {
    version: '1.8.2',
    date: '2026-10-26',
    title: 'Aviso ao conectar a conta errada',
    items: [
      "Em Recebimentos, a Campia avisa se o Wallet ID informado for da própria conta da Campia, que o Asaas não aceita para repasse.",
    ],
  },
  {
    version: '1.8.1',
    date: '2026-10-26',
    title: 'Conectar o repasse só com o Wallet ID',
    items: [
      "Em Recebimentos, o organizador conecta a conta Asaas colando apenas o Wallet ID, sem precisar de chave de API.",
      "Mais simples e mais seguro: o Wallet ID só identifica a conta que recebe.",
    ],
  },
  {
    version: '1.8.0',
    date: '2026-10-26',
    title: 'Repasse automático do PIX',
    items: [
      "Nova página Recebimentos no painel: o organizador conecta a conta Asaas dele e cada inscrição paga já cai dividida, direto na conta dele.",
      "Para conectar basta colar a chave de API do Asaas uma vez; a Campia descobre o Wallet ID e não guarda a chave.",
      "Lista das últimas inscrições com o status do pagamento e se o repasse foi automático ou manual.",
      "Se o Asaas recusar a divisão, a inscrição continua funcionando e aquele repasse fica manual.",
    ],
  },
  {
    version: '1.7.0',
    date: '2026-10-26',
    title: 'W.O. e cartões',
    items: [
      "Marque W.O. no resultado: o time presente vence com o placar padrão do esporte (3 × 0 no futebol) e o ausente não pontua.",
      "W.O. duplo nos pontos corridos e na fase de grupos: derrota sem pontos para os dois.",
      "Cartões amarelo e vermelho por atleta no futebol, futsal e handebol.",
      "Suspensão automática no próximo jogo após vermelho, 2 amarelos no jogo ou amarelos acumulados (o organizador escolhe quantos).",
      "Nova aba Cartões com os suspensos da próxima rodada; o formulário avisa quem está suspenso.",
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-26',
    title: 'Ajudantes do organizador',
    items: [
      "Convide ajudantes por e-mail na aba Ajustes do campeonato.",
      "Ajudantes lançam resultados e ajustam data, horário e campo, sem ver pagamentos, contatos ou ajustes.",
      "Botão para enviar o convite pelo WhatsApp; o campeonato aparece no painel do ajudante em Você ajuda em.",
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-26',
    title: 'Área do capitão: Meus times',
    items: [
      "Nova página Meus times: o capitão entra com o e-mail da inscrição e vê os times dele.",
      "Para cada time: posição na tabela, último resultado, próximos jogos e link para pagar o PIX pendente.",
      "A inscrição agora pede o e-mail do capitão; o organizador pode cadastrar o e-mail de quem se inscreveu antes.",
      "Menu no celular com Campeonatos, Meus times, Como funciona e Novidades.",
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-26',
    title: 'Página da arena',
    items: [
      "Cada organizador pode criar a página da sua arena, com logo, endereço, descrição, WhatsApp e Instagram.",
      "A página mostra os campeonatos atuais e os anteriores, e tem botão de Como chegar.",
      "Os campeonatos mostram quem organiza, com link para a página da arena.",
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-26',
    title: 'Explorar campeonatos',
    items: [
      "Nova página Campeonatos, com todos os campeonatos públicos.",
      "Filtros por estado, cidade, categoria de esporte, presencial ou online e só inscrições abertas.",
      "Campeonatos com inscrições abertas aparecem primeiro, com vagas e valor da inscrição.",
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-26',
    title: 'Cidade, estado e campeonatos online',
    items: [
      'Local do campeonato com cidade e estado (UF) separados, mostrados como "Campinas - SP".',
      'Campeonatos de e-sports podem ser marcados como Online; aí os campos de endereço somem.',
      'O local aparece na página do campeonato, na inscrição, na arte da rodada e na mensagem do WhatsApp.',
      'Dá para mudar o local depois, na aba Ajustes do campeonato.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-26',
    title: 'Visual novo para celular, tablet e computador',
    items: [
      'Layout adaptável: no computador, a página do campeonato tem duas colunas e os jogos aparecem em grade.',
      'Ícones próprios para cada esporte, separados por categoria: Futebol, Quadra, Areia, Raquete e Games.',
      'Escolha do esporte em cartões, mais fácil de tocar no celular.',
      'Nova tela de abertura e nova tela de entrada no painel.',
      'Página de Novidades com o histórico das atualizações.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-26',
    title: 'Lançamento da Campia',
    items: [
      'Tabela e agenda automáticas em pontos corridos, grupos + mata-mata ou mata-mata.',
      'Inscrição dos times pelo link, com pagamento por PIX e confirmação automática da vaga.',
      'Resultados pelo celular, com classificação, chaveamento e artilharia.',
      'Página pública do campeonato e arte da rodada para os stories.',
      'App instalável com lembretes antes dos jogos.',
    ],
  },
];
